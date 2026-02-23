# OLQLAB Guide

This guide is the complete handover for the OLQLAB assessment platform.
It explains product behavior, code structure, local development, and production deployment with Vercel + Neon + Resend.

## 1. What OLQLAB Is

OLQLAB is a corporate personality and workstyle assessment platform.
It supports:
- invite-only email sign-in (magic link)
- role-based access (`ADMIN`, `EMPLOYEE`, `LEADER`)
- hybrid assessments:
  - personality Likert questions (`LIKERT_TRAIT`)
  - scenario questions with weighted competency scoring (`SJT_SINGLE`)
- participant reports + leader view + PDF export
- admin controls for client onboarding, participant imports, assessment creation, publish policy, and completion tracking

## 2. Core User Roles

- `ADMIN`
  - Access to `/admin`
  - Creates tenants (clients), users, assessments, and policies
  - Sees participation tracking and directory
- `EMPLOYEE`
  - Can take assigned assessment(s)
  - Can view own reports (depending on publish policy)
- `LEADER`
  - Can do everything EMPLOYEE can
  - Can view direct-report leader reports if policy allows

## 3. Current Product Flows

### 3.1 Sign-in Flow

1. User enters email at `/signin`
2. Magic link sent via Resend
3. On sign-in callback:
   - user record must exist
   - user must have a valid seat in that tenant
   - seat is marked `assigned=true` after successful sign-in

### 3.2 Assessment Flow

1. User opens `/assessment/current` (Assessment Center)
2. Sees all published assessments in tenant with status:
   - `Not Started`
   - `In Progress`
   - `Completed`
3. Starts/resumes assessment
4. Answers saved per question
5. Submit generates:
   - trait scores
   - competency scores
   - narrative report (plus optional AI augmentation)

### 3.3 Report Flow

- `/reports/current` lists all submitted reports for current user
- `/reports/me/[assessmentId]` shows full participant report
- `/api/reports/me/[assessmentId]/pdf` downloads PDF report

### 3.4 Admin Flow

1. `/admin` -> search/select/create client
2. Add users via CSV or direct single-user form
3. Optional solo-buyer flow (1-seat client + one user)
4. Build assessment in UI or load 40-question template
5. Publish with policy controls
6. Track participation:
   - total
   - completed
   - in progress
   - not started

## 4. Project Structure

- `src/app/page.tsx`
  - Landing page (logged out) + workspace dashboard (logged in)
- `src/app/admin/page.tsx`
  - Server guard wrapper (admin-only)
- `src/app/admin/AdminClient.tsx`
  - Full admin UI
- `src/app/assessment/current/page.tsx`
  - Assessment Center
- `src/app/reports/current/page.tsx`
  - Reports list for current user
- `src/app/api/*`
  - Route handlers for admin/auth/assessment/reports
- `src/lib/auth.ts`
  - NextAuth config + sign-in gate logic
- `src/lib/score.ts`
  - scoring and base narrative generation
- `src/lib/ai-report.ts`
  - optional LLM narrative enrichment
- `prisma/schema.prisma`
  - DB schema
- `prisma/migrations/*`
  - migration history
- `prisma/seed.ts`
  - seed data and recommended template

## 5. Environment Variables

Create `.env.local` from `.env.example`.

Required:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Optional:
- `OPENAI_API_KEY`
- `REPORT_LLM_MODEL` (default: `gpt-4o-mini`)

## 6. Local Development

```bash
cd "/Users/ary/Documents/New project"
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Open:
- `http://localhost:3000`

Quality checks:
```bash
npm run lint
npm run build
```

## 7. Deploy (Vercel + Neon + Resend)

### 7.1 Vercel Project Setup

1. Push repo to GitHub
2. Import repo in Vercel
3. In Vercel Storage, create/attach Neon Postgres
4. Add environment variables in Vercel project settings

### 7.2 Neon Setup

Use:
- pooled URL for app runtime (`DATABASE_URL`)
- non-pooled URL for migration commands if needed

After deploy, run migrations:
```bash
DATABASE_URL="<PROD_DATABASE_URL_UNPOOLED>" npx prisma migrate deploy
```

Optional seed:
```bash
DATABASE_URL="<PROD_DATABASE_URL_UNPOOLED>" npm run prisma:seed
```

### 7.3 Resend Setup

1. Add and verify sending domain in Resend
2. Create API key
3. Set:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` (verified sender, e.g. `noreply@olqlab.com`)

### 7.4 Auth Settings

- `NEXTAUTH_URL` must match production origin exactly (e.g. `https://www.olqlab.com`)
- `NEXTAUTH_SECRET` must be set in production

Generate secret:
```bash
openssl rand -base64 32
```

### 7.5 Domain

- Point domain to Vercel
- Set canonical primary domain in Vercel
- Ensure `NEXTAUTH_URL` matches canonical domain

## 8. API Overview

Admin:
- `GET /api/admin/tenants`
- `POST /api/admin/tenants`
- `GET /api/admin/overview`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `POST /api/admin/users/import-csv`
- `POST /api/admin/invites/send`
- `GET /api/admin/assessments`
- `POST /api/admin/assessments`
- `POST /api/admin/assessments/:id/publish`
- `GET /api/admin/assessments/:id/participants`

Assessment runtime:
- `POST /api/assessment/sessions/start`
- `GET /api/assessment/sessions/:id`
- `POST /api/assessment/sessions/:id/answer`
- `POST /api/assessment/sessions/:id/submit`

Reports:
- `GET /api/reports/me/:assessmentId`
- `GET /api/reports/me/:assessmentId/pdf`
- `GET /api/reports/leader/:userId/:assessmentId`

Auth:
- `GET/POST /api/auth/[...nextauth]`

## 9. Operational Smoke Test (Production)

1. Sign in with admin email
2. Open `/admin`
3. Create/select tenant
4. Add participant (single or CSV)
5. Send invite
6. Create assessment and publish
7. Sign in as participant
8. Open `/assessment/current` and start assessment
9. Submit assessment
10. Open `/reports/current` and verify report + PDF download
11. Confirm admin tracker reflects participant status changes

## 10. Troubleshooting

### 10.1 "Start" button stuck on "Starting..."

Common root cause:
- frontend sends missing `assessmentId` to `/api/assessment/sessions/start`

Symptoms:
- logs show `PrismaClientValidationError` and `assessmentId is missing`

Fix:
- ensure dynamic routes use `useParams` in client components
- handle fetch failures with `try/catch/finally` so loading state resets
- redeploy latest commit

### 10.2 Magic link fails

Check:
- `NEXTAUTH_SECRET` set
- `NEXTAUTH_URL` correct
- `RESEND_API_KEY` valid
- `EMAIL_FROM` verified in Resend

### 10.3 Report not visible

Check publish policy:
- `showResultsToEmployee`
- `resultReleaseDelayHours`

### 10.4 Cannot sign in as invited user

Check both records exist:
- `User` for email
- `Seat` in same tenant for email

## 11. Security and Maintenance

- Rotate all leaked/shared credentials immediately
- Keep DB, email, and LLM keys only in Vercel env vars
- Never commit `.env.local`
- Re-run:
  - `npm run lint`
  - `npm run build`
  - before each production deployment

## 12. Notes for Future Developers

Recommended immediate next improvements:
- add automated test suite for session start/submit/report flows
- add audit logging for publish changes and admin mutations
- add in-app notifications/toasts for fetch failures
- add SSO (SAML/OIDC) for enterprise clients
