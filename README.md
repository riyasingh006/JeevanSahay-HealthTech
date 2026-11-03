# Jeevan Sahay

A Next.js healthcare-directory application with patient, hospital and super-admin roles. The existing Patient Portal and hospital UI are retained; the authentication and hospital-management workflows are connected to the database.

## Current implementation

- Authentication: patient signup, email verification, passwordless email code, password recovery, Google OIDC/PKCE, revocable sessions and role checks.
- Patient portal: private profile, hospital search, saved hospitals, appointment requests/cancellation and PIN-protected health sharing.
- Hospital portal: verified-hospital-only dashboard, bed inventory, departments, doctors, services, appointment handling, emergency case log, profile, notifications, settings and persisted analytics.
- Hospital updates to itemised beds update the patient-facing availability aggregates transactionally. Hospital accounts cannot read or modify another hospital's records.
- Admin portal: protected overview and analytics, hospital application verification/rejection, searchable account suspension/reactivation, report triage, CSV exports and read-only audit review. Admin actions are role-checked, audited and session-revoking where appropriate.
- Hospital applicants remain pending until a super-admin approves them; approval/rejection is transactional, creates an in-app notification and sends an email when SMTP is configured. Approvals require verified email and confirmed map coordinates.
- Versioned production migrations remain a later implementation phase; do not treat `db:push` as a production migration strategy.

## Local setup

Requirements: Node.js, npm and a SQLite database for local development.

```sh
npm install
cp .env.example .env
```

Set a long random `SESSION_SECRET` in `.env` (for example, generate one with `openssl rand -hex 32`). Email verification, password recovery and passwordless login require a working SMTP provider. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` and `SMTP_SECURE`; set `NEXT_PUBLIC_APP_URL` to the origin served by the app. Google sign-in is optional and requires the Google OAuth client ID, secret and matching callback URL in `GOOGLE_REDIRECT_URI`.

For a **new local database only**, apply the current Prisma schema and start the app:

```sh
npm run db:push
npm run dev
```

Open `http://localhost:3000`. Existing users and hospitals are not created automatically. The `db:push` command is intended for a fresh local database until the versioned production-migration phase is complete. Back up any existing database before changing its schema.

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
npm run test:auth
npm run build
```

`npm run test:auth` creates a disposable SQLite database and local SMTP capture server. It covers authentication, OTP limits/expiry, role access, hospital tenant isolation, patient-visible bed/service updates, appointments, emergency records, profile/settings, hospital approval/rejection, admin account/session controls, report workflows and audit logging. It does not send real email or call Google. ESLint currently reports 11 unused-variable warnings in pre-existing hospital cards, detail tabs, landing, badge and scoring files; there are no lint errors.
