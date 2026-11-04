import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueAuthOtp } from "@/lib/otp";
import { isEmailDeliveryConfigured } from "@/lib/email";
import { check } from "@/lib/rate-limit";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { email } = parsed.data;
    const limit = check(`passwordless-email:${email}`, 3, 15 * 60_000);
    if (!limit.allowed) {
      return fail(429, "Please wait before requesting another sign-in code.", {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { hospital: { select: { status: true } } },
    });
    if (
      user &&
      user.status === "ACTIVE" &&
      user.emailVerifiedAt &&
      (user.role !== "HOSPITAL_ADMIN" ||
        (user.hospitalId && user.hospital?.status === "VERIFIED"))
    ) {
      await issueAuthOtp({
        userId: user.id,
        email: user.email,
        name: user.name,
        purpose: "PASSWORDLESS_LOGIN",
      });
    }

    return ok({
      message: "If this address belongs to an eligible account, a sign-in code will be sent when email delivery is available. If it does not arrive, check spam or contact support.",
      smtpConfigured: isEmailDeliveryConfigured(),
    });
  },
  { limit: 12, windowMs: 60_000, keyPrefix: "passwordless-request" }
);
