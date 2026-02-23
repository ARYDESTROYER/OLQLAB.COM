# PersonaPilot MVP

Corporate personality assessment platform with hybrid quiz support:
- Trait-based personality questions (Likert scale)
- Scenario-based behavior questions (option impacts by competency)

## What is implemented now

- Client search + create flow in admin (no manual tenant ID input)
- Employee CSV import + invite sending
- Direct single-user add flow (no CSV required)
- Solo buyer flow (auto-creates 1-seat client + user)
- Directory view for clients/users from admin UI
- Hybrid assessment builder:
  - `LIKERT_TRAIT` questions
  - `SJT_SINGLE` scenario questions
  - per-option weighted competency impacts
- One-click recommended 40-question template (25 personality + 15 scenarios)
- Spreadsheet-to-builder import (CSV paste)
- Assessment publish policy controls
- Session runtime supports both question types
- Scoring engine computes:
  - Big Five trait percentages
  - competency impact totals
- Employee and leader report pages upgraded for mixed scoring output
- AI-assisted narrative sections (optional, when `OPENAI_API_KEY` is set)
- PDF report download endpoint with trait bars and development summary

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Prisma ORM
- Postgres (Neon / Vercel Marketplace DB)
- NextAuth/Auth.js magic link auth
- Resend email delivery
- Tailwind CSS

## Environment variables

