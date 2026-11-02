import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getClientIp,
  setSessionCookie,
  verifyPassword,
  writeAudit,
  type Role,
} from "@/lib/auth";
import { issueAuthOtp } from "@/lib/otp";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
  rememberMe: z.boolean().default(true),
});

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { email, password, rememberMe } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        hospital: { select: { status: true } },
        hospitalApplication: { select: { status: true } },
      },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await writeAudit({
        actorEmail: email,
        action: "AUTH_LOGIN_FAILED",
        ip: await getClientIp(),
      });
      return fail(401, "Invalid email or password.");
    }

    if (user.status === "SUSPENDED") {
      return fail(403, "This account has been suspended. Contact support.", { code: "ACCOUNT_SUSPENDED" });
    }
    if (!user.emailVerifiedAt || user.status === "PENDING_VERIFICATION") {
      const verification = await issueAuthOtp({
        userId: user.id,
        email: user.email,
        name: user.name,
        purpose: "EMAIL_VERIFICATION",
      });
      return fail(
        403,
        verification.sent
          ? "Verify your email address before signing in. We sent you a verification code."
          : verification.reason === "COOLDOWN"
            ? "Verify your email address before signing in. Check for the code already sent."
            : "Verify your email address before signing in. Use resend verification after email delivery is configured.",
        {
          code: "EMAIL_VERIFICATION_REQUIRED",
          email: user.email,
          role: user.role,
          deliveryPending: "reason" in verification && verification.reason === "DELIVERY_FAILED",
        }
      );
    }
    if (user.status !== "ACTIVE") {
      return fail(403, "This account is not active. Contact support.", { code: "ACCOUNT_INACTIVE" });
    }
    if (
      user.role === "HOSPITAL_ADMIN" &&
      (!user.hospitalId || user.hospital?.status !== "VERIFIED")
    ) {
      return fail(403, "Your hospital application is awaiting verification.", {
        code: "HOSPITAL_APPLICATION_PENDING",
        applicationStatus: user.hospitalApplication?.status ?? "PENDING_VERIFICATION",
      });
    }
    if (!(["PATIENT", "HOSPITAL_ADMIN", "SUPER_ADMIN"] as string[]).includes(user.role)) {
      return fail(403, "This account has an invalid role. Contact support.");
    }

    await setSessionCookie(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        hospitalId: user.hospitalId ?? undefined,
      },
      rememberMe
    );

    await writeAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "AUTH_LOGIN",
      entityType: "User",
      entityId: user.id,
      ip: await getClientIp(),
    });

    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
      },
    });
  },
  { limit: 10, windowMs: 60_000, keyPrefix: "login" }
);
