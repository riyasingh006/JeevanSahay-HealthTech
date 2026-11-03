import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const readSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  all: z.boolean().optional(),
}).refine((value) => value.all === true || Boolean(value.id));

export const GET = withHospitalApi(async (_req, { session }) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({ notifications });
});

export const PATCH = withHospitalApi(async (req, { session }) => {
  const parsed = await parseBody(req, readSchema);
  if (parsed.error) return parsed.error;
  if (parsed.data.all) {
    const result = await prisma.notification.updateMany({
      where: { userId: session.sub, read: false },
      data: { read: true },
    });
    return ok({ updated: result.count });
  }
  const result = await prisma.notification.updateMany({
    where: { id: parsed.data.id, userId: session.sub, read: false },
    data: { read: true },
  });
  if (result.count !== 1) return fail(404, "Notification not found or already read.");
  return ok({ updated: 1 });
}, { limit: 60, windowMs: 60_000, keyPrefix: "hospital-notifications" });
