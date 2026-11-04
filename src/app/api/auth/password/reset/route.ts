import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  clearPasswordResetCookie,
  clearSessionCookie,
  getClientIp,
  getPasswordResetUserId,
  hashPassword,
  writeAudit,
} from "@/lib/auth";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(72, "Password is too long")
  .regex(/[a-z]/, "Include a lower-case letter")
  .regex(/[A-Z]/, "Include an upper-case letter")
  .regex(/[0-9]/, "Include a number")
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Password is too long");

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string().max(72) })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  });

export const POST = withApi(
  async (req) => {
    const userId = await getPasswordResetUserId();
    if (!userId) return fail(401, "Verify a password-reset code before choosing a new password.");
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      const challenge = await tx.authOtp.findUnique({
        where: { userId_purpose: { userId, purpose: "PASSWORD_RESET" } },
      });
      if (
        !user ||
        user.status !== "ACTIVE" ||
        !user.emailVerifiedAt ||
        !challenge ||
        !challenge.verifiedAt ||
        challenge.consumedAt ||
        challenge.expiresAt <= now ||
        now.getTime() - challenge.verifiedAt.getTime() > 10 * 60_000
      ) {
        return false;
      }

      const claimed = await tx.authOtp.updateMany({
        where: {
          id: challenge.id,
          verifiedAt: challenge.verifiedAt,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (claimed.count !== 1) return false;

      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.authOtp.updateMany({
        where: { userId, purpose: { not: "PASSWORD_RESET" }, consumedAt: null },
        data: { consumedAt: now },
      });
      return true;
    });

    if (!result) return fail(400, "The reset session has expired. Request a new code and try again.");

    await clearSessionCookie();
    await clearPasswordResetCookie();
    await writeAudit({
      actorUserId: userId,
      action: "AUTH_PASSWORD_RESET",
      entityType: "User",
      entityId: userId,
      ip: await getClientIp(),
    });
    return ok({ passwordReset: true, message: "Your password has been updated. Sign in with your new password." });
  },
  { limit: 8, windowMs: 15 * 60_000, keyPrefix: "password-reset" }
);
