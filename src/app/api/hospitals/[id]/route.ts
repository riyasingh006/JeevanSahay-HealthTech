import { prisma } from "@/lib/prisma";
import { loadHospitalById } from "@/lib/hospital-service";
import { getSession } from "@/lib/auth";
import { fail, idFromUrl, ok, withApi } from "@/lib/api-helpers";
import { FRESHNESS_MS } from "@/lib/constants";
import {
  GOOGLE_ID_PREFIX,
  GoogleApiError,
  getPlaceDetails,
  googleKeyConfigured,
} from "@/lib/google-places";

export const GET = withApi(
  async (_req) => {
    const id = idFromUrl(_req);
    if (!id) return fail(400, "Hospital id is required.");

    // ---- Live Google Places listing (external hospital) ----
    if (id.startsWith(GOOGLE_ID_PREFIX)) {
      if (!googleKeyConfigured())
        return fail(
          503,
          "Live hospital details are not configured. Set GOOGLE_MAPS_API_KEY on the server."
        );
      const placeId = id.slice(GOOGLE_ID_PREFIX.length);
      try {
        const place = await getPlaceDetails(placeId);
        if (!place) return fail(404, "Hospital not found.");
        return ok({
          hospital: {
            id,
            name: place.name,
            shortName: null,
            type: "",
            status: "EXTERNAL",
            addressLine: place.address,
            city: place.locality ?? "",
            state: place.state ?? "",
            pincode: place.postalCode ?? "",
            phone: place.phone ?? "",
            emergencyPhone: null,
            email: null,
            website: place.website ?? null,
            about: null,
            isDemo: false,
            accreditation: null,
            established: null,
            lastAvailabilityUpdate: new Date().toISOString(),
            lat: place.lat,
            lng: place.lng,
            beds: [] as { category: string; total: number; available: number }[],
            services: [] as { key: string; status: string }[],
            source: "google" as const,
            rating: place.rating,
            userRatingCount: place.userRatingCount,
            googleMapsUri: place.googleMapsUri,
            primaryType: place.primaryTypeDisplayName,
            openNow: place.openNow,
            businessStatus: place.businessStatus,
          },
          doctors: [],
          stale: false,
        });
      } catch (err) {
        if (err instanceof GoogleApiError) return fail(err.status, err.message);
        throw err;
      }
    }

    // ---- Internal verified directory ----
    const session = await getSession();
    const hospital = await loadHospitalById(id, { includeDemo: session?.isDemo === true });
    if (!hospital) return fail(404, "Hospital not found.");

    // Public users only see verified hospitals.
    if (hospital.status !== "VERIFIED") return fail(404, "Hospital not found.");

    const doctorsFull = await prisma.doctor.findMany({
      where: { hospitalId: id },
      orderBy: [{ availability: "asc" }, { experienceYears: "desc" }],
    });

    return ok({
      hospital,
      doctors: doctorsFull,
      stale:
        Date.now() -
          new Date(hospital.lastAvailabilityUpdate).getTime() >
        FRESHNESS_MS,
    });
  },
  { limit: 120, windowMs: 60_000, keyPrefix: "hosp-detail" }
);