Create `.env.local` from `.env.example`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
NEXTAUTH_SECRET="replace-with-random-secret"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY="re_xxx"
EMAIL_FROM="noreply@yourdomain.com"
OPENAI_API_KEY=""
REPORT_LLM_MODEL="gpt-4o-mini"
```

For production on Vercel, use your real domain in `NEXTAUTH_URL`.

## Local setup

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

## Admin workflow

1. Open `/admin`
2. Search/select client or create one
3. Import employee CSV (`email,first_name,last_name,manager_email`)
4. Send invites
5. Build assessment in visual builder or import spreadsheet CSV
6. Create assessment
7. Publish and configure visibility policy

## Spreadsheet CSV format for quiz import

Paste CSV into **Optional: Paste Spreadsheet CSV** in admin.

Required header:

```csv
question_code,section_title,section_kind,question_type,category,prompt,trait,reverse,scale_min,scale_max,option_code,option_text,impacts
```

Notes:
- `section_kind`: `PERSONALITY` or `SCENARIO`
- `question_type`: `LIKERT_TRAIT` or `SJT_SINGLE`
- For scenario questions, repeat the same `question_code` on multiple rows (one row per option)
- `impacts` format example:
  - `emotional_intelligence:+1,collaboration:+1`
  - `emotional_intelligence:-1,collaboration:-1`

## API routes

- `GET /api/admin/tenants` (search)
- `POST /api/admin/tenants`
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `POST /api/admin/users/import-csv`
- `POST /api/admin/invites/send`
- `GET /api/admin/assessments`
- `POST /api/admin/assessments`
- `POST /api/admin/assessments/:id/publish`
- `POST /api/assessment/sessions/start`
- `GET /api/assessment/sessions/:id`
- `POST /api/assessment/sessions/:id/answer`
- `POST /api/assessment/sessions/:id/submit`
- `GET /api/reports/me/:assessmentId`
- `GET /api/reports/me/:assessmentId/pdf`
- `GET /api/reports/leader/:userId/:assessmentId`

## Migrations added

- `prisma/migrations/20260223170000_init`
- `prisma/migrations/20260223231000_hybrid_assessment`

## Deploy to Vercel

1. Push code to GitHub
2. Import repo in Vercel
3. Attach Neon (or another Postgres provider)
4. Add env vars in Vercel project
5. Deploy
6. Run migrations in production:

```bash
DATABASE_URL="<PROD_DB_URL_UNPOOLED>" npx prisma migrate deploy
```

7. Seed demo data if needed:

```bash
DATABASE_URL="<PROD_DB_URL_UNPOOLED>" npm run prisma:seed
```

## Full Project Journal / Diary

This section is the full running log of what was planned, what happened, what failed, what was fixed, and what state the system is currently in.

### Journal conventions

- `UTC exact`: timestamp taken directly from logs.
- `Local approx`: timestamp inferred from local file times/interaction order.
- Secrets are intentionally redacted in this document.

### Original objective and plan baseline

`Date: 2026-02-23 (Local approx)`

Initial objective:
- Build and deploy a same-day pilot of a corporate personality platform.
- Core requirement set:
  - tenant/company model
  - invite-only auth
  - employee quiz
  - score + report
  - leader visibility controls
  - admin controls for authoring/publishing and onboarding

Original architecture plan:
- Next.js App Router + TypeScript
- Prisma + Postgres
- Vercel deploy
- Resend for email magic links
- report narrative + score bands

### Build timeline (chronological)

1. `2026-02-23T17:11:55Z` (UTC exact)
- First production runtime errors appeared.
- Error class: `next-auth NO_SECRET`.
- Impact: `/`, `/api/auth/providers`, `/api/auth/error` returned 500.

2. `2026-02-23T17:14:57Z` to `2026-02-23T17:15:36Z` (UTC exact)
- Repeated auth 500 failures continued.
- Root cause remained missing `NEXTAUTH_SECRET`.

3. `2026-02-23 21:31 local` (Local approx from scaffold file timestamps)
- App scaffolded from empty repo.
- Initial CLI issue: folder name (`New project`) violated npm naming for `create-next-app`.
- Workaround used: scaffold temp dir, sync files into current repo.

4. `2026-02-23 (Local approx)`
- Initial backend and data model implemented:
  - tenant, user, seats, assessments, sessions, answers, score, report, invites, audit
  - auth + api routes + basic UI pages

5. `2026-02-23 (Local approx)`
- Build blockers encountered and fixed:
  - Prisma 7 required newer Node than environment had.
    - Fix: pin Prisma/Client to `6.8.2`.
  - `next-auth` email provider required `nodemailer`.
    - Fix: add `nodemailer`.
  - eager env validation caused compile-time crash when envs absent.
    - Fix: switch to lazy env access runtime helpers.

6. `2026-02-23 21:52:58` to `21:53:17` (from user-provided Vercel build log)
- Vercel build failed due Prisma client generation cache behavior.
- Error: Prisma client outdated in Vercel dependency cache.
- Fix applied:
  - `build` script => `prisma generate && next build`
  - `postinstall` script => `prisma generate`

7. `2026-02-23 (Local approx)`
- Neon marketplace DB selected (instead of old standalone Vercel Postgres UX).
- DB connectivity validated from local code.
- Initial Prisma migration created and applied.

8. `2026-02-23 (Local approx)`
- Production DB operations run:
  - migrations deployed
  - seed executed
  - admin user bootstrap for requested email completed

9. `2026-02-23T17:20:57Z` (UTC exact check run later)
- Auth endpoint health check passed:
  - `/api/auth/providers` returns `200`.
- Confirms `NEXTAUTH_SECRET` + auth config healthy.

10. `2026-02-23 (Local approx, post-fix phase)`
- Admin and assessment model re-architected:
  - replaced raw-ID admin forms with guided workflow
  - added tenant search
  - added hybrid question model (personality + scenarios)
  - added competency impact scoring per option

11. `2026-02-23 (Local approx, redesign phase)`
- UI redesign completed:
  - improved typography/background hierarchy
  - clearer sections and operational flow
  - better report screens and quiz experience
  - typo redirect route added: `/singin` -> `/signin`

12. `2026-02-23 (Local approx, advanced features phase)`
- Added:
  - direct single-user add API + UI (no CSV needed)
  - solo-buyer flow (auto 1-seat client + user)
  - admin overview metrics
  - directory-style user/client visibility panel

13. `2026-02-23 (Local approx, content/reporting phase)`
- Added high-quality recommended assessment template:
  - 40 total questions
  - 25 Big Five Likert items
  - 15 scenario items with weighted competency impacts

14. `2026-02-23 (Local approx, AI/PDF phase)`
- Added optional LLM narrative augmentation (OpenAI integration).
- Added downloadable PDF report endpoint with:
  - participant identity block
  - trait bars
  - competency indicators
  - strengths / growth / action plan
  - AI-assisted sections when available

15. `2026-02-23 (Local exact from command output)`
- Seed run confirmed:
  - `questionCount: 40`
  - `competencyCount: 8`
- Admin account check confirmed:
  - `littlemasteraryan@gmail.com` exists
  - role `ADMIN`
  - tenant `demo-tenant`

### What worked

- Vercel deployment pipeline after Prisma script fix.
- Auth magic links once `NEXTAUTH_SECRET` was set.
- Neon DB integration and migrations.
- Resend domain verification and sending.
- Invite-only access gating by seat allowlist.
- Assessment runtime and scoring.
- Hybrid model (traits + scenario competency scoring).
- PDF generation endpoint and delivery.

### What failed (and corresponding fixes)

1. Scaffold command failed due folder naming.
- Fix: scaffold in temp dir and sync.

2. Prisma/Node compatibility mismatch (Prisma 7 vs Node 20.12).
- Fix: pinned Prisma to 6.8.2.

3. Missing `nodemailer` for next-auth email provider.
- Fix: added dependency.

4. Build-time env parsing crash.
- Fix: lazy env loading pattern.

5. Vercel cached Prisma client issue.
- Fix: run `prisma generate` in `build` + `postinstall`.

6. Production auth 500s (`NO_SECRET`).
- Fix: set `NEXTAUTH_SECRET` in Vercel env.

### Current deployed architecture/state (as of 2026-02-23)

Platform:
- Hosting: Vercel
- Database: Neon Postgres via Vercel Marketplace
- Auth: NextAuth email magic links
- Mail: Resend
- Domain: `www.olqlab.com` (canonical routing observed)

Runtime status checks:
- `/api/auth/providers` healthy (200).
- DB migration state includes:
  - `20260223170000_init`
  - `20260223231000_hybrid_assessment`

App capabilities currently implemented in code:
- Admin:
  - tenant search/create
  - employee CSV import
  - direct single-user add
  - solo buyer onboarding
  - user directory visibility
  - assessment builder with mixed question types
  - 40-question recommended template loader
  - publish policy controls
- Participant:
  - magic-link sign-in
  - mixed-format assessment flow
  - delayed/policy-based report access
- Reporting:
  - trait and competency output
  - narrative sections
  - optional AI-enriched narrative
  - PDF export endpoint

### Conventional norm choices (design rationale)

Implemented according to mainstream corporate assessment patterns:
- personality section is no-right/no-wrong
- scenario section scored on behavioral impacts
- manager-facing output remains developmental
- reports combine metrics + narrative + action steps

### Known limitations / next backlog

1. Psychometric calibration still lightweight.
- Current scoring is deterministic and useful for pilot, but not normed against validated benchmark populations.

2. Advanced enterprise controls are not complete yet.
- No SSO/SAML.
- No full compliance pack in product (SOC2/GDPR process docs deferred).

3. Rich analytics and custom branding can be expanded.
- Team-level heatmaps and advanced export packs can be deeper.

4. Model governance for AI narratives.
- Currently optional and prompt-constrained; can add stricter rubric templates and review workflow.

### Exact commands/checks used during stabilization

Build/lint stabilization:
- `npm run lint`
- `npm run build`
- `npx prisma generate`

DB operations:
- `npx prisma migrate deploy`
- `npm run prisma:seed`

Operational checks:
- `GET /api/auth/providers`
- direct DB assertions for admin existence and question counts

### Security note log

- Credentials were shared during setup for rapid testing.
- Best practice after this phase:
  - rotate DB credentials
  - rotate Resend API key
  - rotate OpenAI key when added

### Deployment handoff snapshot

If redeploying from this revision:
1. Push code.
2. Ensure Vercel envs:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - optional: `OPENAI_API_KEY`, `REPORT_LLM_MODEL`
3. Redeploy.
4. Run `prisma migrate deploy`.
5. Run seed if you want demo baseline data.

This README section is intentionally exhaustive and acts as the project diary/history ledger up to this point.

## Journal Addendum - Corrective Pass

Timestamp:
- UTC exact: `2026-02-23T19:19:48Z`
- Local exact (IST): `2026-02-24 00:49:48 IST`

Context of this pass:
- Complaint set addressed:
  - non-admin users seeing admin navigation/UI
  - assessment not clearly accessible from home
  - need for completion tracker (who completed / in progress / not started)
  - need for cleaner, less confusing landing/dashboard behavior

### What was changed in this pass

1. Role segregation and admin gating
- Added server-side role guard on `/admin`.
- Non-admin users are now redirected away from `/admin`.
- Home page now conditionally renders admin actions only for `ADMIN` role.
- File changes:
  - `src/app/admin/page.tsx` (server gate wrapper)
  - `src/app/admin/AdminClient.tsx` (client admin UI moved here)
  - `src/app/page.tsx` (role-based dashboard cards)

2. Assessment accessibility and discoverability
- Replaced old redirect-only `/assessment/current` with an Assessment Center list:
  - shows all published assessments for the user tenant
  - shows status per assessment (`Not Started`, `In Progress`, `Completed`)
  - action buttons route to start/resume/report directly
- Tightened session start permissions:
  - user must belong to assessment tenant
  - assessment must be published in same tenant
  - valid seat required in that tenant
- Added read-only protection for submitted sessions.
- If already submitted, assessment start routes user to report.
- File changes:
  - `src/app/assessment/current/page.tsx`
  - `src/app/api/assessment/sessions/start/route.ts`
  - `src/app/api/assessment/sessions/[id]/answer/route.ts`
  - `src/app/api/assessment/sessions/[id]/submit/route.ts`
  - `src/app/assessment/[assessmentId]/page.tsx`
  - `src/app/assessment/session/[sessionId]/page.tsx`

3. Admin QoL tracker: completion and participant status
- `GET /api/admin/assessments` now returns participant completion stats per assessment:
  - total participants
  - completed
  - in progress
  - not started
  - completion rate
- New endpoint:
  - `GET /api/admin/assessments/:id/participants`
  - returns per-user status and timestamps
- Admin UI now includes "Assessment Participation Tracker" table with filter:
  - ALL / SUBMITTED / IN_PROGRESS / NOT_STARTED
- File changes:
  - `src/app/api/admin/assessments/route.ts`
  - `src/app/api/admin/assessments/[id]/participants/route.ts`
  - `src/app/admin/AdminClient.tsx`

4. Authentication and invite flow corrections
- Sign-in now requires both:
  - existing user record
  - valid seat in that user tenant
- Seat is marked assigned at first successful sign-in.
- Directly added users are now created with `assigned: false` seat so invite flow works as intended.
- CSV import now enforces seat limits and reports `seat_limit_reached` skips.
- File changes:
  - `src/lib/auth.ts`
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/admin/users/import-csv/route.ts`

5. Additional hardening
- Leader report endpoint now verifies assessment tenant scope explicitly.
- File changed:
  - `src/app/api/reports/leader/[userId]/[assessmentId]/route.ts`

### Validation results after changes

Commands run:
- `npm run lint` -> pass
- `npm run build` -> pass

Build output confirms route registration for:
- `/admin`
- `/assessment/current`
- `/api/admin/assessments/[id]/participants`
- all existing assessment/report APIs

### Notes

- The original long-form journal remains intact above; this section is only the latest corrective pass.
- No secrets were added to the repository in this pass.
