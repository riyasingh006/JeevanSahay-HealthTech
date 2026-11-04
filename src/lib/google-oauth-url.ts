import { isIP } from "node:net";

export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

export interface GoogleOAuthUrlConfig {
  appUrl?: string;
  renderExternalUrl?: string;
  redirectUri?: string;
  production: boolean;
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || isIP(host) !== 0;
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" || (isIP(host) === 4 && host.startsWith("127."));
}

export function resolveGoogleOAuthUrls(
  requestOrigin: string,
  config: GoogleOAuthUrlConfig
): { baseUrl: string; redirectUri: string } {
  const appUrl = config.appUrl?.trim();
  const renderExternalUrl = config.renderExternalUrl?.trim();
  if (config.production && !appUrl && !renderExternalUrl) {
    throw new Error("Set NEXT_PUBLIC_APP_URL or use Render's public external URL in production.");
  }
  const configuredBase = appUrl || renderExternalUrl || requestOrigin;
  let origin: URL;
  try {
    origin = new URL(configuredBase);
  } catch {
    throw new Error("Google OAuth public URL is invalid.");
  }

  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Google OAuth public URL must be an origin without credentials, path, query, or fragment.");
  }
  if (config.production && isLocalHostname(origin.hostname)) {
    throw new Error("Google OAuth production URL must use a public hostname.");
  }
  const localDevelopmentHttp = !config.production && origin.protocol === "http:" && isLoopbackHostname(origin.hostname);
  if (origin.protocol !== "https:" && !localDevelopmentHttp) {
    throw new Error("Google OAuth requires HTTPS except for localhost development.");
  }

  const baseUrl = origin.origin;
  let callback: URL;
  try {
    callback = new URL(config.redirectUri?.trim() || GOOGLE_CALLBACK_PATH, `${baseUrl}/`);
  } catch {
    throw new Error("Google OAuth callback URL is invalid.");
  }

  if (
    callback.origin !== baseUrl ||
    callback.pathname !== GOOGLE_CALLBACK_PATH ||
    callback.username ||
    callback.password ||
    callback.search ||
    callback.hash ||
    (config.production && callback.protocol !== "https:")
  ) {
    throw new Error("Google OAuth callback must match the app origin and callback path over HTTPS.");
  }

  return { baseUrl, redirectUri: callback.toString() };
}
