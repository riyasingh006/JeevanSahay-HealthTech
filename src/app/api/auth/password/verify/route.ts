import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, setPasswordResetCookie, writeAudit } from "@/lib/auth";
import { verifyAuthOtpInTransaction } from "@/lib/otp";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { email, code } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      return fail(401, "The recovery code is invalid, expired, or already used.");
    }

    const outcome = await prisma.$transaction((tx) =>
      verifyAuthOtpInTransaction(tx, {
        userId: user.id,
        purpose: "PASSWORD_RESET",
        code,
        consume: false,
      })
    );
    if (!outcome.valid) {
      return fail(401, "The recovery code is invalid, expired, or already used.");
    }

    await setPasswordResetCookie(user.id);
    await writeAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "AUTH_PASSWORD_RESET_CODE_VERIFIED",
      entityType: "User",
      entityId: user.id,
      ip: await getClientIp(),
    });
    return ok({ verified: true });
  },
  { limit: 15, windowMs: 60_000, keyPrefix: "password-reset-verify" }
);
