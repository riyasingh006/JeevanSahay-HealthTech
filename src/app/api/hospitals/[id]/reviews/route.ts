import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { fail, idFromUrl, ok, parseBody, withApi } from "@/lib/api-helpers";

export const GET = withApi(
  async (_req) => {
    const id = idFromUrl(_req);
    if (!id) return fail(400, "Hospital id is required.");
    const hospital = await prisma.hospital.findFirst({ where: { id, status: "VERIFIED", isDemo: false }, select: { id: true } });
    if (!hospital) return fail(404, "Hospital not found.");
    const reviews = await prisma.review.findMany({
      where: { hospitalId: id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return ok({ reviews });
  },
  { limit: 90 }
);

export const POST = withApi(
  async (req) => {
    const session = await requireRole("PATIENT");
    if (session.isDemo) return fail(403, "Reviews are disabled for demo accounts.");
    const hospitalId = idFromUrl(req);
    if (!hospitalId) return fail(400, "Hospital id is required.");

    const schema = z.object({
      rating: z.coerce.number().int().min(1).max(5),
      comment: z.string().trim().min(4).max(600),
    });
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;

    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital || hospital.status !== "VERIFIED" || hospital.isDemo)
      return fail(404, "Hospital not found.");

    const existing = await prisma.review.findFirst({
      where: { userId: session.sub, hospitalId },
    });
    if (existing)
      return fail(409, "You have already submitted a review for a facility.");

    const review = await prisma.review.create({
      data: {
        hospitalId,
        userId: session.sub,
        name: session.name?.trim() || session.email || "Anonymous",
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
    });
    return ok({ review });
  },
  { limit: 5, windowMs: 10 * 60_000, keyPrefix: "review" }
);
