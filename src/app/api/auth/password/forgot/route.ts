import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueAuthOtp } from "@/lib/otp";
import { check } from "@/lib/rate-limit";
import { ok, parseBody, withApi } from "@/lib/api-helpers";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { email } = parsed.data;
    const limit = check(`password-reset-email:${email}`, 3, 15 * 60_000);
    if (!limit.allowed) {
      return ok({
        message: "If this address belongs to an eligible account, a recovery code has been sent.",
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status === "ACTIVE" && user.emailVerifiedAt) {
      await issueAuthOtp({
        userId: user.id,
        email: user.email,
        name: user.name,
        purpose: "PASSWORD_RESET",
      });
    }

    return ok({
      message: "If this address belongs to an eligible account, a recovery code has been sent.",
    });
  },
  { limit: 12, windowMs: 60_000, keyPrefix: "password-reset-request" }
);
