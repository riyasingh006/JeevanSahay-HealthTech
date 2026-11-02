import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { check } from "@/lib/rate-limit";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function getBaseUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return new URL(configured).origin;
  return req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = getBaseUrl(req);
  if (!clientId) {
    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("error", "google_config_missing");
    return NextResponse.redirect(loginUrl);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = check(`google-oauth:${ip}`, 20, 60_000);
  if (!limit.allowed) {
    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("error", "google_try_later");
    return NextResponse.redirect(loginUrl);
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;
  const state = randomUUID();
  const nonce = randomUUID();
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  };
  response.cookies.set("google_oauth_state", state, cookieOptions);
  response.cookies.set("google_oauth_nonce", nonce, cookieOptions);
  response.cookies.set("google_oauth_verifier", verifier, cookieOptions);
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
