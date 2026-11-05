import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { safeErrorMetadata } from "@/lib/database-errors";

import {
  constantTimeEqual,
  getClientIp,
  hashPassword,
  setSessionCookie,
  writeAudit,
  type Role,
} from "@/lib/auth";
import { resolveGoogleOAuthUrls } from "@/lib/google-oauth-url";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const OAUTH_COOKIES = ["google_oauth_state", "google_oauth_nonce", "google_oauth_verifier"];

type GoogleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
};


function clearOAuthCookies(response: NextResponse): NextResponse {
  for (const name of OAUTH_COOKIES) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function redirectError(baseUrl: string, error: string): NextResponse {
  const loginUrl = new URL("/login", baseUrl);
  loginUrl.searchParams.set("error", error);
  return clearOAuthCookies(NextResponse.redirect(loginUrl));
}

async function exchangeCode(code: string, redirectUri: string, verifier: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("google_config_missing");
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("google_token_exchange_failed");
  const tokens = await response.json() as { id_token?: string };
  if (!tokens.id_token) throw new Error("google_id_token_missing");
  return tokens.id_token;
}

async function verifyIdToken(idToken: string, clientId: string): Promise<GoogleClaims> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    requiredClaims: ["exp", "iat", "iss", "aud", "sub"],
  });
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (
    typeof payload.iat !== "number" ||
    payload.iat > Math.floor(Date.now() / 1000) + 60 ||
    (audiences.length > 1 && payload.azp !== clientId)
  ) {
    throw new Error("google_id_token_invalid");
  }
  return payload as GoogleClaims;
}

function isUniqueConflict(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function resolveGoogleUser(claims: GoogleClaims) {
  const now = new Date();
  const bySubject = await prisma.user.findUnique({ where: { googleSubject: claims.sub } });
  if (bySubject) {
    if (bySubject.status === "SUSPENDED") throw new Error("account_suspended");
    if (!bySubject.emailVerifiedAt || bySubject.status === "PENDING_VERIFICATION") {
      return prisma.user.update({
        where: { id: bySubject.id },
        data: { emailVerifiedAt: now, status: "ACTIVE" },
      });
    }
    return bySubject;
  }

  const byEmail = await prisma.user.findUnique({ where: { email: claims.email! } });
  if (byEmail) {
    if (byEmail.status === "SUSPENDED") throw new Error("account_suspended");
    if (byEmail.googleSubject && byEmail.googleSubject !== claims.sub) {
      throw new Error("google_account_link_conflict");
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleSubject: claims.sub,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? now,
        status: byEmail.status === "PENDING_VERIFICATION" ? "ACTIVE" : byEmail.status,
      },
    });
  }

  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  try {
    return await prisma.user.create({
      data: {
        name: claims.name?.trim().slice(0, 80) || claims.email!.split("@")[0],
        email: claims.email!,
        passwordHash,
        role: "PATIENT",
        status: "ACTIVE",
        emailVerifiedAt: now,
        googleSubject: claims.sub,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const raced = await prisma.user.findUnique({ where: { googleSubject: claims.sub } }) ??
      await prisma.user.findUnique({ where: { email: claims.email! } });
    if (!raced || (raced.googleSubject && raced.googleSubject !== claims.sub)) {
      throw new Error("google_account_link_conflict");
    }
    return raced.googleSubject ? raced : prisma.user.update({
      where: { id: raced.id },
      data: { googleSubject: claims.sub, emailVerifiedAt: raced.emailVerifiedAt ?? now },
    });
  }
}

function homeForRole(role: string): string {
  if (role === "HOSPITAL_ADMIN") return "/hospital";
  if (role === "SUPER_ADMIN") return "/admin";
  return "/dashboard";
}

export async function GET(req: NextRequest) {
  let urls: ReturnType<typeof resolveGoogleOAuthUrls>;
  try {
    urls = resolveGoogleOAuthUrls(req.nextUrl.origin, {
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      renderExternalUrl: process.env.RENDER_EXTERNAL_URL,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      production: process.env.NODE_ENV === "production",
    });
  } catch {
    return clearOAuthCookies(new NextResponse(
      "Google sign-in is unavailable until a valid public HTTPS callback is configured.",
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          Pragma: "no-cache",
          "Referrer-Policy": "no-referrer",
        },
      }
    ));
  }
  const { baseUrl, redirectUri } = urls;

  const url = req.nextUrl;
  const oauthError = url.searchParams.get("error");
  if (oauthError) return redirectError(baseUrl, "google_cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get("google_oauth_state")?.value;
  const nonce = req.cookies.get("google_oauth_nonce")?.value;
  const verifier = req.cookies.get("google_oauth_verifier")?.value;
  if (!code || !state || !savedState || !nonce || !verifier) {
    return redirectError(baseUrl, "google_invalid");
  }
  if (!constantTimeEqual(state, savedState)) {
    return redirectError(baseUrl, "google_state_mismatch");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return redirectError(baseUrl, "google_config_missing");
  }

  try {
    const idToken = await exchangeCode(code, redirectUri, verifier);
    const claims = await verifyIdToken(idToken, clientId);
    if (
      !claims.sub ||
      !claims.email ||
      claims.email_verified !== true ||
      typeof claims.nonce !== "string" ||
      !constantTimeEqual(claims.nonce, nonce)
    ) {
      return redirectError(baseUrl, claims.email_verified === false ? "google_email_unverified" : "google_invalid");
    }

    const normalizedClaims = { ...claims, email: claims.email.trim().toLowerCase() };
    const user = await resolveGoogleUser(normalizedClaims);
    if (user.status !== "ACTIVE") return redirectError(baseUrl, "account_inactive");
    if (user.role === "HOSPITAL_ADMIN") {
      const hospital = user.hospitalId
        ? await prisma.hospital.findUnique({ where: { id: user.hospitalId }, select: { status: true } })
        : null;
      if (!hospital || hospital.status !== "VERIFIED") {
        return redirectError(baseUrl, "hospital_application_pending");
      }
    }

    await setSessionCookie({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      hospitalId: user.hospitalId ?? undefined,
    });
    await writeAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      action: "AUTH_LOGIN_GOOGLE",
      entityType: "User",
      entityId: user.id,
      ip: await getClientIp(),
    });

    const response = NextResponse.redirect(new URL(homeForRole(user.role), baseUrl));
    return clearOAuthCookies(response);
  } catch (error) {
    if (error instanceof Error && ["account_suspended", "account_inactive", "google_account_link_conflict"].includes(error.message)) {
      return redirectError(baseUrl, error.message);
    }
    console.error("[auth] Google OAuth callback failed", safeErrorMetadata(error));
    return redirectError(baseUrl, "google_failed");
  }
}
