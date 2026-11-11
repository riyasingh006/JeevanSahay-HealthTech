# Jeevan Sahay

A Next.js healthcare-directory application with patient, hospital and super-admin roles. The existing Patient Portal and hospital UI are retained; the authentication and hospital-management workflows are connected to the database.

## Current implementation

- Authentication: patient signup, email verification, passwordless email code, password recovery, Google OIDC/PKCE, revocable sessions and role checks.
- Patient portal: private profile, hospital search, saved hospitals, appointment requests/cancellation and PIN-protected health sharing.
- Hospital portal: verified-hospital-only dashboard, bed inventory, departments, doctors, services, appointment handling, emergency case log, profile, notifications, settings and persisted analytics.
- Hospital updates to itemised beds update the patient-facing availability aggregates transactionally. Hospital accounts cannot read or modify another hospital's records.
- Admin portal: protected overview and analytics, hospital application verification/rejection, searchable account suspension/reactivation, report triage, CSV exports and read-only audit review. Admin actions are role-checked, audited and session-revoking where appropriate.
- Hospital applicants remain pending until a super-admin approves them; approval/rejection is transactional, creates an in-app notification and sends an email when SMTP is configured. Approvals require verified email and confirmed map coordinates.
- PostgreSQL is the sole Prisma provider. A versioned PostgreSQL baseline preserves all models, relations, constraints and indexes. Historical SQLite migration SQL is retained outside Prisma's active migrations folder. Render stores application data in Neon; no local database file is used in production.
- Demo accounts and sample hospitals/doctors are explicitly marked. Regular patient searches and public statistics exclude those fixtures; demo accounts see clear sample-data labels, and sample records cannot be treated as confirmed capacity or used to book care. Facility-entered availability is not a live feed; the app does not dispatch emergency services.

## Local setup

Requirements: Node.js 22, npm and PostgreSQL connection strings from Neon. Runtime queries use Neon's pooled URL; Prisma migrations use its direct URL.

```sh
npm ci
cp .env.example .env
```

Set a random `SESSION_SECRET` of at least 32 bytes (for example, `openssl rand -hex 32`). Real OTP verification, password recovery and email notifications require either a Resend API key with a verified sender domain or provider-compatible SMTP settings. Google sign-in is optional and requires a Google OAuth Web application client, both client credentials, and an exact HTTPS callback registered in Google Cloud Console. See the environment-variable reference below.

For a **new local database**, apply the checked-in migrations and start the app:

```sh
npm run db:migrate:deploy
npm run dev
```

Open `http://localhost:3000`. Existing users and hospitals are not created automatically. Use `npm run db:migrate:status` to inspect migration state. Create future development migrations with `npm run db:migrate:dev -- --name concise_change_name` against a disposable/local database, then review the generated SQL before committing it. `npm run db:push` is reserved for the disposable integration-test harness and fresh throwaway databases.

### SQLite data and migration history

The active migration `20261104100000_postgresql_baseline` creates the PostgreSQL schema from the current Prisma models. The old SQLite migration files are preserved in `prisma/migrations-sqlite-legacy/` for reference and are not applied to PostgreSQL. This provider change creates schema objects; it does not copy rows from a separate SQLite database. No `prisma/dev.db` file exists in this checkout. The production Render/Neon service is configured outside this repository; this code change does not connect to or modify that service or its data. If you have a separate SQLite database containing records, keep an untouched backup and arrange a reviewed data transfer before switching real users to Neon; do not point the PostgreSQL migrations at the SQLite file or reset either database.

## Render deployment

`render.yaml` defines one Next.js web service: the UI and `/api/*` routes share a same-origin URL, with no separate frontend/backend service or CORS allowlist. It is configured for Render's Free web-service plan and has no attached disk; persistent application data lives in Neon. On each service start, `prisma migrate deploy` runs before Next.js, using `DIRECT_URL`; runtime requests use the pooled `DATABASE_URL`. Auto-deploy is disabled and the configured health-check path is `/api/health`. That public endpoint checks only that the Next.js process can answer; it does not wait for Neon or an email/API provider. Render expects an HTTP health-check response within five seconds and can cancel a deploy after repeated failures. Free services sleep after 15 minutes without inbound traffic and take about a minute to wake; that cold start can look like a request timeout. Render Free also has ephemeral filesystems and no persistent disk ([Free-service limitations](https://render.com/docs/free), [health checks](https://render.com/docs/health-checks)).

