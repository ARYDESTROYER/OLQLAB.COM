# OLQLAB

OLQLAB is a multi-organisation workplace assessment platform with a global assessment library and explicit access control.

## Admin Console Re-Architecture (Implemented)

Date: 2026-02-24

The platform now follows a global-assessment model:
- Assessments are created without mandatory organisation assignment.
- Access is granted through explicit enrollments.
- Access is removed through explicit unenroll jobs with report-access policy control.

### Locked product decisions
1. Access is a union: direct user enrollment OR organisation enrollment.
2. A user belongs to exactly one organisation; a "solo" user is a dedicated `SOLO` organisation with one seat.
3. Admins are global admins (not organisation-scoped for admin operations).
4. Organisation enrollment always supports `includeFutureUsers` behavior.
5. Unenroll uses a configurable workflow: timing + report mode + optional email.
6. Temporary report links are signed, no-login, expiring URLs.
7. Notification channel is email.
8. Unenroll execution uses lazy enforcement plus internal cron endpoint fallback.
9. Admin IA is sectioned: `/admin/users`, `/admin/tenants`, `/admin/assessments`.

## What is implemented

- Admin IA split into route sections:
  - `/admin` (overview KPIs + pending jobs + shortcuts)
  - `/admin/users`
  - `/admin/tenants`
  - `/admin/assessments`
  - `/admin/assessments/:id` with tabs: `Content`, `Access`, `Participants`, `Policy`, `Jobs`
- New explicit enrollment model:
  - `AssessmentUserEnrollment`
  - `AssessmentTenantEnrollment`
- Unenroll orchestration:
  - `AssessmentUnenrollJob`
  - `AssessmentReportAccessOverride`
  - `AssessmentReportShareToken`
- Access resolver (`resolveAssessmentAccess`) used by participant runtime and report gates.
- Share-link endpoints:
  - `GET /api/reports/shared/:token`
  - `GET /api/reports/shared/:token/pdf`
- Internal unenroll job execution endpoints:
  - `POST /api/internal/jobs/unenrollments/run`
  - `POST /api/internal/jobs/unenrollments/:id/run`
- Assessment competencies moved to assessment scope (`AssessmentCompetency`) and scoring supports new mapping.
- Backfill and rollback scripts for migration support.

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Prisma ORM
- Postgres
- NextAuth/Auth.js (magic link)
- Resend email
- Tailwind CSS

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
DIRECT_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxx"
NEXTAUTH_SECRET="replace-with-random-secret"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY="re_xxx"
EMAIL_FROM="noreply@yourdomain.com"
OPENAI_API_KEY=""
REPORT_LLM_MODEL="gpt-4o-mini"
INTERNAL_JOB_SECRET="replace-with-random-secret"
REPORT_SHARE_BASE_URL="http://localhost:3000"
```

## Local setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

## Migration and backfill

Neon + Prisma note:
- Use `DATABASE_URL` for the pooled runtime connection.
- Use `DIRECT_DATABASE_URL` for Prisma Migrate and other schema operations.
- On Neon, `DIRECT_DATABASE_URL` should be the non-pooler endpoint, not the `-pooler` host.

Question image upload note:
- Use `BLOB_READ_WRITE_TOKEN` for Vercel Blob uploads.
- Question images are stored in Blob and their public URL is saved into `Question.imageUrl`.

Schema migration added:
- `prisma/migrations/20260224100000_global_assessment_enrollments`

Backfill scripts:

```bash
npm run prisma:backfill:global-assessments
npm run prisma:rollback:global-assessments
```

Backfill effects:
- Creates active organisation enrollments for legacy assessments.
- Sets `ownerTenantId` from legacy organisation linkage.
- Creates `AssessmentCompetency` records and remaps `OptionImpact`.

## Runtime access semantics

`resolveAssessmentAccess(userId, assessmentId, atTime)` returns:
- `hasActiveEnrollment`
- `canStartAssessment`
- `canViewAppReport`
- `canViewViaLinkOnly`
- `isRevoked`
- `sources`

Precedence rule:
- Active enrollment always wins over restrictive overrides.

## Unenroll report modes

- `KEEP_APP_ACCESS`: assessment start blocked after unenroll, report still app-visible.
- `LINK_ONLY`: app report access blocked, temporary signed link is allowed.
- `REVOKE`: app report access blocked, no link behavior.

## API catalog

### Admin: assessments
- `GET /api/admin/assessments`
- `POST /api/admin/assessments`
- `GET /api/admin/assessments/:id`
- `PATCH /api/admin/assessments/:id`
- `DELETE /api/admin/assessments/:id`
- `POST /api/admin/assessments/:id/publish`
- `GET /api/admin/assessments/:id/access`
- `POST /api/admin/assessments/:id/enrollments`
- `POST /api/admin/assessments/:id/unenroll`
- `GET /api/admin/assessments/:id/jobs`
- `GET /api/admin/assessments/:id/participants`
- `POST /api/admin/assessments/:id/participants`
- `POST /api/admin/assessments/:id/participants/:userId/retest`
- `DELETE /api/admin/assessments/:id/participants/:userId/retest`
- `POST /api/admin/assessments/:id/participants/:userId/reset`

### Admin: users
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/users/:id/tests`
- `GET /api/admin/users/:id/access`
- `POST /api/admin/users/:id/enrollments`
- `POST /api/admin/users/import-csv`

### Admin: organisations
- `GET /api/admin/tenants`
- `POST /api/admin/tenants`
- `PATCH /api/admin/tenants/:id`
- `GET /api/admin/tenants/:id/users`
- `GET /api/admin/tenants/:id/access`
- `POST /api/admin/tenants/:id/enrollments`

### Admin: operations
- `GET /api/admin/overview`
- `POST /api/admin/reports/regenerate`
- `POST /api/admin/invites/send`

### Internal jobs
- `POST /api/internal/jobs/unenrollments/run`
- `POST /api/internal/jobs/unenrollments/:id/run`

### Participant runtime
- `POST /api/assessment/sessions/start`
- `GET /api/assessment/sessions/:id`
- `POST /api/assessment/sessions/:id/answer`
- `POST /api/assessment/sessions/:id/submit`
- `GET /api/reports/me/:assessmentId`
- `GET /api/reports/me/:assessmentId/pdf`
- `GET /api/reports/leader/:userId/:assessmentId`

### Shared report links
- `GET /api/reports/shared/:token`
- `GET /api/reports/shared/:token/pdf`

## Admin payload contracts

Enrollment payload:

```json
{
  "scope": "USER | TENANT",
  "targetId": "string",
  "includeFutureUsers": true
}
```

Unenroll payload:

```json
{
  "scope": "USER | TENANT",
  "targetId": "string",
  "effectiveAt": "ISO datetime",
  "reportMode": "KEEP_APP_ACCESS | LINK_ONLY | REVOKE",
  "notifyByEmail": false,
  "linkTtlHours": 168
}
```

## Quality gates

```bash
npm run lint
npm run build
```

Current branch status after this re-architecture pass:
- `npm run lint` passes.
- `npm run build` passes.

## Engineering journal

Implementation diary is append-only in `journal.md`.
