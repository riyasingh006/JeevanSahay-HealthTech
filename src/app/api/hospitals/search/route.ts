import { z } from "zod";
import { rankHospitals } from "@/lib/scoring";
import { loadVerifiedHospitals } from "@/lib/hospital-service";
import { interpretQuery } from "@/lib/nlp";
import { fail, ok, withApi } from "@/lib/api-helpers";
import { DEFAULT_CENTER, SERVICE_CATALOG, SPECIALTIES } from "@/lib/constants";
import { estimateEtaMinutes, haversineKm } from "@/lib/utils";
import { recordPatientSearch } from "@/lib/patient/search-history";

import {
  GoogleApiError,
  googleKeyConfigured,
  searchNearbyHospitals,
  searchTextHospitals,
  type PlaceResult,
} from "@/lib/google-places";

const querySchema = z.object({
  q: z.string().trim().max(300).optional(),
  specialty: z.string().trim().max(40).optional(),
  type: z.string().trim().max(20).optional(),
  service: z.string().trim().max(40).optional(),
  emergency: z.string().optional(),
  icu: z.string().optional(),
  beds: z.string().optional(),
  diagnostics: z.string().optional(),
  maxDistance: z.coerce.number().min(0.5).max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  /** "places" = live Google Places API (New). Omitted = internal directory. */
  provider: z.string().trim().max(20).optional(),
});

type Params = z.infer<typeof querySchema>;

/** Compose a natural-language hospital query from the active filter set. */
function buildPlacesQuery(params: Params): string {
  const parts: string[] = [];
  const q = params.q?.trim();
  const lower = (q ?? "").toLowerCase();

  if (q) parts.push(q);

  if (params.specialty && params.specialty !== "ALL") {
    const spec = SPECIALTIES.find((s) => s.key === params.specialty);
    if (spec && !lower.includes(spec.label.toLowerCase()))
      parts.push(spec.label);
  }

  if (params.service && params.service !== "ANY") {
    const svc = SERVICE_CATALOG.find((s) => s.key === params.service);
    if (svc && !lower.includes(svc.label.toLowerCase())) parts.push(svc.label);
  }

  if (params.emergency === "1" && !lower.includes("emergency"))
    parts.push("emergency");

  if (params.type === "GOVERNMENT" || params.type === "PSU") {
    if (!lower.includes("government")) parts.push("government");
  } else if (params.type === "TRUST" && !lower.includes("trust")) {
    parts.push("trust");
  }

  if (parts.length === 0) parts.push("hospital");
  return parts.join(" ");
}

function patientHistoryLabel(params: Params): string {
  const parts = params.q ? [params.q.trim()] : [];
  if (params.specialty && params.specialty !== "ALL") {
    const specialty = SPECIALTIES.find((item) => item.key === params.specialty);
    parts.push(specialty?.label ?? "specialist");
  }
  if (params.type) parts.push(params.type.toLowerCase());
  if (params.service && params.service !== "ANY") {
    const service = SERVICE_CATALOG.find((item) => item.key === params.service);
    parts.push(service?.label ?? "healthcare service");
  }
  if (params.emergency === "1") parts.push("emergency care");
  if (params.icu === "1") parts.push("ICU beds");
  if (params.beds === "1") parts.push("available beds");
  if (params.diagnostics === "1") parts.push("diagnostics");
  return parts.join(" · ").slice(0, 300);
}

function toSearchResult(place: PlaceResult, origin: { lat: number; lng: number }) {
  const distanceKm = haversineKm(origin, { lat: place.lat, lng: place.lng });
  return {
    hospital: {
      id: `gplaces_${place.placeId}`,
      name: place.name,
      type: "",
      city: place.locality ?? "",
      addressLine: place.address,
      phone: place.phone ?? "",
      lat: place.lat,
      lng: place.lng,
      lastAvailabilityUpdate: undefined as string | undefined,
      beds: [] as { category: string; total: number; available: number }[],
      services: [] as { key: string; status: string }[],
      doctors: [] as {
        specialty: string;
        availability: string;
        experienceYears?: number;
      }[],
    },
    score: undefined as number | undefined,
    distanceKm,
    etaMinutes: estimateEtaMinutes(distanceKm),
    source: "google" as const,
    typeLabel: place.primaryTypeDisplayName ?? "Hospital",
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    primaryType: place.primaryTypeDisplayName,
    openingStatus:
      place.openNow === true
        ? "Open now"
        : place.openNow === false
          ? "Closed now"
          : undefined,
    website: place.website,
    googleMapsUri: place.googleMapsUri,
    businessStatus: place.businessStatus,
  };
}

