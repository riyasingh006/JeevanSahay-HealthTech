import "server-only";
import { createHmac, randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { constantTimeEqual, getAuthSecretKey } from "./auth";
import { isEmailDeliveryConfigured, sendAuthOtpEmail } from "./email";

export type AuthOtpPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "PASSWORDLESS_LOGIN";
export type OtpFailure = "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(userId: string, purpose: AuthOtpPurpose, code: string): string {
  return createHmac("sha256", getAuthSecretKey())
    .update(`${userId}:${purpose}:${code}`)
    .digest("hex");
}

export async function issueAuthOtp(input: {
  userId: string;
  email: string;
  name: string;
  purpose: AuthOtpPurpose;
}): Promise<{ sent: true } | { sent: false; reason: "COOLDOWN" | "DELIVERY_FAILED" }> {
  if (!isEmailDeliveryConfigured()) return { sent: false, reason: "DELIVERY_FAILED" };

  const now = new Date();
  const existing = await prisma.authOtp.findUnique({
    where: { userId_purpose: { userId: input.userId, purpose: input.purpose } },
  });
  if (existing && now.getTime() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { sent: false, reason: "COOLDOWN" };
  }

  const code = String(randomInt(100_000, 1_000_000));
  const codeHash = hashCode(input.userId, input.purpose, code);
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  let challengeId: string;

  if (existing) {
    const claimed = await prisma.authOtp.updateMany({
      where: {
        id: existing.id,
        lastSentAt: existing.lastSentAt,
        verifiedAt: existing.verifiedAt,
        consumedAt: existing.consumedAt,
      },
      data: {
        codeHash,
        expiresAt,
        attempts: 0,
        lastSentAt: now,
        verifiedAt: null,
        consumedAt: null,
      },
    });
    if (claimed.count !== 1) return { sent: false, reason: "COOLDOWN" };
    challengeId = existing.id;
  } else {
    try {
      const created = await prisma.authOtp.create({
        data: {
          userId: input.userId,
          purpose: input.purpose,
          codeHash,
          expiresAt,
          lastSentAt: now,
        },
      });
      challengeId = created.id;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return { sent: false, reason: "COOLDOWN" };
      }
      throw error;
    }
  }

  try {
    await sendAuthOtpEmail({
      to: input.email,
      name: input.name,
      code,
      purpose: input.purpose,
    });
    return { sent: true };
  } catch (error) {
    await prisma.authOtp.updateMany({
      where: { id: challengeId, codeHash },
      data: { consumedAt: new Date() },
    });
    console.error("[auth] OTP email delivery failed", {
      userId: input.userId,
      purpose: input.purpose,
      message: error instanceof Error ? error.message : "unknown mail error",
    });
    return { sent: false, reason: "DELIVERY_FAILED" };
  }
}

export async function verifyAuthOtpInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    purpose: AuthOtpPurpose;
    code: string;
    consume: boolean;
  }
): Promise<{ valid: true } | { valid: false; reason: OtpFailure }> {
  const challenge = await tx.authOtp.findUnique({
    where: { userId_purpose: { userId: input.userId, purpose: input.purpose } },
  });
  if (!challenge || challenge.consumedAt || challenge.verifiedAt) {
    return { valid: false, reason: "INVALID" };
  }

  const now = new Date();
  if (challenge.expiresAt <= now) return { valid: false, reason: "EXPIRED" };
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: "TOO_MANY_ATTEMPTS" };
  }

  const expectedHash = hashCode(input.userId, input.purpose, input.code);
  if (!constantTimeEqual(expectedHash, challenge.codeHash)) {
    const updated = await tx.authOtp.updateMany({
      where: {
        id: challenge.id,
        attempts: challenge.attempts,
        consumedAt: null,
        verifiedAt: null,
      },
      data: { attempts: { increment: 1 } },
    });
    if (updated.count === 0) return { valid: false, reason: "TOO_MANY_ATTEMPTS" };
    return {
      valid: false,
      reason: challenge.attempts + 1 >= MAX_ATTEMPTS ? "TOO_MANY_ATTEMPTS" : "INVALID",
    };
  }

  const updated = await tx.authOtp.updateMany({
    where: {
      id: challenge.id,
      attempts: challenge.attempts,
      expiresAt: { gt: now },
      consumedAt: null,
      verifiedAt: null,
    },
    data: {
      verifiedAt: now,
      ...(input.consume ? { consumedAt: now } : {}),
    },
  });
  return updated.count === 1
    ? { valid: true }
    : { valid: false, reason: "INVALID" };
}

export const AUTH_OTP_EXPIRY_MINUTES = OTP_TTL_MS / 60_000;
export const AUTH_OTP_RESEND_SECONDS = RESEND_COOLDOWN_MS / 1000;
