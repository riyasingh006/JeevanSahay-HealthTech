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

Set a random `SESSION_SECRET` of at least 32 bytes (for example, `openssl rand -hex 32`). Real OTP verification, password recovery and email notifications require valid SMTP settings. `NEXT_PUBLIC_APP_URL` is optional locally; Google sign-in is optional and requires Google OAuth client credentials plus the matching callback registered in Google Cloud Console. See the environment-variable reference below.

For a **new local database**, apply the checked-in migrations and start the app:

```sh
npm run db:migrate:deploy
npm run dev
```

Open `http://localhost:3000`. Existing users and hospitals are not created automatically. Use `npm run db:migrate:status` to inspect migration state. Create future development migrations with `npm run db:migrate:dev -- --name concise_change_name` against a disposable/local database, then review the generated SQL before committing it. `npm run db:push` is reserved for the disposable integration-test harness and fresh throwaway databases.

### SQLite data and migration history

The active migration `20261104100000_postgresql_baseline` creates the PostgreSQL schema from the current Prisma models. The old SQLite migration files are preserved in `prisma/migrations-sqlite-legacy/` for reference and are not applied to PostgreSQL. This provider change creates schema objects; it does not copy rows from a separate SQLite database. No `prisma/dev.db` file exists in this checkout, and the previously recorded work did not provision a live Render service. Neon was not connected or modified during this change. If you have a separate SQLite database containing records, keep an untouched backup and arrange a reviewed data transfer before switching real users to Neon; do not point the PostgreSQL migrations at the SQLite file or reset either database.

## Render deployment

`render.yaml` defines one Next.js web service: the UI and `/api/*` routes share a same-origin URL, with no separate frontend/backend service or CORS allowlist. It is configured for Render's Free web-service plan and has no attached disk; persistent application data lives in Neon. On each service start, `prisma migrate deploy` runs before Next.js, using `DIRECT_URL`; runtime requests use the pooled `DATABASE_URL`. Auto-deploy is disabled and `/api/health` is the health check. Render's Free services have ephemeral local filesystems and do not support persistent disks, so the app must not rely on local SQLite files ([Render Free services](https://render.com/docs/free)).

No service is deployed by this repository change. When you choose to deploy, create or update the Render Blueprint from the reviewed branch and provide the Neon pooled `DATABASE_URL` (hostname includes `-pooler`, with `sslmode=require&pgbouncer=true`) and direct `DIRECT_URL` through Render's secret environment fields. Configure optional SMTP/OAuth/AI credentials only if needed; never commit credentials. Auto-deploy remains disabled. Render assigns one service URL for the frontend and API. The Google callback is `https://<render-service-host>/api/auth/google/callback`; register it in Google Cloud Console. The app derives the callback from the request origin when `GOOGLE_REDIRECT_URI` is unset. Set `NEXT_PUBLIC_APP_URL` only for a custom canonical domain or a specific email-link origin.

| Variable | Used by | Requirement | Purpose and value source |
|---|---|---|---|
| `DATABASE_URL` | Backend | Required; set in Render | Neon pooled PostgreSQL URL; use the hostname containing `-pooler` and include `sslmode=require&pgbouncer=true`. Used for app queries. |
| `DIRECT_URL` | Prisma CLI | Required; set in Render | Neon direct PostgreSQL URL without `-pooler`; used for Prisma migrations. Keep both URLs secret. |
| `SESSION_SECRET` | Backend | Required; generated by Blueprint | Signs sessions and short-lived tokens; keep private. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Backend | Required for real OTP and email notices | SMTP hostname, port, login and verified sender address from your email provider. Keep the password in Render secrets. |
| `SMTP_SECURE` | Backend | Optional; Blueprint defaults to `false` | Set `true` for implicit TLS (usually port 465); keep `false` for STARTTLS (usually port 587). |
| `NEXT_PUBLIC_APP_URL` | Frontend + backend | Optional | Canonical HTTPS origin used for email links and OAuth. Set to the Render service URL or custom domain if needed; otherwise Render's `RENDER_EXTERNAL_URL`/request origin is used. This is a URL, not a secret. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Backend | Optional; both required for Google sign-in | Create an OAuth 2.0 Web application in Google Cloud Console. The client secret is sensitive. |
| `GOOGLE_REDIRECT_URI` | Backend | Optional | Explicit callback URI; use `https://<render-service-host>/api/auth/google/callback` and register the same value in Google Cloud Console. If unset, the app uses the request origin. |
| `GOOGLE_MAPS_API_KEY` | Backend | Optional | Google Cloud Console key for Places/Geocoding. Without it, Places lookup is unavailable and address geocoding uses the app fallback. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Backend | Optional | Google AI Studio API key and optional model override for Gemini features. |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | Backend | Optional | OpenAI API key; base URL/model are only needed for a custom OpenAI-compatible provider. |
| `SEED_DEMO_DATA` | Backend | Keep `false` in production | Demo seeding is disabled by default and refused in production. |
| `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`, `SEED_SUPER_ADMIN_NAME` | Backend | One-time admin bootstrap only | Run `npm run db:seed` from a trusted local terminal against Neon after setting the values temporarily; Render Free has no Shell access. Remove the password immediately after; the seed will not promote an existing non-admin account. |
| `NODE_VERSION` | Backend | Set by Blueprint | Pins Node.js 22. Render supplies `PORT`, `NODE_ENV` and `RENDER_EXTERNAL_URL`; do not enter those manually. |

The application is a same-origin Next.js server, so there is no separate backend URL or CORS configuration. Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. SMTP, Google OAuth, Maps and AI provider credentials are not included in the repository; add only the integrations you intend to enable. OTP/email workflows cannot deliver to real users until SMTP is configured, and Google sign-in cannot be live-tested until OAuth credentials are supplied.

After the initial migration has completed, bootstrap the first super-admin against the intended Render database using the temporary `SEED_SUPER_ADMIN_*` values and `npm run db:seed`; then remove the temporary password. Keep demo seeding disabled. Take a backup before any later migration; do not run `db:push` in production.

## Optional local fixtures and admin bootstrap

The seed script refuses to add fixtures to a non-empty database and refuses demo fixtures in production. To load fictional development data, use an empty local database and run:

```sh
SEED_DEMO_DATA=true npm run db:seed
```

The demo accounts and operational figures are fictional; never use that dataset for real care decisions. To provision a first super-admin, set `SEED_SUPER_ADMIN_EMAIL` and a unique 16–72-byte `SEED_SUPER_ADMIN_PASSWORD` (optionally `SEED_SUPER_ADMIN_NAME`) and run `npm run db:seed` against the intended database. The script does not promote an existing non-admin account. Do not commit `.env`; it is ignored by Git.

## Checks

```sh
npm run typecheck
npm run lint
npm run test:scoring
npm run test:auth
npm audit
npm run build
```

`npm run test:auth` requires `TEST_DATABASE_URL` pointing to a disposable **local PostgreSQL** database whose name includes `test`; the test refuses remote and non-test databases, then resets only that explicitly named local test database. It also starts a local SMTP capture server. Coverage includes registration, OTP limits/expiry, password reset, role access and logout, demo-data visibility, hospital tenant isolation and CRUD, patient-visible availability, appointments, emergency records, hospital approval/rejection, admin accounts/sessions, reports and audit logs. SMTP failure handling is exercised without sending real email; Google tests cover OAuth initiation and state validation, not a live Google login. Scoring tests check emergency-priority ordering. The production dependency audit currently reports no vulnerabilities.
