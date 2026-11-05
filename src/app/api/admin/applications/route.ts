import type { Hospital, HospitalApplication } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeErrorMetadata } from "@/lib/database-errors";
import { getClientIp, requireRole } from "@/lib/auth";
import { sendHospitalApplicationDecisionEmail } from "@/lib/email";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

class ReviewConflict extends Error {}

const reviewSchema = z.object({
  applicationId: z.string().min(1).max(64),
  decision: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().trim().max(300).optional(),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
});

export const GET = withApi(async (req) => {
  await requireRole("SUPER_ADMIN");
  const parsed = z.object({
    status: z.enum(["all", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"]).optional().default("all"),
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
    pageSize: z.coerce.number().int().min(10).max(100).optional().default(50),
    q: z.string().trim().max(100).optional().default(""),
  }).safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(400, "Invalid application filters.");
  const { status, page, pageSize, q } = parsed.data;
  const searchWhere = q ? { OR: [
    { hospitalName: { contains: q, mode: "insensitive" as const } },
    { registrationNumber: { contains: q, mode: "insensitive" as const } },
    { city: { contains: q, mode: "insensitive" as const } },
    { state: { contains: q, mode: "insensitive" as const } },
    { user: { email: { contains: q, mode: "insensitive" as const } } },
  ] } : {};
  const where = status === "all" ? searchWhere : { ...searchWhere, status };
  const [applications, total, pendingCount, verifiedCount, rejectedCount] = await Promise.all([
    prisma.hospitalApplication.findMany({
      where,
      select: {
        id: true,
        hospitalName: true,
        registrationNumber: true,
        hospitalType: true,
        addressLine: true,
        city: true,
        state: true,
        pincode: true,
        phone: true,
        email: true,
        website: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        reviewedAt: true,
        user: { select: { id: true, name: true, email: true, phone: true, emailVerifiedAt: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.hospitalApplication.count({ where }),
    prisma.hospitalApplication.count({ where: { ...searchWhere, status: "PENDING_VERIFICATION" } }),
    prisma.hospitalApplication.count({ where: { ...searchWhere, status: "VERIFIED" } }),
    prisma.hospitalApplication.count({ where: { ...searchWhere, status: "REJECTED" } }),
  ]);
  return ok({ applications, total, page, pageSize, counts: { PENDING_VERIFICATION: pendingCount, VERIFIED: verifiedCount, REJECTED: rejectedCount } });
});

export const POST = withApi(async (req) => {
  const session = await requireRole("SUPER_ADMIN");
  const parsed = await parseBody(req, reviewSchema);
  if (parsed.error) return parsed.error;
  const input = parsed.data;
  if (input.decision === "REJECTED" && (!input.reason || input.reason.length < 8)) {
    return fail(422, "Enter a clear rejection reason of at least 8 characters.");
  }
  if (input.decision === "VERIFIED" && (input.lat === undefined || input.lng === undefined)) {
    return fail(422, "Resolve and confirm the hospital's map location before approval.");
  }

  const application = await prisma.hospitalApplication.findUnique({
    where: { id: input.applicationId },
    include: { user: true },
  });
  if (!application) return fail(404, "Hospital application not found.");
  if (application.status !== "PENDING_VERIFICATION") return fail(409, "This application has already been reviewed.");
  if (application.user.role !== "HOSPITAL_ADMIN") return fail(409, "This application is not linked to a hospital administrator account.");
  if (application.user.hospitalId) return fail(409, "This account is already linked to a hospital.");
  if (input.decision === "VERIFIED" && application.user.status === "SUSPENDED") return fail(409, "A suspended applicant cannot be approved.");
  if (input.decision === "VERIFIED" && !application.user.emailVerifiedAt) return fail(409, "The applicant must verify their email before hospital approval.");

  const now = new Date();
  const ip = await getClientIp();
  let result: { application: HospitalApplication; hospital: Hospital | null } | null;
  try {
    result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.hospitalApplication.updateMany({
        where: { id: application.id, status: "PENDING_VERIFICATION" },
        data: {
          status: input.decision,
          reviewNote: input.decision === "REJECTED" ? input.reason : null,
          reviewedBy: session.email,
          reviewedAt: now,
        },
      });
      if (claimed.count !== 1) return null;

      if (input.decision === "VERIFIED" && application.registrationNumber) {
        const duplicate = await tx.hospital.findFirst({ where: { registrationNumber: application.registrationNumber }, select: { id: true } });
        if (duplicate) throw new ReviewConflict();
      }

      const reviewedApplication = await tx.hospitalApplication.findUniqueOrThrow({ where: { id: application.id } });
      const hospital = input.decision === "VERIFIED"
        ? await tx.hospital.create({
            data: {
              name: application.hospitalName,
              type: application.hospitalType,
              status: "VERIFIED",
              registrationNumber: application.registrationNumber,
              addressLine: application.addressLine,
              city: application.city,
              state: application.state,
              pincode: application.pincode,
              phone: application.phone,
              email: application.email,
              website: application.website,
              lat: input.lat!,
              lng: input.lng!,
              verifiedAt: now,
              verifiedBy: session.email,
            },
          })
        : null;
      const userChange = await tx.user.updateMany({
        where: {
          id: application.userId,
          ...(hospital ? { status: { not: "SUSPENDED" }, hospitalId: null } : {}),
        },
        data: {
          ...(hospital ? { hospitalId: hospital.id, status: "ACTIVE" } : {}),
          authVersion: { increment: 1 },
        },
      });
      if (userChange.count !== 1) throw new ReviewConflict();

      await tx.notification.create({
        data: {
          userId: application.userId,
          title: input.decision === "VERIFIED" ? "Hospital application approved" : "Hospital application not approved",
          body: input.decision === "VERIFIED"
            ? `${application.hospitalName} has been verified. You can now sign in to manage its hospital portal.`
            : `Your application for ${application.hospitalName} was not approved. Reason: ${input.reason}`,
          type: input.decision === "VERIFIED" ? "SUCCESS" : "WARNING",
          link: input.decision === "VERIFIED" ? "/hospital" : "/login?reason=hospital-rejected",
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: session.sub,
          actorEmail: session.email,
          action: `HOSPITAL_APPLICATION_${input.decision}`,
          entityType: "HospitalApplication",
          entityId: application.id,
          meta: JSON.stringify({ hospitalName: application.hospitalName, hospitalId: hospital?.id ?? null, rejectionReasonRecorded: input.decision === "REJECTED" }),
          ip,
        },
      });
      return { application: reviewedApplication, hospital };
    });
  } catch (error) {
    if (error instanceof ReviewConflict) return fail(409, "The application or account changed during review. Refresh and check its current status.");
    throw error;
  }
  if (!result) return fail(409, "This application has already been reviewed.");

  let emailSent = false;
  try {
    await sendHospitalApplicationDecisionEmail({
      to: application.user.email,
      name: application.user.name,
      hospitalName: application.hospitalName,
      decision: input.decision,
      reason: input.reason,
    });
    emailSent = true;
  } catch (error) {
    console.error("[admin] hospital decision email could not be sent", safeErrorMetadata(error));
  }
  return ok({ ...result, emailSent });
}, { limit: 20, windowMs: 60_000, keyPrefix: "admin-applications" });
