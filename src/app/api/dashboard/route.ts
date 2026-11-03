import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { rankHospitals } from "@/lib/scoring";
import { loadVerifiedHospitals } from "@/lib/hospital-service";
import { DEFAULT_CENTER } from "@/lib/constants";
import { fail, ok, withApi } from "@/lib/api-helpers";
import { z } from "zod";

/** Aggregated patient dashboard payload. */
const coordinatesSchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
});

export const GET = withApi(async (req) => {
  const session = await requireRole("PATIENT");
  const params = new URL(req.url).searchParams;
  const lat = params.get("lat");
  const lng = params.get("lng");
  let location: { lat: number; lng: number } | undefined;
  if (lat !== null || lng !== null) {
    if (!lat?.trim() || !lng?.trim()) return fail(400, "Provide both latitude and longitude.");
    const parsedLocation = coordinatesSchema.safeParse({ lat, lng });
    if (!parsedLocation.success) return fail(400, "Location coordinates are invalid.");
    location = parsedLocation.data;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { location: true },
  });

  const [hospitalsRaw, recentSearches, saved, unreadNotifications] =
    await Promise.all([
      loadVerifiedHospitals({ includeDemo: session.isDemo === true }),
      prisma.searchRecord.findMany({
        where: { userId: session.sub },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.savedHospital.findMany({
        where: { userId: session.sub, hospital: { is: { status: "VERIFIED", ...(session.isDemo ? {} : { isDemo: false }) } } },
        include: {
          hospital: {
            select: {
              id: true,
              name: true,
              city: true,
              type: true,
              phone: true,
              lat: true,
              lng: true,
              lastAvailabilityUpdate: true,
              isDemo: true,
              beds: { where: { category: { in: ["GENERAL", "ICU"] } } },
            },
          },
        },
        take: 4,
      }),
      prisma.notification.count({
        where: { userId: session.sub, read: false },
      }),
    ]);

  const rankedNearby = rankHospitals(hospitalsRaw, {
    requiresEmergency: false,
    location: location ?? DEFAULT_CENTER,
  }).slice(0, 4);

  const emergencyFacilities = hospitalsRaw.filter(
    (h) =>
      h.services.some(
        (s) => s.key === "EMERGENCY" && s.status !== "UNAVAILABLE"
      )
  ).length;

  return ok({
    greetingName:
      session.name?.trim().split(" ")[0] ||
      session.email?.split("@")[0]?.trim() ||
      "there",
    location: user?.location ?? null,
    cards: {
      nearbyHospitals: hospitalsRaw.length,
      emergencyFacilities,
    },
    nearby: rankedNearby.map((r) => ({
      id: r.hospital.id,
      name: r.hospital.name,
      city: r.hospital.city,
      type: r.hospital.type,
      score: r.score,
      lat: r.hospital.lat,
      lng: r.hospital.lng,
      icuAvailable:
        r.hospital.beds.find((b) => b.category === "ICU")?.available ?? 0,
      generalAvailable:
        r.hospital.beds.find((b) => b.category === "GENERAL")?.available ?? 0,
      emergencyActive: r.hospital.services.some(
        (s) => s.key === "EMERGENCY" && s.status !== "UNAVAILABLE"
      ),
    })),
    recentSearches,
    saved,
    unreadNotifications,
  });
});
