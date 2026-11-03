import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

export const GET = withApi(async () => {
  const session = await requireRole("PATIENT");
  const saved = await prisma.savedHospital.findMany({
    where: { userId: session.sub, hospital: { is: { status: "VERIFIED" } } },
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
          beds: { where: { category: { in: ["GENERAL", "ICU"] } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return ok({ saved });
});

export const POST = withApi(
  async (req) => {
    const session = await requireRole("PATIENT");
    const schema = z.object({ hospitalId: z.string().min(1) });
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;

    const hospital = await prisma.hospital.findUnique({
      where: { id: parsed.data.hospitalId },
    });
    if (!hospital || hospital.status !== "VERIFIED")
      return fail(404, "Hospital not found.");

    await prisma.savedHospital.upsert({
      where: {
        userId_hospitalId: {
          userId: session.sub,
          hospitalId: parsed.data.hospitalId,
        },
      },
      create: { userId: session.sub, hospitalId: parsed.data.hospitalId },
      update: {},
    });
    return ok({ saved: true });
  },
  { limit: 30, windowMs: 60_000, keyPrefix: "save-hosp" }
);

export const DELETE = withApi(
  async (req) => {
    const session = await requireRole("PATIENT");
    const url = new URL(req.url);
    const hospitalId = url.searchParams.get("hospitalId") ?? "";
    if (!hospitalId) return fail(400, "hospitalId is required.");

    await prisma.savedHospital.deleteMany({
      where: { userId: session.sub, hospitalId },
    });
    return ok({ removed: true });
  },
  { limit: 30, windowMs: 60_000, keyPrefix: "unsave-hosp" }
);
