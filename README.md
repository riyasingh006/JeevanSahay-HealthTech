# Jeevan Sahay

A Next.js healthcare-directory application with patient, hospital and super-admin roles. The existing Patient Portal and hospital UI are retained; the authentication and hospital-management workflows are connected to the database.

## Current implementation

- Authentication: patient signup, email verification, passwordless email code, password recovery, Google OIDC/PKCE, revocable sessions and role checks.
- Patient portal: private profile, hospital search, saved hospitals, appointment requests/cancellation and PIN-protected health sharing.
- Hospital portal: verified-hospital-only dashboard, bed inventory, departments, doctors, services, appointment handling, emergency case log, profile, notifications, settings and persisted analytics.
- Hospital updates to itemised beds update the patient-facing availability aggregates transactionally. Hospital accounts cannot read or modify another hospital's records.
- Admin portal: protected overview and analytics, hospital application verification/rejection, searchable account suspension/reactivation, report triage, CSV exports and read-only audit review. Admin actions are role-checked, audited and session-revoking where appropriate.
- Hospital applicants remain pending until a super-admin approves them; approval/rejection is transactional, creates an in-app notification and sends an email when SMTP is configured. Approvals require verified email and confirmed map coordinates.
- Versioned SQLite migrations define the complete baseline, query indexes and demo-data markers. The checked-in Render Blueprint uses a persistent SQLite disk; PostgreSQL requires a separate reviewed provider/migration change. Never use `db:push` as a production migration strategy.
- Demo accounts and sample hospitals/doctors are explicitly marked. Regular patient searches and public statistics exclude those fixtures; demo accounts see clear sample-data labels, and sample records cannot be treated as confirmed capacity or used to book care. Facility-entered availability is not a live feed; the app does not dispatch emergency services.

## Local setup

Requirements: Node.js, npm and a SQLite database for local development.

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

### Existing SQLite databases previously initialized with `db:push`

Do not run `migrate deploy` blindly against an existing database with no migration history. First stop application writes and make a verified backup. Compare the database with the pre-migration schema from commit `491d57d` and baseline only if there is no difference:

```sh
git show 491d57d:prisma/schema.prisma > /tmp/jeevan-phase4-schema.prisma
DATABASE_URL="$DATABASE_URL" npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel /tmp/jeevan-phase4-schema.prisma --exit-code
```

Proceed only if Prisma reports `No difference detected`. Then mark the schema baseline as already present and apply the new index migration:

```sh
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied 20261103103500_sqlite_baseline
npm run db:migrate:deploy
```

If the comparison reports any difference, stop; do not mark the baseline or reset the database. Prepare a separate reviewed backfill/migration for that database. The checked-in migrations target SQLite. Render is configured for a new persistent SQLite database; no live production database was connected, inspected or migrated as part of this work.

## Render deployment

`render.yaml` defines one Next.js web service: the UI and `/api/*` routes share a same-origin URL, so there is no separate frontend/backend service or CORS allowlist. It uses the existing SQLite provider with `DATABASE_URL=file:/var/data/jeevansahay.db` on a persistent disk and checks `/api/health`. The start command applies idempotent migrations after Render mounts the disk and before Next.js starts; build and pre-deploy commands cannot access an attached persistent disk ([Render disk limitations](https://render.com/docs/disks)). A disk-attached service cannot use zero-downtime deploys, so restarts and migrations create a downtime window. Auto-deploy is disabled; the Blueprint targets Node.js 22.

This is a single-instance SQLite deployment, not a horizontally scalable database architecture. It is suitable only for a single app instance and modest write volume; for multiple instances or higher write volume, migrate to PostgreSQL in a separate reviewed change—changing only `DATABASE_URL` is not sufficient because Prisma’s provider is currently SQLite. The persistent disk and selected Render service plan have Render-specific availability and cost constraints; review those in Render before provisioning. No external production database has been connected or migrated by this project change.

To deploy, create a Render Blueprint from the reviewed branch and configure required SMTP credentials in the service Environment page. Render assigns the service URL; it is both the frontend and API URL. The Google callback is `https://<render-service-host>/api/auth/google/callback`; add that exact callback in Google Cloud Console. The app derives the callback from the request origin when `GOOGLE_REDIRECT_URI` is unset. Set `NEXT_PUBLIC_APP_URL` only if using a custom canonical domain or if email links should use a specific origin.

| Variable | Used by | Requirement | Purpose and value source |
|---|---|---|---|
| `DATABASE_URL` | Backend | Set by Blueprint | SQLite file on the persistent disk. Do not replace with a PostgreSQL URL while Prisma's provider is `sqlite`. |
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
| `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`, `SEED_SUPER_ADMIN_NAME` | Backend | One-time admin bootstrap only | Set temporarily in Render Shell, run `npm run db:seed`, then remove the password variable. Use a unique 16–72-byte password; the seed will not promote an existing non-admin account. |
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

`npm run test:auth` creates a disposable SQLite database and local SMTP capture server. It covers registration, OTP limits/expiry, password reset, role access and logout, demo-data visibility, hospital tenant isolation and CRUD, patient-visible availability, appointments, emergency records, hospital approval/rejection, admin accounts/sessions, reports and audit logs. SMTP failure handling is exercised without sending real email; Google tests cover OAuth initiation and state validation, not a live Google login. Scoring tests check emergency-priority ordering. The production dependency audit currently reports no vulnerabilities.
