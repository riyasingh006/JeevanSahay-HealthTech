import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

export const GET = withApi(async () => {
  const session = await requireRole("PATIENT");
  const notifications = await prisma.notification.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok({
    notifications,
    unread: notifications.filter((n) => !n.read).length,
  });
});

export const PATCH = withApi(
  async (req) => {
    const session = await requireRole("PATIENT");
    const schema = z.object({ id: z.string().optional(), all: z.boolean().optional() });
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;

    if (parsed.data.all) {
      await prisma.notification.updateMany({
        where: { userId: session.sub, read: false },
        data: { read: true },
      });
      return ok({ updatedAll: true });
    }

    if (!parsed.data.id) return fail(400, "Provide notification id or all=true.");
    await prisma.notification.updateMany({
      where: { id: parsed.data.id, userId: session.sub },
      data: { read: true },
    });
    return ok({ updated: true });
  },
  { limit: 90, windowMs: 60_000, keyPrefix: "notif" }
);
