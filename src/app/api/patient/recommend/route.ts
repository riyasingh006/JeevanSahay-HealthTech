import { z } from "zod";
import { rankHospitals, type ScoredHospital } from "@/lib/scoring";
import { loadVerifiedHospitals } from "@/lib/hospital-service";
import { interpretQuery } from "@/lib/nlp";
import { ok, parseBody, withApi } from "@/lib/api-helpers";
import { requireRole } from "@/lib/auth";
import { recordPatientSearch } from "@/lib/patient/search-history";
import {
  SPECIALTIES,
  SERVICE_CATALOG,
  DEFAULT_CENTER,
} from "@/lib/constants";
import { haversineKm } from "@/lib/utils";

/**
 * AI-Powered Hospital Discovery — patient portal "Find Hospitals".
 *
 * Interprets the patient's free-text healthcare need (LLM when configured,
 * deterministic rule engine otherwise), then searches and ranks REAL nearby
 * hospitals through the same infrastructure as /api/hospitals/search
 * (loadVerifiedHospitals + rankHospitals). No hospitals, ratings or slots are
 * ever invented — unavailable factors are ignored, never estimated.
 */

const schema = z.object({
  need: z.string().trim().min(10).max(600),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

const SPECIALTY_KEYS = SPECIALTIES.map((s) => s.key) as string[];
const SERVICE_KEYS = SERVICE_CATALOG.map((s) => s.key) as string[];

interface AiIntent {
  specialty: string | null;
  service: string | null;
  urgency: "EMERGENCY" | "URGENT" | "ROUTINE";
  prefersGovernment: boolean;
  prefersPrivate: boolean;
  requiresIcu: boolean;
  requiresDiagnostics: boolean;
  summary: string;
  source: "ai" | "rules";
}

const SYSTEM_PROMPT = `You are the healthcare-navigation intent parser for Jeevan Sahay, an Indian hospital-finder.

STRICT RULES:
1. You NEVER diagnose, never claim the user has a disease, never prescribe treatment, never replace a doctor.
2. Your only job: read the patient's free-text healthcare need and return STRICT JSON describing which hospital department/service would be relevant for NAVIGATION purposes.
3. Output ONLY minified JSON, no prose, matching exactly:
{"specialty":string|null,"service":string|null,"urgency":"EMERGENCY"|"URGENT"|"ROUTINE","prefersGovernment":boolean|null,"prefersPrivate":boolean|null,"requiresIcu":boolean,"requiresDiagnostics":boolean,"summary":string}
4. "specialty" must be one of: ${SPECIALTY_KEYS.join(", ")} — or null when unclear.
5. "service" must be one of: ${SERVICE_KEYS.join(", ")} — or null when unclear.
6. "summary": one short sentence (max 160 chars) starting with "Based on the information you provided," using careful navigation language such as "suggested healthcare options" or "relevant department". NEVER state or imply a diagnosis.
7. Set urgency to EMERGENCY only for clear red-flag descriptions (e.g. chest pain, heavy bleeding, unconsciousness, stroke signs).`;

/** LLM intent extraction; returns null on any failure (caller falls back). */
async function extractIntentWithAi(need: string): Promise<Omit<AiIntent, "source"> | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 220,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: need },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const str = (v: unknown, allowed: string[] | null) =>
      typeof v === "string" && (!allowed || allowed.includes(v)) ? v : null;
    const bool = (v: unknown) => (typeof v === "boolean" ? v : false);
    const urgencyRaw = str(parsed.urgency, ["EMERGENCY", "URGENT", "ROUTINE"]);
    const summaryRaw =
      typeof parsed.summary === "string" ? parsed.summary.slice(0, 200) : "";
    return {
      specialty: str(parsed.specialty, SPECIALTY_KEYS),
      service: str(parsed.service, SERVICE_KEYS),
      urgency: (urgencyRaw as AiIntent["urgency"]) ?? "ROUTINE",
      prefersGovernment:
        bool(parsed.prefersGovernment) && !bool(parsed.prefersPrivate),
      prefersPrivate: bool(parsed.prefersPrivate),
      requiresIcu: bool(parsed.requiresIcu),
      requiresDiagnostics: bool(parsed.requiresDiagnostics),
      summary: summaryRaw,
    };
  } catch {
    return null;
  }
}

function intentFromRules(need: string): Omit<AiIntent, "source"> {
  const p = interpretQuery(need);
  const q = need.toLowerCase();
  const service =
    SERVICE_CATALOG.find((s) =>
      q.includes(s.label.split(" ")[0].toLowerCase())
    )?.key ?? null;
  return {
    specialty: p.specialty ?? null,
    service,
    urgency: p.urgency,
    prefersGovernment: /\bgovt?\b|government|sarkar/.test(q),
    prefersPrivate: /\bprivate\b/.test(q),
    requiresIcu: Boolean(p.requiresIcu),
    requiresDiagnostics: Boolean(p.requiresDiagnostics),
    summary:
      "Based on the information you provided, we looked for suitable healthcare options near you.",
  };
}

