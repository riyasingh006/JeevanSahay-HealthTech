import assert from "node:assert/strict";
import { resolveGoogleOAuthUrls } from "../src/lib/google-oauth-url";

const renderOrigin = "https://jeevan-sahay-test.onrender.com";

assert.deepEqual(
  resolveGoogleOAuthUrls("http://localhost:3000", {
    appUrl: "https://clinic.example",
    renderExternalUrl: renderOrigin,
    production: true,
  }),
  {
    baseUrl: "https://clinic.example",
    redirectUri: "https://clinic.example/api/auth/google/callback",
  }
);

assert.deepEqual(
  resolveGoogleOAuthUrls("http://internal-service:3000", {
    renderExternalUrl: renderOrigin,
    production: true,
  }),
  {
    baseUrl: renderOrigin,
    redirectUri: `${renderOrigin}/api/auth/google/callback`,
  }
);

assert.deepEqual(
  resolveGoogleOAuthUrls("http://127.0.0.1:3000", {
    redirectUri: "http://127.0.0.1:3000/api/auth/google/callback",
    production: false,
  }),
  {
    baseUrl: "http://127.0.0.1:3000",
    redirectUri: "http://127.0.0.1:3000/api/auth/google/callback",
  }
);

assert.deepEqual(
  resolveGoogleOAuthUrls("http://localhost:3000", {
    appUrl: "http://[::1]:3000",
    production: false,
  }),
  {
    baseUrl: "http://[::1]:3000",
    redirectUri: "http://[::1]:3000/api/auth/google/callback",
  }
);

for (const config of [
  { appUrl: "http://clinic.example", renderExternalUrl: renderOrigin, production: true },
  { appUrl: "http://127.0.0.1:3000", renderExternalUrl: renderOrigin, production: true },
  { appUrl: "http://192.168.1.20", production: false },
  { appUrl: "https://clinic.example/dashboard", production: true },
  { appUrl: "https://127.0.0.1", production: true },
  { appUrl: "https://clinic.example", redirectUri: "https://attacker.example/api/auth/google/callback", production: true },
  { appUrl: "https://clinic.example", redirectUri: "https://clinic.example/api/auth/other", production: true },
  { appUrl: "https://clinic.example", redirectUri: "https://clinic.example/api/auth/google/callback?next=/", production: true },
  { appUrl: "https://clinic.example", redirectUri: "https://clinic.example/api/auth/google/callback#fragment", production: true },
  { production: true },
  { appUrl: "http://clinic.example", production: false },
]) {
  assert.throws(() => resolveGoogleOAuthUrls("http://localhost:3000", config));
}

console.log("PASS Google OAuth URL policy: HTTPS, trusted origin, callback path and development localhost");
