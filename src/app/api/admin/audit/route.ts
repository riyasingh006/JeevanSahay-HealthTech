import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { fail, ok, withApi } from "@/lib/api-helpers";

const querySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  action: z.string().trim().max(80).optional().default(""),
  from: z.string().max(40).optional().default(""),
  to: z.string().max(40).optional().default(""),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
});

function parseDate(value: string, endOfDay: boolean): Date | undefined {
  if (!value) return undefined;
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`)
    : new Date(value);
  return Number.isNaN(dateValue.getTime()) ? undefined : dateValue;
}

export const GET = withApi(async (req) => {
  await requireRole("SUPER_ADMIN");
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(400, "Invalid audit filters.");
  const { q, action, from, to, page } = parsed.data;
  const start = parseDate(from, false);
  const end = parseDate(to, true);
  if ((from && !start) || (to && !end)) return fail(400, "Date filters must be valid dates.");
  if (start && end && start > end) return fail(400, "The start date must not be after the end date.");
  const where = {
    ...(action ? { action: { contains: action } } : {}),
    ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}),
    ...(q ? { OR: [
      { action: { contains: q } },
      { entityType: { contains: q } },
      { actorEmail: { contains: q } },
      { entityId: { contains: q } },
    ] } : {}),
  };
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return ok({ entries, total, page, pageSize: 50 });
}, { limit: 60, windowMs: 60_000, keyPrefix: "admin-audit" });
