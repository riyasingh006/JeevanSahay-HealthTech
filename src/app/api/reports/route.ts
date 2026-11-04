import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, parseBody, withApi } from "@/lib/api-helpers";
import { isEmailDeliveryConfigured, sendPortalNoticeEmail } from "@/lib/email";

const schema = z.object({
  category: z.enum(["DATA_ISSUE", "FACILITY", "STAFF", "BILLING", "OTHER"]),
  subject: z.string().trim().min(4).max(120),
  message: z.string().trim().min(10).max(2000),
  reporterName: z.string().trim().max(80).optional(),
  contactEmail: z.string().trim().email("Enter a valid email").optional(),
  relatedHospital: z.string().trim().max(120).optional(),
});

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const report = await prisma.report.create({ data: parsed.data });
    let emailDelivery: "sent" | "not_configured" | "failed" | "no_recipients" = "no_recipients";
    try {
      const admins = await prisma.user.findMany({
        where: { role: "SUPER_ADMIN", status: "ACTIVE", isDemo: false, emailVerifiedAt: { not: null } },
        select: { name: true, email: true },
      });
      const configured = isEmailDeliveryConfigured();
      if (admins.length > 0) {
        emailDelivery = configured ? "failed" : "not_configured";
        if (configured) {
          const deliveries = await Promise.allSettled(admins.map((admin) => sendPortalNoticeEmail({
            to: admin.email,
            name: admin.name,
            subject: "New feedback or complaint — Jeevan Sahay",
            paragraphs: ["A new report has been submitted. Sign in to review it in the Admin Portal."],
            actionPath: "/admin/reports",
            actionLabel: "Review reports",
          })));
          emailDelivery = deliveries.some((delivery) => delivery.status === "fulfilled") ? "sent" : "failed";
          if (emailDelivery === "failed") console.error("[reports] administrator email notification failed");
        }
      }
    } catch (error) {
      emailDelivery = "failed";
      console.error("[reports] administrator notification failed", error);
    }
    return ok({ reportId: report.id, emailDelivery }, { status: 201 });
  },
  { limit: 5, windowMs: 60 * 10_000, keyPrefix: "report-submit" }
);
