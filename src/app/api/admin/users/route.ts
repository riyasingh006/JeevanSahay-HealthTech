import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, requireRole } from "@/lib/auth";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const roles = ["PATIENT", "HOSPITAL_ADMIN", "SUPER_ADMIN"] as const;
const statuses = ["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED"] as const;

export const GET = withApi(async (req) => {
  await requireRole("SUPER_ADMIN");
  const url = new URL(req.url);
  const query = z.object({
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    pageSize: z.coerce.number().int().min(10).max(100).optional().default(50),
    q: z.string().trim().max(100).optional().default(""),
    role: z.enum(["all", ...roles]).optional().default("all"),
    status: z.enum(["all", ...statuses]).optional().default("all"),
  }).safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return fail(400, "Invalid account filters.");
  const { page, pageSize, q, role, status } = query.data;
  const where = {
    ...(role !== "all" ? { role } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(q ? { OR: [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { hospital: { name: { contains: q } } },
    ] } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        isDemo: true,
        hospitalId: true,
        hospital: { select: { name: true, status: true } },
        emailVerifiedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return ok({ users, total, page, pageSize });
});

export const PATCH = withApi(
  async (req) => {
    const session = await requireRole("SUPER_ADMIN");
    const schema = z.object({ userId: z.string().min(1).max(64), status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict();
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { userId, status } = parsed.data;
    if (userId === session.sub && status === "SUSPENDED") return fail(422, "You cannot suspend your own account.");

    const ip = await getClientIp();
    const outcome = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) return { kind: "missing" as const };
      if (user.status === status) return { kind: "unchanged" as const, user };
      if (user.role === "SUPER_ADMIN" && user.status === "ACTIVE" && status === "SUSPENDED") {
        const activeAdmins = await tx.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
        if (activeAdmins <= 1) return { kind: "last-admin" as const };
      }
      const changed = await tx.user.updateMany({
        where: { id: userId, status: user.status },
        data: { status, authVersion: { increment: 1 } },
      });
      if (changed.count !== 1) return { kind: "conflict" as const };
      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: session.sub,
          actorEmail: session.email,
          action: status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED",
          entityType: "User",
          entityId: userId,
          meta: JSON.stringify({ priorStatus: user.status, status }),
          ip,
        },
      });
      return { kind: "updated" as const, user: updated };
    });
    if (outcome.kind === "missing") return fail(404, "User not found.");
    if (outcome.kind === "last-admin") return fail(409, "The last active super-admin cannot be suspended.");
    if (outcome.kind === "conflict") return fail(409, "This account changed elsewhere. Refresh and try again.");
    return ok({ user: { id: outcome.user.id, name: outcome.user.name, email: outcome.user.email, role: outcome.user.role, status: outcome.user.status } });
  },
  { limit: 30, windowMs: 60_000, keyPrefix: "admin-users" }
);