export const POST = withApi(
  async (req) => {
    await requireRole("PATIENT");
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { need, lat, lng } = parsed.data;
    await recordPatientSearch(need, "AI");

    // 1–2. Interpret the need (AI first, deterministic rules as fallback).
    const aiIntent = await extractIntentWithAi(need);
    const intent: AiIntent = aiIntent
      ? { ...aiIntent, source: "ai" }
      : { ...intentFromRules(need), source: "rules" };

    // 3. Search nearby hospitals using the EXISTING hospital infrastructure.
    const location = lat != null && lng != null ? { lat, lng } : DEFAULT_CENTER;
    let candidates = await loadVerifiedHospitals();

    // Proximity gate — mirrors /api/hospitals/search maxDistance ceiling so
    // "near me" stays honest (no results rather than far-away matches).
    const nearbyKm = 100;
    candidates = candidates.filter(
      (h) => haversineKm(location, { lat: h.lat, lng: h.lng }) <= nearbyKm
    );

    if (intent.service) {
      candidates = candidates.filter((h) =>
        h.services.some(
          (s) => s.key === intent.service && s.status !== "UNAVAILABLE"
        )
      );
    }
    if (intent.prefersGovernment) {
      candidates = candidates.filter(
        (h) => h.type === "GOVERNMENT" || h.type === "PSU" || h.type === "TRUST"
      );
      if (candidates.length < 3)
        candidates = await loadVerifiedHospitals(); // preference is soft — never starve results
    }

    const ranked: ScoredHospital<(typeof candidates)[number]>[] = rankHospitals(
      candidates,
      {
        specialty: intent.specialty ?? undefined,
        requiresIcu: intent.requiresIcu,
        requiresEmergency: intent.urgency === "EMERGENCY",
        requiresDiagnostics: intent.requiresDiagnostics,
        location,
      }
    );

    // 8. Transparent top-4 selection — only real ranked candidates.
    const matches = ranked.slice(0, 4);

    const specialtyLabel = intent.specialty
      ? (SPECIALTIES.find((s) => s.key === intent.specialty)?.label ?? null)
      : null;
    const serviceLabel = intent.service
      ? (SERVICE_CATALOG.find((s) => s.key === intent.service)?.label ?? null)
      : null;

    return ok({
      matches: matches.map((m) => ({
        ...m,
        why: buildWhy(m, intent),
      })),
      interpretation: {
        specialtyLabel,
        serviceLabel,
        urgency: intent.urgency,
        prefersGovernment: intent.prefersGovernment,
        source: intent.source,
        summary: intent.summary,
        totalCandidates: ranked.length,
      },
    });
  },
  { limit: 12, windowMs: 60_000, keyPrefix: "recommend" }
);

/** Facts-only explanation bullets — mirrors scoring.buildReasons vocabulary. */
function buildWhy(
  m: {
    reasons: string[];
    hospital: {
      services: { key: string; status: string }[];
      beds: { category: string; available: number }[];
      doctors: { specialty: string; availability: string }[];
      type: string;
    };
  },
  intent: AiIntent
): string[] {
  const why: string[] = [...m.reasons];
  const has = (key: string) =>
    m.hospital.services.some((s) => s.key === key && s.status !== "UNAVAILABLE");

  if (intent.specialty) {
    const relevant = m.hospital.doctors.filter(
      (d) => d.specialty === intent.specialty
    );
    const active = relevant.filter((d) => d.availability !== "UNAVAILABLE");
    if (active.length > 0)
      why.push(`${active.length} relevant specialist${active.length > 1 ? "s" : ""} listed`);
  }
  if (intent.service && has(intent.service)) {
    const label = SERVICE_CATALOG.find((s) => s.key === intent.service)?.label;
    if (label && !why.some((w) => w.includes(label)))
      why.push(`${label} available`);
  }
  if (
    intent.urgency === "EMERGENCY" &&
    has("EMERGENCY") &&
    !why.some((w) => w.toLowerCase().includes("emergency"))
  ) {
    why.push("Emergency facility available");
  }
  const general = m.hospital.beds.find((b) => b.category === "GENERAL");
  if (general && general.available > 0)
    why.push(`${general.available} general beds free`);
  if (intent.prefersGovernment && (m.hospital.type === "GOVERNMENT" || m.hospital.type === "PSU"))
    why.push("Matches your government-facility preference");

  return Array.from(new Set(why)).slice(0, 6);
}
