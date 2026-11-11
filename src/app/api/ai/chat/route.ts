import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeErrorMetadata } from "@/lib/database-errors";

import { getSession } from "@/lib/auth";
import { rankHospitals, type ScoredHospital, type HospitalLike } from "@/lib/scoring";
import { loadVerifiedHospitals } from "@/lib/hospital-service";
import { interpretQuery, type ParsedNeed } from "@/lib/nlp";
import {
  buildTextQuery,
  classifySearchIntent,
  resolveExplicitPlace,
} from "@/lib/location-intent";
import { LlmCallError, llmConfigured, streamAiReply, type ChatMessage } from "@/lib/llm";
import { ok, parseBody, withApi } from "@/lib/api-helpers";
import {
  GOOGLE_ID_PREFIX,
  GoogleApiError,
  googleKeyConfigured,
  searchNearbyHospitals,
  searchTextHospitals,
  type PlaceResult,
} from "@/lib/google-places";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  message: z.string().trim().min(1).max(1000),
  sessionId: z.string().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  locationLabel: z.string().trim().max(200).optional(),
  usePlaces: z.boolean().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(16)
    .optional(),
});

type Body = z.infer<typeof schema>;

interface Origin {
  lat: number;
  lng: number;
  label: string;
  source: "explicit" | "device";
}

/** Hospital record shape produced by either Google Places or the database. */
type SearchHospital = HospitalLike & {
  addressLine?: string;
  rating?: number;
  reviewCount?: number;
  googleMapsUri?: string;
  phone?: string;
  openingStatus?: string;
};