async function placesSearch(params: Params) {
  if (!googleKeyConfigured()) {
    return fail(
      503,
      "Live hospital search is not configured. Set GOOGLE_MAPS_API_KEY on the server to enable Google Places results."
    );
  }

  const hasOrigin = params.lat != null && params.lng != null;
  const origin = hasOrigin
    ? { lat: params.lat as number, lng: params.lng as number }
    : { ...DEFAULT_CENTER };

  const maxDistance = params.maxDistance ?? 50;
  const radiusMeters = Math.min(Math.max(Math.round(maxDistance * 1000), 500), 50000);
  const userQuery = params.q?.trim() ?? "";
  const query = buildPlacesQuery(params).trim();

  let places: PlaceResult[];
  try {
    if (userQuery) {
      // A user-typed query must drive Google's relevance ranking. Sending a
      // locationBias here would make Google ignore the text and return generic
      // nearby hospitals (including for nonsense queries), so we search
      // without bias and handle proximity ourselves below.
      places = await searchTextHospitals({ query, limit: params.limit });
    } else {
      places = await searchNearbyHospitals({
        lat: origin.lat,
        lng: origin.lng,
        radiusMeters,
        limit: params.limit,
      });
    }
  } catch (err) {
    if (err instanceof GoogleApiError) return fail(err.status, err.message);
    throw err;
  }

  const mapped = places.map((p) => toSearchResult(p, origin));
  const withinRadius = mapped.filter((r) => r.distanceKm <= maxDistance);

  // Nearby browsing honours the radius strictly. A named search keeps the
  // radius when it matches anything, otherwise relaxes it so a hospital the
  // user explicitly searched for is never silently hidden.
  const results = (userQuery && withinRadius.length === 0 && mapped.length > 0
      ? mapped
      : withinRadius
    ).sort((a, b) => a.distanceKm - b.distanceKm);

  await recordPatientSearch(patientHistoryLabel(params), "SEARCH");
  return ok({
    results,
    totalMatched: results.length,
    source: "google" as const,
    origin,
    originIsDefault: !hasOrigin,
  });
}

export const GET = withApi(
  async (req) => {
    const url = new URL(req.url);
    const params = querySchema.parse(Object.fromEntries(url.searchParams));

    if (params.provider === "places") return placesSearch(params);

    const need = {
      specialty: params.specialty || undefined,
      requiresIcu: params.icu === "1",
      requiresEmergency: params.emergency === "1",
      requiresDiagnostics:
        params.diagnostics === "1" ||
        (params.service ? params.service.includes("DIAGNOSTIC") : false),
      location:
        params.lat != null && params.lng != null
          ? { lat: params.lat, lng: params.lng }
          : { ...DEFAULT_CENTER },
    };

    const parsedText = params.q ? interpretQuery(params.q) : null;
    if (parsedText) {
      if (!need.specialty && parsedText.specialty) {
        // Only adopt text-derived specialty when not explicitly filtered.
        if (!params.specialty) need.specialty = parsedText.specialty;
      }
      if (!need.requiresIcu && parsedText.requiresIcu) need.requiresIcu = true;
      if (!need.requiresEmergency && parsedText.requiresEmergency)
        need.requiresEmergency = true;
      if (!need.requiresDiagnostics && parsedText.requiresDiagnostics)
        need.requiresDiagnostics = true;
    }

    let hospitals = await loadVerifiedHospitals();

    // Hard filters (capability gates, not ranking signals).
    if (params.type) hospitals = hospitals.filter((h) => h.type === params.type);
    if (params.service)
      hospitals = hospitals.filter((h) =>
        h.services.some((s) => s.key === params.service && s.status !== "UNAVAILABLE")
      );
    if (params.emergency === "1")
      hospitals = hospitals.filter(
        (h) =>
          h.services.some(
            (s) => s.key === "EMERGENCY" && s.status !== "UNAVAILABLE"
          ) &&
          (h.beds.find((b) => b.category === "EMERGENCY")?.available ?? 0) > 0
      );
    if (params.icu === "1")
      hospitals = hospitals.filter(
        (h) =>
          h.services.some((s) => s.key === "ICU" && s.status !== "UNAVAILABLE") &&
          (h.beds.find((b) => b.category === "ICU")?.available ?? 0) > 0
      );
    if (params.beds === "1")
      hospitals = hospitals.filter(
        (h) =>
          (h.beds.find((b) => b.category === "GENERAL")?.available ?? 0) > 0
      );
    if (need.specialty)
      hospitals = hospitals.filter((h) =>
        h.doctors.some((d) => d.specialty === need.specialty)
      );
    if (params.maxDistance != null)
      hospitals = hospitals.filter(
        (h) =>
          haversineKm(need.location!, { lat: h.lat, lng: h.lng }) <= params.maxDistance!
      );

    const ranked = rankHospitals(hospitals, need);

    await recordPatientSearch(patientHistoryLabel(params), "SEARCH");
    return ok({
      results: ranked.slice(0, params.limit),
      totalMatched: ranked.length,
      appliedNeed: {
        ...parsedText,
        specialty: need.specialty,
        requiresIcu: need.requiresIcu,
        requiresEmergency: need.requiresEmergency,
        requiresDiagnostics: need.requiresDiagnostics,
      },
    });
  },
  { limit: 60, windowMs: 60_000, keyPrefix: "search" }
);