This code change does not deploy the service or alter production settings. Keep Render auto-deploy disabled until you review and deploy the PR yourself. Set `DATABASE_URL` to Neon's pooled endpoint (hostname includes `-pooler`) and `DIRECT_URL` to the direct, non-pooled endpoint; the application applies bounded pool and timeout parameters to the runtime URL and removes the legacy `pgbouncer=true` flag. Free web services block outbound SMTP ports `25`, `465` and `587`. Port `2525` is not a universal provider capability; prefer the Resend HTTPS API on Free, or confirm the exact host, port and TLS mode with your SMTP provider. Create a Google OAuth client of type **Web application**. Register `https://<render-service-host>/api/auth/google/callback` as an exact Authorized redirect URI. The current server-side OAuth flow does not use Authorized JavaScript origins; if that field is populated, use only the origin `https://<render-service-host>` with no path. For local testing, register `http://localhost:3000/api/auth/google/callback` as a separate redirect URI. The app uses Render's `RENDER_EXTERNAL_URL` when `GOOGLE_REDIRECT_URI` is unset; in production it refuses an insecure or missing public origin. If you set `NEXT_PUBLIC_APP_URL`, use the same public HTTPS origin. Any explicit `GOOGLE_REDIRECT_URI` must use that same origin and the exact callback path.

| Variable | Used by | Requirement | Purpose and value source |
|---|---|---|---|
| `DATABASE_URL` | Backend | Required; set in Render | Neon pooled PostgreSQL URL with a `-pooler` hostname, used only for app queries. Runtime enforces TLS and sets `connect_timeout=15`, `connection_limit=3`, `pool_timeout=15`, `max_idle_connection_lifetime=240`, and `socket_timeout=30`; do not add `pgbouncer=true` for Neon's current PgBouncer. Keep the URL secret. |
| `DIRECT_URL` | Prisma CLI | Required; set in Render | Neon direct PostgreSQL URL without `-pooler`, used only for Prisma migrations. Use TLS (`sslmode=require`) and keep the URL secret. |
| `TEST_DATABASE_URL` | Test scripts only | Required only for database/auth integration tests | Disposable local PostgreSQL test database; the tests reject remote hosts and non-test database names. Never point this at production. |
| `SESSION_SECRET` | Backend | Required; generated by Blueprint | Signs sessions and short-lived tokens; keep private. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Backend | Required only when Resend is not configured | SMTP host, provider-supported port, login and password. Store the password in Render secrets; do not assume port `2525` is supported by your provider. |
| `RESEND_API_KEY` | Backend | Optional; preferred for Render Free | Resend API key stored as a Render secret. When present, the app sends through Resend's HTTPS API instead of SMTP; `SMTP_FROM` must use a domain verified in Resend. |
| `SMTP_FROM` | Backend | Required for Resend or SMTP | Sender address/name from a domain verified with the selected provider. With Resend, the domain must be verified before sending. |
| `SMTP_SECURE` | Backend | Optional; Blueprint defaults to `false` | SMTP only: `false` uses STARTTLS; `true` uses implicit TLS, and port `465` always implies TLS. Use only a port/TLS mode your provider documents. Render Free blocks outbound `25`, `465` and `587`; port `2525` is provider-specific, so use the HTTPS API if SMTP cannot connect. |
| `NEXT_PUBLIC_APP_URL` | Frontend + backend | Optional on Render | Canonical public HTTPS origin for email links and OAuth. Render's `RENDER_EXTERNAL_URL` is used when this is unset. Set it to your custom domain if that is the origin registered with Google. Never use the localhost example in production. This is a URL, not a secret. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Backend | Optional; both required for Google sign-in | Create an OAuth 2.0 Web application in Google Cloud Console. The client secret is sensitive and must remain server-side. |
| `GOOGLE_REDIRECT_URI` | Backend | Optional | Exact callback URI: `https://<render-service-host>/api/auth/google/callback`. Register the same value in Google Cloud Console. If unset, the app derives it from `RENDER_EXTERNAL_URL` (or the explicit canonical URL). |
| `GOOGLE_MAPS_API_KEY` | Backend | Optional | Google Cloud Console key for Places/Geocoding. Without it, Places lookup is unavailable and address geocoding uses the app fallback. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Backend | Optional | Google AI Studio API key and optional model override for Gemini features. |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | Backend | Optional | OpenAI API key; base URL/model are only needed for a custom OpenAI-compatible provider. |
| `SEED_DEMO_DATA` | Backend | Keep `false` in production | Demo seeding is disabled by default and refused in production. |
| `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`, `SEED_SUPER_ADMIN_NAME` | Backend | First super-admin bootstrap only | Run `npm run db:seed` from a trusted local terminal against Neon after setting the values temporarily; Render Free has no Shell access. It creates only the first super-admin, is idempotent for that same account, refuses non-admin promotion and refuses a second admin. Remove the temporary password immediately. |
| `NODE_VERSION` | Backend | Set by Blueprint | Pins Node.js 22. Render supplies `PORT`, `NODE_ENV` and `RENDER_EXTERNAL_URL`; do not enter those manually. |

