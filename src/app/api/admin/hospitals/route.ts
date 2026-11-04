import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, requireRole } from "@/lib/auth";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const reviewSchema = z.object({
  hospitalId: z.string().min(1).max(64),
  decision: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().trim().max(300).optional(),
});

export const GET = withApi(async (req) => {
  await requireRole("SUPER_ADMIN");
  const parsed = z.object({
    status: z.enum(["all", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"]).optional().default("all"),
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    pageSize: z.coerce.number().int().min(10).max(100).optional().default(50),
    q: z.string().trim().max(100).optional().default(""),
  }).safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(400, "Invalid hospital filters.");
  const { status, page, pageSize, q } = parsed.data;
  const searchWhere = q ? { OR: [
    { name: { contains: q, mode: "insensitive" as const } },
    { registrationNumber: { contains: q, mode: "insensitive" as const } },
    { city: { contains: q, mode: "insensitive" as const } },
    { state: { contains: q, mode: "insensitive" as const } },
    { email: { contains: q, mode: "insensitive" as const } },
  ] } : {};
  const where = status === "all" ? searchWhere : { ...searchWhere, status };
  const [hospitals, total, pendingCount, verifiedCount, rejectedCount] = await Promise.all([
    prisma.hospital.findMany({
      where,
      include: { beds: true, _count: { select: { doctors: true, services: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.hospital.count({ where }),
    prisma.hospital.count({ where: { ...searchWhere, status: "PENDING_VERIFICATION" } }),
    prisma.hospital.count({ where: { ...searchWhere, status: "VERIFIED" } }),
    prisma.hospital.count({ where: { ...searchWhere, status: "REJECTED" } }),
  ]);
  return ok({ hospitals, total, page, pageSize, counts: { PENDING_VERIFICATION: pendingCount, VERIFIED: verifiedCount, REJECTED: rejectedCount } });
});

export const POST = withApi(
  async (req) => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = await parseBody(req, reviewSchema);
    if (parsed.error) return parsed.error;
    const { hospitalId, decision, reason } = parsed.data;
    if (decision === "REJECTED" && (!reason || reason.length < 8)) {
      return fail(422, "Provide a clear rejection reason of at least 8 characters.");
    }

    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) return fail(404, "Hospital not found.");
    if (hospital.status !== "PENDING_VERIFICATION") return fail(409, "This hospital has already been reviewed.");

    const now = new Date();
    const ip = await getClientIp();
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.hospital.updateMany({
        where: { id: hospital.id, status: "PENDING_VERIFICATION" },
        data: {
          status: decision,
          verifiedAt: decision === "VERIFIED" ? now : null,
          verifiedBy: decision === "VERIFIED" ? session.email : null,
          rejectionReason: decision === "REJECTED" ? reason : null,
        },
      });
      if (claimed.count !== 1) return null;
      const updated = await tx.hospital.findUniqueOrThrow({ where: { id: hospital.id } });
      const admins = await tx.user.findMany({
        where: { hospitalId: hospital.id, role: "HOSPITAL_ADMIN" },
        select: { id: true, status: true, emailVerifiedAt: true },
      });
      for (const admin of admins) {
        await tx.user.update({
          where: { id: admin.id },
          data: {
            authVersion: { increment: 1 },
            ...(decision === "VERIFIED" && admin.status !== "SUSPENDED" && admin.emailVerifiedAt ? { status: "ACTIVE" } : {}),
          },
        });
      }
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            title: decision === "VERIFIED" ? "Hospital verified" : "Verification rejected",
            body: decision === "VERIFIED" ? `${hospital.name} is now verified.` : `Review note: ${reason}`,
            type: decision === "VERIFIED" ? "SUCCESS" : "WARNING",
            link: decision === "VERIFIED" ? "/hospital" : "/login",
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: session.sub,
          actorEmail: session.email,
          action: `HOSPITAL_${decision}`,
          entityType: "Hospital",
          entityId: hospital.id,
          meta: JSON.stringify({ name: hospital.name, linkedAdminCount: admins.length, rejectionReasonRecorded: decision === "REJECTED" }),
          ip,
        },
      });
      return updated;
    });
    if (!result) return fail(409, "This hospital has already been reviewed.");
    return ok({ hospital: result });
  },
  { limit: 20, windowMs: 60_000, keyPrefix: "admin-hospitals-review" }
);
