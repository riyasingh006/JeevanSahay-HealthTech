import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, setSessionCookie, writeAudit, type Role } from "@/lib/auth";
import { verifyAuthOtpInTransaction } from "@/lib/otp";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
  rememberMe: z.boolean().optional().default(true),
});

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const { email, code, rememberMe } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { hospital: { select: { status: true } } },
    });
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !user.emailVerifiedAt ||
      (user.role === "HOSPITAL_ADMIN" &&
        (!user.hospitalId || user.hospital?.status !== "VERIFIED"))
    ) {
      return fail(401, "The code is invalid, expired, or already used.");
    }

    const outcome = await prisma.$transaction((tx) =>
      verifyAuthOtpInTransaction(tx, {
        userId: user.id,
        purpose: "PASSWORDLESS_LOGIN",
        code,
        consume: true,
      })
    );
    if (!outcome.valid) {
      return fail(401, "The code is invalid, expired, or already used.");
    }

    await setSessionCookie(
      { sub: user.id, email: user.email, name: user.name, role: user.role as Role, hospitalId: user.hospitalId ?? undefined },
      rememberMe
    );
    await writeAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "AUTH_PASSWORDLESS_LOGIN",
      entityType: "User",
      entityId: user.id,
      ip: await getClientIp(),
    });
    return ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  },
  { limit: 20, windowMs: 60_000, keyPrefix: "passwordless-verify" }
);