Gemini model lifecycle: Google lists `gemini-3.1-flash-lite` for shutdown on 7 May 2027 and recommends `gemini-3.5-flash-lite` as its replacement. The latter is already the first model in the default chain. By 7 April 2027, remove the `gemini-3.1-flash-lite` fallback and rerun `npm run test:gemini` after confirming the remaining supported models and failover order against Google's current model documentation.

Gemini provider restriction and privacy limitation: Google's [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms), effective 23 March 2026, prohibit using the service in clinical practice or to provide medical advice, and limit use to developers building for professional or business purposes rather than consumer use. They also prohibit API clients directed towards, or likely to be accessed by, people under 18; API clients may only be offered in Google-supported regions, and paid services are required for users in the EEA, Switzerland or UK. This app is an end-user healthcare assistant that accepts symptoms, answers health questions and gives emergency guidance; those features do not become permitted by describing them as navigation or adding a disclaimer. Do not send real patient data to Gemini or route around these restrictions. Before enabling the assistant for its intended audience and scope, select a provider/service whose current terms explicitly permit that use and whose data controls meet the app's requirements.

`store: false` on every Generate Content request disables request logging and takes precedence over the project's logging setting, but it is not a zero-data-retention guarantee and does not change permitted use. On paid Gemini API services, Google logs prompts and responses for a limited period to detect and prevent prohibited-use violations, maintain service safety, and make required legal or regulatory disclosures; it may also transiently store or cache data. On unpaid services, Google may use submitted prompts and responses to improve its products and allow human review; do not submit sensitive, confidential or personal information. The Developer API's documented zero-data-retention guidance directs users who need guaranteed zero retention or enterprise data-processing agreements to Vertex AI; verify applicable service terms and retention controls before handling patient data.

The application is a same-origin Next.js server, so there is no separate backend URL or CORS configuration. Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. OTPs are hashed, expire after five minutes, are attempt-limited, and are never returned or logged. Resend, SMTP, Google OAuth, Maps and AI provider credentials are not included in the repository; add secrets only in Render's environment settings. Real email delivery requires a verified sender and either Resend API or provider-compatible SMTP; live Google sign-in requires matching Google Cloud credentials and callback settings.

After the initial migration has completed, bootstrap the first super-admin against the intended Render database using the temporary `SEED_SUPER_ADMIN_*` values and `npm run db:seed`; then remove the temporary password. Keep demo seeding disabled. Take a backup before any later migration; do not run `db:push` in production.

## Optional local fixtures and admin bootstrap

The seed script refuses to add fixtures to a non-empty database and refuses demo fixtures in production. To load fictional development data, use an empty local database and run:

```sh
SEED_DEMO_DATA=true npm run db:seed
```

The demo accounts and operational figures are fictional; never use that dataset for real care decisions. There is no public admin registration. To provision the first super-admin, set `SEED_SUPER_ADMIN_EMAIL` and a unique 16–72-byte `SEED_SUPER_ADMIN_PASSWORD` (optionally `SEED_SUPER_ADMIN_NAME`) and run `npm run db:seed` from a trusted environment against the intended database. The seed is idempotent only for that same admin and refuses additional super-admins or promotion of an existing non-admin. Remove the temporary password after use. Do not commit `.env`; it is ignored by Git.

## Checks

```sh
npm run typecheck
npm run lint
npm run test:scoring
npm run test:oauth
npm run test:database
npm run test:email
npm run test:auth
npm audit
npm run build
```

`npm run test:auth` requires `TEST_DATABASE_URL` pointing to a disposable **local PostgreSQL** database whose name includes `test`; the test refuses remote and non-test databases, then resets only that explicitly named local test database. It also starts a local SMTP capture server and explicitly removes any inherited Resend API key so tests cannot send real email. Coverage includes patient and hospital registration, OTP delivery/limits/expiry, password reset, role access and logout, hospital approval/rejection, admin bootstrap and authorization, session revocation, tenant isolation, audit records and the public health endpoint. `npm run test:email` mocks the Resend HTTPS API and tests sanitized failures without network access. `npm run test:database` requires a disposable local PostgreSQL database and tests the Neon URL bounds, error redaction, and recovery after a connection is forcibly closed; it never resets the database or connects to Neon. `npm run test:oauth` checks HTTPS/public-origin and callback validation offline; the integration suite also checks PKCE/state/nonce binding and rejects state replay, but a live Google login still requires the owner's Google Cloud configuration. Scoring tests check emergency-priority ordering.
