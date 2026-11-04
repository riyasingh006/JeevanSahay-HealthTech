import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueAuthOtp } from "@/lib/otp";
import { isEmailDeliveryConfigured } from "@/lib/email";
import { check } from "@/lib/rate-limit";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const message = "If this address is awaiting verification, a new code will be sent when email delivery is available. Check spam or contact support if it does not arrive.";

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const emailLimit = check(`resend-verification:${parsed.data.email}`, 5, 60 * 60 * 1000);
    if (!emailLimit.allowed) {
      return fail(429, "Too many resend requests. Try again later.", {
        retryAfterSeconds: emailLimit.retryAfterSeconds,
      });
    }

    const smtpConfigured = isEmailDeliveryConfigured();
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user && !user.emailVerifiedAt && user.status !== "SUSPENDED") {
      const result = await issueAuthOtp({
        userId: user.id,
        email: user.email,
        name: user.name,
        purpose: "EMAIL_VERIFICATION",
      });
      if (!result.sent && result.reason === "DELIVERY_FAILED") {
        console.error("[auth] verification resend could not be delivered", { userId: user.id });
      }
    }

    return ok({ message, smtpConfigured });
  },
  { limit: 10, windowMs: 60_000, keyPrefix: "resend-verification" }
);
