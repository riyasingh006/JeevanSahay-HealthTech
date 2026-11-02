# Jeevan Sahay implementation plan

## Inspection findings (2026-11-02)

- Existing application: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Prisma 6, SQLite locally; existing patient-facing pages, public hospital discovery, AI assistant, API handlers, and a hospital portal shell already exist. Preserve these rather than replacing the application.
- The Patient Portal is the visual reference. Its existing palette, shell, navigation, and components remain protected; hospital/admin work will extend the current patterns.
- Authentication baseline: password hashing, login/register/logout endpoints, Google OAuth routes, and role checks existed, but signup activated accounts immediately, OTP/recovery controls were placeholders, Google OIDC validation was incomplete, sessions had no server-side revocation, and portal layouts relied on token-only middleware. Phase 1 now adds email verification/recovery/passwordless flows, PKCE + OIDC validation, database-backed revocable sessions, and server-side portal role checks.
- Hospital pages and their provider currently use in-memory demo records. Existing database-backed APIs cover hospital discovery and some doctor/bed/service data; appointments, departments, emergency cases, and a full admin UI are not present. Admin APIs exist for users, hospitals, reports, and stats.
- Prisma models users, hospitals, beds, doctors, services, saved hospitals, searches, notifications, reports, reviews, chat, and audit logs; Phase 1 adds OTPs, revocable sessions, and hospital applications. No versioned migration history or committed database exists. The seed now refuses non-empty databases, blocks demo fixtures in production, and provisions a super-admin only from explicitly configured environment values.
- No project README, project-specific `AGENTS.md`, or automated test suite was found. Render configuration and environment-variable documentation are absent.
- Baseline checks before implementation: production build succeeded; TypeScript passed after Next generated ignored image declarations; ESLint passed with 26 warnings; no automated tests existed. Phase 1 now adds an isolated SMTP-capture/database integration test runner.

## Protected behaviour and implementation rules

1. Keep the existing architecture and patient UI; no portal rewrite or duplicate routes/components.
2. Never seed, reset, or migrate against a user database during development. Exercise schema changes only against disposable databases, and make production changes additive/backward-compatible with backups and explicit migration steps.
3. Do not grant roles from client input. Public signup is limited to patients and hospital applications; admin creation stays restricted to a protected provisioning path.
4. Treat demo information as demo; do not label it live. Keep existing working patient discovery, profile, saved-hospital, emergency guidance, AI, and notification flows intact.
5. After each phase: run available tests, lint/type/build checks, exercise affected UI-to-API-to-database flows, fix failures, report changed files and verified scope, then make a meaningful Git commit only when the gate passes.
6. External Google OAuth and email delivery cannot be declared production-operational until the owner configures their credentials. Implement their real flows and report credential-dependent test limits accurately.

## Phases and verification gates

| Phase | Scope | Gate before proceeding |
|---|---|---|
| 1. Authentication | Email/password signup and login; patient registration and pending hospital applications; email OTP verification, resend limits, password recovery, Google OIDC validation/linking, role redirects, revocable sessions, and safe cookies. Keep the existing auth-page design. | Auth integration tests cover valid/invalid signup, OTP expiry/attempts/resend, login/logout, reset/session revocation, role denial, and OAuth validation; run lint, typecheck, and production build. Test SMTP against a local capture service; live Google/email provider tests remain credential-dependent. |
| 2. Patient Portal | Audit existing workflows and connect only supported patient actions to real records without changing the visual design. | Existing patient flows plus affected APIs run against a disposable database; responsive/build checks. |
| 3. Hospital Portal | Replace demo-only actions incrementally with scoped, verified-hospital APIs for dashboard, beds, doctors, departments, appointments, emergencies, services, profile, and analytics. Clearly mark any remaining sample data. | Cross-hospital isolation and CRUD/API/UI checks; no unverified hospital can manage data; build/lint/typecheck. |
| 4. Admin Portal | Add an admin experience in the existing design language, complete review workflows, safe user/data management, complaints/reports, analytics, exports, and audit trail. | Admin-only access, approval/rejection audit checks, filtered/export data checks, and build gates. |
| 5. Database/backend integration | Reconcile existing models with missing entities and relationships; add constraints/indexes and versioned migrations; use transactions and safe upgrade/backfill procedures. No destructive migrations without explicit approval. | Apply every migration to a fresh disposable database and an upgrade fixture; verify preserved records, constraints, and API behaviour. |
| 6. Real/demo data | Remove misleading live claims, make remaining demo data visibly labelled and centrally managed, and avoid fake emergency/availability claims. | UI and API checks for all demo/real data labels and source behaviour. |
| 7. Notifications/email | Reuse the mail service for account, hospital, appointment, and complaint notices; use environment configuration only. | Captured-email tests for templates/recipients and failure handling; real delivery requires provider credentials. |
| 8. UI/responsiveness | Preserve the Patient Portal and extend its layout, states, controls, and mobile behaviour across other portals. | Desktop/tablet/mobile checks and interaction/empty/error state checks. |
| 9. Testing/bug fixing | Establish and run automated unit/integration coverage, authorization tests, and frontend/backend checks across the app. | All repository checks pass; accurately list any provider-dependent tests not executable here. |
| 10. Render preparation | Configure the existing app/database deployment, environment-variable guide, Google/email setup, production cookies/CORS/origins, and safe migration/deploy commands. | Validate production build/start configuration and document exact Render settings without exposing secrets. |

## Current status

- Phase 0 inspection and implementation plan: complete.
- Phase 1 authentication: complete; committed only after its verification gate passed.
- Phase 2 Patient Portal: next; not started.
- Phase 1 verification: `npm run test:auth` passes all 10 end-to-end checks against a disposable SQLite database and local SMTP capture server; `npm run typecheck` passes; `npm run lint` exits successfully with 21 pre-existing unused-variable warnings; production `npm run build` succeeds. Patient and hospital client shells were preserved byte-for-byte while adding server-side role/session guards.
- No user database was seeded or migrated. Google and email providers were exercised with local test credentials/capture only; production Google and SMTP delivery still require owner credentials.
