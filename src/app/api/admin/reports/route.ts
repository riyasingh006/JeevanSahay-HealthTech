import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, requireRole } from "@/lib/auth";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";
import { isEmailDeliveryConfigured, sendPortalNoticeEmail } from "@/lib/email";

const reportStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
const querySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z.enum(["ALL", ...reportStatuses]).optional().default("OPEN"),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.coerce.number().int().min(10).max(100).optional().default(50),
});

const transitions: Record<(typeof reportStatuses)[number], (typeof reportStatuses)[number][]> = {
  OPEN: ["IN_REVIEW", "RESOLVED", "DISMISSED"],
  IN_REVIEW: ["OPEN", "RESOLVED", "DISMISSED"],
  RESOLVED: ["OPEN"],
  DISMISSED: ["OPEN"],
};

export const GET = withApi(async (req) => {
  await requireRole("SUPER_ADMIN");
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(400, "Invalid report filters.");
  const { q, status, page, pageSize } = parsed.data;
  const where = {
    ...(status === "ALL" ? {} : { status }),
    ...(q ? { OR: [
      { subject: { contains: q, mode: "insensitive" as const } },
      { message: { contains: q, mode: "insensitive" as const } },
      { category: { contains: q, mode: "insensitive" as const } },
      { relatedHospital: { contains: q, mode: "insensitive" as const } },
      { reporterName: { contains: q, mode: "insensitive" as const } },
      { contactEmail: { contains: q, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.report.count({ where }),
  ]);
  return ok({ reports, total, page, pageSize });
});

export const PATCH = withApi(
  async (req) => {
    const session = await requireRole("SUPER_ADMIN");
    const schema = z.object({
      reportId: z.string().min(1).max(64),
      expectedStatus: z.enum(reportStatuses),
      status: z.enum(reportStatuses),
      resolutionNote: z.string().trim().max(400).optional(),
    });
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { reportId, expectedStatus, status, resolutionNote } = parsed.data;
    if ((status === "RESOLVED" || status === "DISMISSED") && (!resolutionNote || resolutionNote.length < 8)) {
      return fail(422, "Add a resolution note of at least 8 characters before closing a report.");
    }
    const existing = await prisma.report.findUnique({ where: { id: reportId } });
    if (!existing) return fail(404, "Report not found.");
    if (existing.status !== expectedStatus) return fail(409, "This report changed elsewhere. Refresh and review its latest status.");
    if (status === expectedStatus) return ok({ report: existing });
    if (!transitions[expectedStatus].includes(status)) return fail(422, "That report status transition is not allowed.");

    const ip = await getClientIp();
    const changed = await prisma.$transaction(async (tx) => {
      const update = await tx.report.updateMany({
        where: { id: reportId, status: expectedStatus },
        data: {
          status,
          resolutionNote: status === "OPEN" ? null : resolutionNote ?? existing.resolutionNote,
          resolvedAt: status === "RESOLVED" || status === "DISMISSED" ? new Date() : null,
        },
      });
      if (update.count !== 1) return null;
      const report = await tx.report.findUniqueOrThrow({ where: { id: reportId } });
      await tx.auditLog.create({
        data: {
          actorUserId: session.sub,
          actorEmail: session.email,
          action: "REPORT_STATUS_CHANGED",
          entityType: "Report",
          entityId: reportId,
          meta: JSON.stringify({ priorStatus: expectedStatus, status, resolutionNoteProvided: Boolean(resolutionNote) }),
          ip,
        },
      });
      return report;
    });
    if (!changed) return fail(409, "This report changed elsewhere. Refresh and review its latest status.");
    let emailDelivery: "sent" | "not_configured" | "failed" | "not_requested" = "not_requested";
    if (changed.contactEmail) {
      const configured = isEmailDeliveryConfigured();
      emailDelivery = configured ? "failed" : "not_configured";
      if (configured) {
        try {
          await sendPortalNoticeEmail({
            to: changed.contactEmail,
            name: changed.reporterName ?? undefined,
            subject: "Update on your Jeevan Sahay report",
            paragraphs: [`The status of your report has been updated to ${changed.status}. For your privacy, this email does not include the report contents or review notes.`],
          });
          emailDelivery = "sent";
        } catch (error) {
          emailDelivery = "failed";
          console.error("[admin-reports] reporter email notification failed", error);
        }
      }
    }
    return ok({ report: changed, emailDelivery });
  },
  { limit: 40, windowMs: 60_000, keyPrefix: "admin-reports" }
);
