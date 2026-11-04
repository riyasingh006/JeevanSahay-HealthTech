import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, setSessionCookie, writeAudit } from "@/lib/auth";
import { verifyAuthOtpInTransaction } from "@/lib/otp";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().regex(/^\d{6}$/),
});

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { email, code } = parsed.data;
    const outcome = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email },
        include: { hospitalApplication: { select: { status: true } } },
      });
      if (!user || user.emailVerifiedAt || user.status === "SUSPENDED") {
        return { valid: false as const, reason: "INVALID" as const };
      }

      const result = await verifyAuthOtpInTransaction(tx, {
        userId: user.id,
        purpose: "EMAIL_VERIFICATION",
        code,
        consume: true,
      });
      if (!result.valid) return result;

      const verifiedAt = new Date();
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: verifiedAt, status: "ACTIVE" },
        select: { id: true, name: true, email: true, role: true, hospitalId: true },
      });
      if (user.role === "PATIENT") {
        await tx.notification.create({
          data: {
            userId: user.id,
            title: "Welcome to जीवन Sahay",
            body: "Complete your health profile so hospitals can assist you faster during an emergency.",
            type: "INFO",
            link: "/dashboard/profile",
          },
        });
      }
      return { valid: true as const, user: updated, applicationStatus: user.hospitalApplication?.status ?? null };
    });

    if (!outcome.valid) {
      const message = outcome.reason === "TOO_MANY_ATTEMPTS"
        ? "Too many incorrect codes. Request a new code and try again."
        : outcome.reason === "EXPIRED"
          ? "This code has expired. Request a new verification code."
          : "That verification code is invalid or has already been used.";
      return fail(400, message);
    }

    await writeAudit({
      actorUserId: outcome.user.id,
      actorEmail: outcome.user.email,
      action: "AUTH_EMAIL_VERIFIED",
      entityType: "User",
      entityId: outcome.user.id,
      ip: await getClientIp(),
    });

    if (outcome.user.role === "PATIENT") {
      await setSessionCookie({
        sub: outcome.user.id,
        email: outcome.user.email,
        name: outcome.user.name,
        role: "PATIENT",
      });
    }

    return ok({
      user: outcome.user.role === "PATIENT"
        ? { id: outcome.user.id, name: outcome.user.name, email: outcome.user.email, role: outcome.user.role }
        : null,
      hospitalApplicationPending: outcome.user.role === "HOSPITAL_ADMIN",
      applicationStatus: outcome.applicationStatus,
    });
  },
  { limit: 12, windowMs: 60_000, keyPrefix: "verify-email" }
);