interface Rec {
  id: string;
  isDemo?: boolean;
  name: string;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
  googleMapsUri?: string;
  phone?: string;
  openingStatus?: string;
  dataSource?: string;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

const NO_LOCATION_ASK =
  "Which city or area should I search for nearby hospitals?";
const EMERGENCY_LINE =
  "This may require urgent medical evaluation. Please call 112 or 108 immediately.";

type ConfigKind = "unconfigured" | "rejected" | "quota";

function configMessage(kind: ConfigKind, detail?: string): string {
  if (kind === "quota") {
    return (
      "AI conversation is unavailable because the Gemini API quota or rate limit has been reached. " +
      "Check the configured project's quota and billing, or try again later. " +
      "No other AI provider was used for this request."
    );
  }
  if (kind === "rejected") {
    return (
      "AI conversation is unavailable: the configured GEMINI_API_KEY was rejected by the Gemini API" +
      (detail ? ` (${detail})` : "") +
      ". Update the server key to re-enable Jeevan AI chat."
    );
  }
  return (
    "AI conversation is not configured on this server: the GEMINI_API_KEY environment variable is missing or empty, " +
    "so Jeevan AI cannot generate natural-language replies. Add a valid server-side Gemini API key to enable chat."
  );
}

/* ------------------------------------------------------------------ */
/* Search helpers                                                      */
/* ------------------------------------------------------------------ */

function toHospitalLike(p: PlaceResult): SearchHospital {
  return {
    id: `${GOOGLE_ID_PREFIX}${p.placeId}`,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    type: "PRIVATE",
    status: "VERIFIED",
    beds: [],
    services: [],
    doctors: [],
    addressLine: p.address,
    googleMapsUri: p.googleMapsUri,
    rating: p.rating,
    reviewCount: p.userRatingCount,
    phone: p.phone,
    openingStatus:
      typeof p.openNow === "boolean" ? (p.openNow ? "Open now" : "Closed now") : undefined,
  };
}

function dedupePlaces(places: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();
  return places.filter((p) => {
    if (seen.has(p.placeId)) return false;
    seen.add(p.placeId);
    return true;
  });
}

async function nearbyLadder(
  origin: Origin,
  radii: number[]
): Promise<{ places: PlaceResult[]; radiusKm: number }> {
  for (const r of radii) {
    try {
      const places = await searchNearbyHospitals({
        lat: origin.lat,
        lng: origin.lng,
        radiusMeters: r,
        limit: 20,
      });
      if (places.length > 0) return { places, radiusKm: Math.round(r / 1000) };
    } catch (err) {
      if (err instanceof GoogleApiError && err.status === 429) throw err;
    }
  }
  return { places: [], radiusKm: Math.round(radii[radii.length - 1] / 1000) };
}

interface SearchState {
  ranked: ScoredHospital<SearchHospital>[];
  dataSource: "google-places" | "internal-db" | "none";
  searchRadiusKm: number;
  searchMode: "nearby" | "city-wide" | "none";
  note?: string;
}

async function runSearch(
  origin: Origin,
  need: ParsedNeed,
  opts: { placeText?: string; usePlaces: boolean }
): Promise<SearchState> {
  const googleOn = googleKeyConfigured() && opts.usePlaces;
  let places: PlaceResult[] = [];
  let searchRadiusKm = 0;
  let searchMode: SearchState["searchMode"] = "none";

  if (googleOn) {
    try {
      if (origin.source === "explicit" && opts.placeText) {
        // City-wide search: text search biased to the resolved place, then a
        // proximity ladder as fallback. Never silently restricted to a tiny
        // radius around the city centre.
        searchMode = "city-wide";
        searchRadiusKm = 50;
        const textQuery = buildTextQuery(need, opts.placeText);
        places = await searchTextHospitals({
          query: textQuery,
          lat: origin.lat,
          lng: origin.lng,
          radiusMeters: 50000,
          limit: 20,
        });
        if (places.length === 0) {
          const ladder = await nearbyLadder(origin, [10000, 25000, 50000]);
          places = ladder.places;
          searchRadiusKm = ladder.radiusKm;
          if (places.length > 0) searchMode = "nearby";
        }
      } else {
        searchMode = "nearby";
        const ladder = await nearbyLadder(origin, [5000, 10000, 15000, 25000, 50000]);
        places = ladder.places;
        searchRadiusKm = ladder.radiusKm;
        if (places.length === 0) {
          places = await searchTextHospitals({
            query: "hospital",
            lat: origin.lat,
            lng: origin.lng,
            radiusMeters: 25000,
            limit: 20,
          });
          if (places.length > 0) searchRadiusKm = 25;
        }
      }

      // Specialty text search alongside the proximity ladder, so
      // "cardiologist near me" surfaces cardiology-focused hospitals too.
      if (need.specialty && origin.source === "device") {
        const term = need.specialty.toLowerCase();
        try {
          const extra = await searchTextHospitals({
            query: `${term} hospital`,
            lat: origin.lat,
            lng: origin.lng,
            radiusMeters: 25000,
            limit: 10,
          });
          if (extra.length > 0) places = dedupePlaces([...places, ...extra]);
        } catch (err) {
          if (err instanceof GoogleApiError && err.status === 429) throw err;
        }
      }
    } catch (err) {
      console.error("[ai] Google Places search failed", {
        ...safeErrorMetadata(err),
        ...(err instanceof GoogleApiError ? { status: err.status } : {}),
      });
    }
  }

  if (places.length > 0) {
    const mapped = places.map((p) => toHospitalLike(p));
    const ranked = rankHospitals(mapped, { ...need, location: origin });
    return {
      ranked: ranked.slice(0, 15),
      dataSource: "google-places",
      searchRadiusKm,
      searchMode,
    };
  }

  // Internal database fallback — facility records are not live feeds.
  let hospitals: SearchHospital[] = [];
  try {
    const session = await getSession();
    hospitals = await loadVerifiedHospitals({ includeDemo: session?.isDemo === true && !need.requiresEmergency });
  } catch (err) {
    console.error("[ai] hospital database unavailable", safeErrorMetadata(err));
  }
  let relevant = hospitals;
  if (need.requiresEmergency) {
    const emergencyOnly = relevant.filter((h) =>
      h.services.some((s) => s.key === "EMERGENCY" && s.status !== "UNAVAILABLE")
    );
    if (emergencyOnly.length > 0) relevant = emergencyOnly;
  }
  const ranked = rankHospitals(relevant.slice(0, 40), { ...need, location: origin });

  // The internal database covers Indian facilities; do not present
  // multi-thousand-kilometre rows as nearby care for worldwide searches.
  const near = ranked
    .filter((r) => (origin.source === "explicit" ? r.distanceKm <= 250 : true))
    .slice(0, 15);

  let note: string | undefined;
  if (!googleKeyConfigured()) {
    note =
      "GOOGLE_MAPS_API_KEY is not configured on the server, so live Google Places search is disabled; these results come from the built-in hospital database.";
  } else if (!opts.usePlaces) {
    note =
      "Live Google Places search was disabled for this request; results come from the built-in hospital database.";
  } else {
    note =
      "Live Google Places search returned no results; these come from our internal hospital database.";
  }
  if (near.length === 0 && origin.source === "explicit") {
    note =
      "The built-in hospital database only covers India, and live Google Places search is unavailable, so no matching facilities could be listed for this area.";
  }

  return {
    ranked: near,
    dataSource: near.length > 0 ? "internal-db" : "none",
    searchRadiusKm: searchMode === "city-wide" ? 50 : searchRadiusKm || 25,
    searchMode: searchMode === "none" ? (origin.source === "explicit" ? "city-wide" : "nearby") : searchMode,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* LLM grounding context                                               */
/* ------------------------------------------------------------------ */

function buildContextNote(args: {
  message: string;
  need: ParsedNeed;
  origin: Origin | null;
  search?: SearchState;
  searchPerformed: boolean;
  placeUnresolved: string | null;
  emergency: boolean;
}): string {
  const lines: string[] = [];
  if (args.emergency) {
    lines.push(
      "URGENCY: The user's message suggests an emergency. First line must advise calling 112 (India) or the local emergency number now and going to the nearest emergency department."
    );
  }
  if (args.origin) {
    lines.push(
      `Search location: "${args.origin.label}" (${args.origin.source === "explicit" ? "named by the user in this message" : "device GPS / selected location"}), ${args.origin.lat.toFixed(4)}, ${args.origin.lng.toFixed(4)}.`
    );
  } else if (args.placeUnresolved) {
    lines.push(
      `The user named a place the system could not resolve: "${args.placeUnresolved}". Ask them to clarify the city/area.`
    );
  } else {
    lines.push(
      "Search location: none provided yet. If results are needed, ask which city or area to search (do not guess a city)."
    );
  }

  if (args.searchPerformed && args.search) {
    const s = args.search;
    lines.push(
      `Search performed: mode=${s.searchMode}, radius=${s.searchRadiusKm} km, source=${s.dataSource}, results=${s.ranked.length}, fetchedAt=${new Date().toISOString()}.`
    );
    if (s.dataSource === "google-places") {
      lines.push(
        "Copy these facts exactly (name, address, distance, rating, review count, phone, open/closed). Never add hospitals or numbers that are not listed:"
      );
      s.ranked.slice(0, 8).forEach((r, i) => {
        const bits = [
          `${i + 1}. ${r.hospital.name}`,
          r.hospital.addressLine ? `— ${r.hospital.addressLine}` : null,
          `— ${r.distanceKm.toFixed(1)} km away`,
          typeof r.hospital.rating === "number"
            ? `— rated ${r.hospital.rating}${typeof r.hospital.reviewCount === "number" ? ` from ${r.hospital.reviewCount} reviews` : ""}`
            : null,
          r.hospital.phone ? `— phone ${r.hospital.phone}` : null,
          r.hospital.openingStatus ? `— ${r.hospital.openingStatus}` : null,
        ].filter(Boolean);
        lines.push(bits.join(" "));
      });
    } else if (s.ranked.length > 0) {
      lines.push(
        `Search source: internal hospital database (Google Places unavailable). ${s.note ?? ""}`
      );
      s.ranked.slice(0, 5).forEach((r, i) => {
        lines.push(
          `${i + 1}. ${r.hospital.isDemo ? "DEMO SAMPLE — " : "FACILITY-ENTERED RECORD — "}${r.hospital.name}${r.hospital.addressLine ? ` — ${r.hospital.addressLine}` : ""} — ${r.distanceKm.toFixed(1)} km away. Bed, doctor, service and emergency status may be outdated and are not a live feed.`
        );
      });
    } else {
      lines.push(
        "No results found. Do not invent any facility — say nothing was found and ask the user to broaden the area."
      );
    }
    if (s.note && s.dataSource === "google-places") lines.push(s.note);
  } else {
    lines.push(
      "No hospital search was performed for this message — answer as a conversation, without naming any facility."
    );
  }

  if (!googleKeyConfigured()) {
    lines.push(
      "NOTE: GOOGLE_MAPS_API_KEY is not configured on this server; if you present any facility, be transparent that these come from the built-in database."
    );
  }
  return lines.join("\n");
}

function fallbackReply(args: {
  kind: ConfigKind;
  detail?: string;
  emergency: boolean;
  origin: Origin | null;
  askForLocation: boolean;
  placeUnresolved: string | null;
  search: SearchState | null;
  searchPerformed: boolean;
}): string {
  const parts: string[] = [];
  if (args.emergency) parts.push(EMERGENCY_LINE);

  if (args.askForLocation) {
    parts.push(
      args.placeUnresolved
        ? `I couldn't resolve "${args.placeUnresolved}" as a place. Could you share a nearby city, area, or PIN code?`
        : NO_LOCATION_ASK
    );
  } else if (args.searchPerformed && args.origin) {
    const top = args.search?.ranked ?? [];
    if (top.length > 0) {
      const named = top
        .slice(0, 2)
        .map((r) => `${r.hospital.name} (${r.distanceKm.toFixed(1)} km)`)
        .join(", ");
      const where =
        args.search?.dataSource === "google-places"
          ? `results near ${args.origin.label}`
          : `entries in the built-in hospital database — the closest to ${args.origin.label}`;
      parts.push(
        `Search still works: I found ${top.length} ${where}: ${named}. Full details, ratings and directions are in the Nearby Care panel.`
      );
      if (args.search?.note) parts.push(args.search.note);
    } else {
      parts.push(
        `The live search for ${args.origin.label} returned no hospital results. Try a broader area or a different city.`
      );
      if (args.search?.note) parts.push(args.search.note);
    }
  }

  parts.push(configMessage(args.kind, args.detail));
  return parts.join(" ");
}

function errorReply(args: {
  message: string;
  emergency: boolean;
  origin: Origin | null;
  search: SearchState | null;
  searchPerformed: boolean;
}): string {
  const parts: string[] = [];
  if (args.emergency) parts.push(EMERGENCY_LINE);
  parts.push(
    `Sorry — I couldn't reach the AI model just now (${args.message}). Please try again in a moment.`
  );
  if (args.searchPerformed && args.search && args.search.ranked.length > 0 && args.origin) {
    parts.push(
      `Live search still returned ${args.search.ranked.length} results near ${args.origin.label} — see the Nearby Care panel.`
    );
  }
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

function chunkText(text: string): string[] {
  const out: string[] = [];
  const re = /[\s\S]{1,140}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[0]);
  return out.length > 0 ? out : [text];
}

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const data: Body = parsed.data;
    const message = data.message;

    const need = interpretQuery(message);
    const intent = classifySearchIntent(message);
    const isEmergency = need.urgency === "EMERGENCY" && !intent.educational;

    const history: ChatMessage[] = (data.history ?? [])
      .filter((m) => m.content.trim().length > 0)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    const llmHistory: ChatMessage[] = [...history, { role: "user", content: message }];

    // Location priority: explicit place named in the message > device/selected
    // coordinates > none (ask the user). Never silently default to a city.
    const hasDevice =
      typeof data.lat === "number" && typeof data.lng === "number";
    const explicit = intent.placePhrase
      ? await resolveExplicitPlace(message)
      : null;
    const placeUnresolved = intent.placePhrase && !explicit ? intent.placePhrase : null;

    let origin: Origin | null = null;
    if (explicit) {
      origin = {
        lat: explicit.lat,
        lng: explicit.lng,
        label: explicit.label,
        source: "explicit",
      };
    } else if (hasDevice) {
      origin = {
        lat: data.lat as number,
        lng: data.lng as number,
        label: data.locationLabel?.trim() || "My Current Location",
        source: "device",
      };
    }

    const wantsLocation = intent.wantsSearch && !intent.educational;
    const searchPerformed = wantsLocation && origin !== null;
    const needsLocationPrompt = wantsLocation && origin === null;

    let search: SearchState | null = null;
    let askForLocation = false;
    let locationMissing = false;

    if (searchPerformed && origin) {
      search = await runSearch(origin, need, {
        placeText: origin.source === "explicit" ? origin.label : undefined,
        usePlaces: data.usePlaces !== false,
      });
    } else if (needsLocationPrompt) {
      askForLocation = true;
      locationMissing = true;
    }

    const recommendations: Rec[] = search
      ? search.ranked.slice(0, 3).map((r) => ({
          id: r.hospital.id,
          isDemo: r.hospital.isDemo,
          name: r.hospital.name,
          score: r.score,
          distanceKm: Math.round(r.distanceKm * 10) / 10,
          etaMinutes: r.etaMinutes,
          address: r.hospital.addressLine,
          lat: r.hospital.lat,
          lng: r.hospital.lng,
          rating: r.hospital.rating,
          reviewCount: r.hospital.reviewCount,
          googleMapsUri: r.hospital.googleMapsUri,
          phone: r.hospital.phone,
          openingStatus: r.hospital.openingStatus,
          dataSource: r.hospital.id.startsWith(GOOGLE_ID_PREFIX) ? "google-places" : "internal-db",
        }))
      : [];

    const contextNote = buildContextNote({
      message,
      need,
      origin,
      search: search ?? undefined,
      searchPerformed,
      placeUnresolved,
      emergency: isEmergency,
    });

    const sessionId = data.sessionId ?? randomUUID();
    const meta = {
      sessionId,
      urgency: need.urgency,
      searchedLocation: origin?.label,
      userCoordinates: origin ? { lat: origin.lat, lng: origin.lng } : undefined,
      searchRadiusKm: search?.searchRadiusKm ?? 0,
      searchMode: search?.searchMode ?? "none",
      dataSource: search?.dataSource ?? "none",
      lastFetchedAt: new Date().toISOString(),
      recommendations,
      locationMissing,
      askForLocation,
      searchPerformed,
      placeResolved: origin?.source === "explicit" ? origin.label : undefined,
      aiConfigured: llmConfigured(),
      aiStatus: llmConfigured() ? ("ready" as const) : ("unconfigured" as const),
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const send = (obj: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          } catch {
            closed = true;
          }
        };

        send({ type: "meta", ...meta });

        let reply = "";
        let engine: "llm" | "config" | "error" = "llm";
        let finalAiStatus: "ready" | "unconfigured" | "rejected" | "quota" = meta.aiStatus;

        try {
          reply = await streamAiReply({
            history: llmHistory,
            contextNote,
            signal: req.signal,
            onDelta: (chunk) => {
              if (!reply) reply = chunk;
              else reply += chunk;
              send({ type: "delta", text: chunk });
            },
          });
        } catch (err) {
          if (err instanceof LlmCallError) {
            if (err.kind === "aborted") {
              closed = true;
              try {
                controller.close();
              } catch {
                /* already closed */
              }
              return;
            }
            if (err.kind === "unconfigured" || err.kind === "rejected" || err.kind === "quota") {
              engine = "config";
              finalAiStatus = err.kind;
              reply = fallbackReply({
                kind: err.kind,
                detail: err.message,
                emergency: isEmergency,
                origin,
                askForLocation,
                placeUnresolved,
                search,
                searchPerformed,
              });
            } else {
              engine = "error";
              reply = errorReply({
                message: err.message,
                emergency: isEmergency,
                origin,
                search,
                searchPerformed,
              });
            }
          } else {
            engine = "error";
            reply = errorReply({
              message: "unexpected server error",
              emergency: isEmergency,
              origin,
              search,
              searchPerformed,
            });
          }
          send({ type: "replace", text: "" });
          for (const chunk of chunkText(reply)) send({ type: "delta", text: chunk });
        }

        if (req.signal.aborted) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          return;
        }

        send({ type: "done", reply, engine, aiStatus: finalAiStatus });
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  },
  { limit: 30, windowMs: 60_000, keyPrefix: "ai-chat" }
);

export const GET = withApi(async () => {
  const session = await getSession();
  if (!session) return ok({ sessions: [] });
  const sessions = await prisma.chatSession.findMany({
    where: { userId: session.sub },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return ok({ sessions });
});
