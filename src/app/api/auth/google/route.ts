import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { check } from "@/lib/rate-limit";
import { resolveGoogleOAuthUrls } from "@/lib/google-oauth-url";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
};

function redirectLogin(baseUrl: string, error: string): NextResponse {
  const loginUrl = new URL("/login", baseUrl);
  loginUrl.searchParams.set("error", error);
  return NextResponse.redirect(loginUrl, { headers: PRIVATE_HEADERS });
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
    return NextResponse.json(
      { error: "Google sign-in is unavailable until a valid public HTTPS callback is configured." },
      { status: 503, headers: PRIVATE_HEADERS }
    );
  }
  const { baseUrl, redirectUri } = urls;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return redirectLogin(baseUrl, "google_config_missing");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = check(`google-oauth:${ip}`, 20, 60_000);
  if (!limit.allowed) return redirectLogin(baseUrl, "google_try_later");

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

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`, { headers: PRIVATE_HEADERS });
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
