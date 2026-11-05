import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { safeErrorMetadata } from "./database-errors";


export type Role = "PATIENT" | "HOSPITAL_ADMIN" | "SUPER_ADMIN";

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  hospitalId?: string;
  isDemo?: boolean;
}


const COOKIE_NAME = "js_session";
const RESET_COOKIE_NAME = "js_password_reset";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SHORT_SESSION_TTL_SECONDS = 60 * 60 * 12;
const RESET_TTL_SECONDS = 60 * 10;
const ISSUER = "jeevan-sahay";

export function getAuthSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function validRole(role: string): role is Role {
  return role === "PATIENT" || role === "HOSPITAL_ADMIN" || role === "SUPER_ADMIN";
}

async function signSessionToken(
  payload: SessionPayload,
  sessionId: string,
  authVersion: number,
  ttlSeconds: number
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
    hospitalId: payload.hospitalId,
    isDemo: payload.isDemo ?? false,
    sid: sessionId,
    ver: authVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience("session")
    .setSubject(payload.sub)
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getAuthSecretKey());
}

export async function setSessionCookie(
  payload: SessionPayload,
  rememberMe = true
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { hospital: { select: { status: true } } },
  });
  if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt || !validRole(user.role)) {
    throw new AuthError(403, "This account is not eligible to sign in.");
  }
  if (
    user.role === "HOSPITAL_ADMIN" &&
    (!user.hospitalId || user.hospital?.status !== "VERIFIED")
  ) {
    throw new AuthError(403, "This hospital application is still under review.");
  }

  const ttlSeconds = rememberMe ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS;
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await prisma.userSession.create({
    data: { id: sessionId, userId: user.id, authVersion: user.authVersion, expiresAt },
  });

  const canonicalPayload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hospitalId: user.hospitalId ?? undefined,
    isDemo: user.isDemo,
  };

  const token = await signSessionToken(canonicalPayload, sessionId, user.authVersion, ttlSeconds);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getAuthSecretKey(), {
        issuer: ISSUER,
        audience: "session",
      });
      if (typeof payload.sid === "string") {
        await prisma.userSession.updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Expired or invalid cookies are still cleared below.
    }
  }
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function createShareToken(userId: string, ttlSeconds = 300): Promise<string> {
  return new SignJWT({ scope: "health-share" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience("health-share")
    .setSubject(userId)
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getAuthSecretKey());
}

export async function verifyShareToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), {
      issuer: ISSUER,
      audience: "health-share",
    });
    if (payload.scope !== "health-share" || !payload.sub) return null;
    return String(payload.sub);
  } catch {
    return null;
  }
}

export async function setPasswordResetCookie(userId: string): Promise<void> {
  const token = await new SignJWT({ scope: "password-reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience("password-reset")
    .setSubject(userId)
    .setExpirationTime(`${RESET_TTL_SECONDS}s`)
    .sign(getAuthSecretKey());
  const store = await cookies();
  store.set(RESET_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RESET_TTL_SECONDS,
  });
}

export async function getPasswordResetUserId(): Promise<string | null> {
  const token = (await cookies()).get(RESET_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), {
      issuer: ISSUER,
      audience: "password-reset",
    });
    if (payload.scope !== "password-reset" || !payload.sub) return null;
    return String(payload.sub);
  } catch {
    return null;
  }
}

export async function clearPasswordResetCookie(): Promise<void> {
  const store = await cookies();
  store.set(RESET_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), {
      issuer: ISSUER,
      audience: "session",
    });
    if (!payload.sub || typeof payload.sid !== "string" || typeof payload.ver !== "number") {
      return null;
    }

    const session = await prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: String(payload.sub),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { include: { hospital: { select: { status: true } } } },
      },
    });
    const user = session?.user;
    if (
      !session ||
      !user ||
      session.authVersion !== payload.ver ||
      user.authVersion !== payload.ver ||
      user.status !== "ACTIVE" ||
      !user.emailVerifiedAt ||
      !validRole(user.role)
    ) {
      return null;
    }
    if (
      user.role === "HOSPITAL_ADMIN" &&
      (!user.hospitalId || user.hospital?.status !== "VERIFIED")
    ) {
      return null;
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hospitalId: user.hospitalId ?? undefined,
      isDemo: user.isDemo,
    };

  } catch {
    return null;
  }
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Authentication required.");
  return session;
}

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new AuthError(403, "You do not have permission to perform this action.");
  }
  return session;
}

export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    "unknown"
  );
}

export async function writeAudit(entry: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: unknown;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        meta: entry.meta === undefined ? null : JSON.stringify(entry.meta),
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to persist audit log", safeErrorMetadata(error));
  }
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
