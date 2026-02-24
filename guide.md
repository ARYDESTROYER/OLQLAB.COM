# OLQLAB Guide (Global Assessments + Explicit Enrollment)

This is the technical handover for the current architecture after the admin-console rework.

## 1. Scope

The system now treats assessments as global objects and resolves participant access explicitly through enrollment records.

Old model (deprecated as access control):
- `Assessment.tenantId` implied tenant access.

Current model (canonical):
- direct user enrollment
- tenant enrollment
- report-access overrides after unenroll
- optional secure share links

## 2. Admin Information Architecture

Admin console is route-sectioned:
- `/admin`: overview dashboard, KPIs, pending unenroll jobs, recent actions
- `/admin/users`: directory + CRUD + tenant move + solo conversion + tests/access + direct enrollment actions
- `/admin/tenants`: tenant CRUD + seat limits + archive + roster + tenant enrollment actions
- `/admin/assessments`: global library + create/edit/delete/publish + access stats
- `/admin/assessments/:id`: detail tabs

Assessment detail tabs:
- `Content`
- `Access`
- `Participants`
- `Policy`
- `Jobs`

The detail page includes a multi-step unenroll wizard:
1. scope/target
2. timing
3. report mode
4. email + TTL settings
5. impacted-user preview + confirm

## 3. Roles and security

Roles:
- `ADMIN`: global admin operations
- `EMPLOYEE`
- `LEADER`

Guards:
- admin endpoints use `requireAdmin()`
- participant endpoints use `requireSession()`
- internal job endpoints require `INTERNAL_JOB_SECRET` unless admin-authenticated route variant is used

## 4. Access Model and Resolution

Single source of truth:
- `src/lib/assessment-access.ts`
- function: `resolveAssessmentAccess(userId, assessmentId, atTime)`

Resolution fields:
- `hasDirectEnrollment`
- `hasTenantEnrollment`
- `hasActiveEnrollment`
- `overrideMode`
- `canStartAssessment`
- `canViewAppReport`
- `canViewViaLinkOnly`
- `isRevoked`
- `sources`

Rules:
- Access union is `direct OR tenant`.
- Tenant enrollment respects `includeFutureUsers`.
- `canStartAssessment` requires published assessment and active enrollment.
- Restrictive override applies only when no active enrollment.
- Precedence: active enrollment wins over restrictive override.

## 5. Data Model (Prisma)

### 5.1 New enums
- `TenantType`: `ORGANIZATION | SOLO`
- `EnrollmentScope`: `USER | TENANT`
- `ReportAccessMode`: `KEEP_APP_ACCESS | LINK_ONLY | REVOKE`
- `UnenrollJobStatus`: `PENDING | COMPLETED | FAILED | CANCELLED`

### 5.2 Updated existing models
- `Tenant`
  - added: `type`, `isArchived`
- `Assessment`
  - legacy `tenantId` retained but nullable
  - added: `ownerTenantId` (lineage/ownership)
  - added relations for enrollments/jobs/overrides/tokens/assessment-competencies
- `OptionImpact`
  - added `assessmentCompetencyId`
  - legacy `competencyId` made optional

### 5.3 New models
- `AssessmentCompetency`
- `AssessmentTenantEnrollment`
- `AssessmentUserEnrollment`
- `AssessmentUnenrollJob`
- `AssessmentReportAccessOverride`
- `AssessmentReportShareToken`

## 6. Migration and backfill strategy

Applied migration:
- `prisma/migrations/20260224100000_global_assessment_enrollments/migration.sql`

It adds new enums/tables/columns, makes `Assessment.tenantId` nullable, and sets `ownerTenantId` from legacy tenant linkage.

Backfill script:
- `prisma/scripts/backfill-global-assessment-enrollments.ts`
- command: `npm run prisma:backfill:global-assessments`

Backfill behavior:
- create one active tenant enrollment for each legacy assessment
- copy legacy tenant to `ownerTenantId`
- create assessment-scoped competencies from legacy impact usage
- repoint `OptionImpact` to `assessmentCompetencyId`

Rollback script:
- `prisma/scripts/rollback-global-assessment-enrollments.ts`
- command: `npm run prisma:rollback:global-assessments`

Rollback behavior:
- remove backfill-tagged enrollments/competencies and detach mapped impact links

## 7. Admin API redesign

### 7.1 Assessments
- `GET /api/admin/assessments`
- `POST /api/admin/assessments` (tenant not required)
- `GET /api/admin/assessments/:id`
- `PATCH /api/admin/assessments/:id`
- `DELETE /api/admin/assessments/:id`
- `POST /api/admin/assessments/:id/publish`
- `GET /api/admin/assessments/:id/access`
- `POST /api/admin/assessments/:id/enrollments`
- `POST /api/admin/assessments/:id/unenroll`
- `GET /api/admin/assessments/:id/jobs`

### 7.2 Users
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/users/:id/tests`
- `GET /api/admin/users/:id/access`
- `POST /api/admin/users/:id/enrollments`

### 7.3 Tenants
- `GET /api/admin/tenants`
- `POST /api/admin/tenants`
- `PATCH /api/admin/tenants/:id`
- `GET /api/admin/tenants/:id/users`
- `GET /api/admin/tenants/:id/access`
- `POST /api/admin/tenants/:id/enrollments`

### 7.4 Jobs and links
- `POST /api/internal/jobs/unenrollments/run`
- `POST /api/internal/jobs/unenrollments/:id/run`
- `GET /api/reports/shared/:token`
- `GET /api/reports/shared/:token/pdf`

## 8. Canonical payload contracts

Enrollment payload (`POST /api/admin/assessments/:id/enrollments`):

```json
{
  "scope": "USER | TENANT",
  "targetId": "string",
  "includeFutureUsers": true
}
```

Unenroll payload (`POST /api/admin/assessments/:id/unenroll`):

```json
{
  "scope": "USER | TENANT",
  "targetId": "string",
  "effectiveAt": "2026-02-24T18:00:00.000Z",
  "reportMode": "KEEP_APP_ACCESS | LINK_ONLY | REVOKE",
  "notifyByEmail": false,
  "linkTtlHours": 168
}
```

## 9. Participant runtime updates

Updated runtime behavior:
- `/assessment/current` lists only published assessments with active resolved enrollment.
- `/api/assessment/sessions/start` gates via resolver (not tenant-id match).
- `/reports/current` lists only submitted reports with app access allowed.
- `/api/reports/me/:assessmentId` and `/pdf` enforce override/report-mode logic.

Leader/admin visibility:
- participant self-access restrictions do not automatically remove leader/admin-level visibility gates.

Retest/reset/regeneration:
- existing behaviors remain, but participant validity checks now rely on enrollment/participation logic rather than legacy tenant coupling.

## 10. Unenroll execution engine

Implementation:
- `src/lib/unenroll-jobs.ts`

Job execution flow (`runDueUnenrollJobs`):
1. fetch due jobs (`PENDING` + `effectiveAt <= now`) or forced job
2. deactivate matching enrollment records
3. compute impacted users snapshot
4. upsert `AssessmentReportAccessOverride`
5. for `LINK_ONLY`, mint signed tokens in `AssessmentReportShareToken`
6. optionally send email (Resend)
7. mark job as `COMPLETED` or `FAILED`

Execution modes:
- lazy: participant/report access routes trigger due-job checks
- fallback: internal cron endpoint processes due jobs

## 11. Share-link security model

Token table:
- hash only stored (`tokenHash`), never plaintext
- expiration (`expiresAt`)
- revocation (`revokedAt`)
- download cap (`maxDownloads`, `downloadsUsed`)

Validation rules:
- invalid, expired, revoked, or exhausted tokens are denied
- token-bound payload is restricted to its assessment/user
- `/pdf` consumes a download and returns downloadable PDF bytes

## 12. Admin UX behavior details

### 12.1 Users section
- create user
- delete user (non-admin)
- move user between tenants (seat checks)
- convert to solo (creates `SOLO` tenant)
- inspect tests/access
- direct enroll/unenroll wrapper actions

### 12.2 Tenants section
- create/edit tenant
- manage seat limit/type/archive
- inspect tenant users/access
- tenant enrollment and unenrollment wrappers

### 12.3 Assessments section
- create global assessment (optional owner tenant)
- publish/unpublish
- open detail view
- manage explicit user/tenant enrollments
- run unenroll wizard with scheduling and report mode controls
- inspect and manually run jobs

## 13. Validation checklist

Primary quality gates:

```bash
npm run lint
npm run build
```

Architecture scenarios to validate manually:
1. migration integrity for legacy assessments and impacts
2. access union (direct-only, tenant-only, combined)
3. no-enrollment invisibility for participants
4. `includeFutureUsers` true/false behavior for newly created users
5. unenroll mode behavior (`KEEP_APP_ACCESS`, `LINK_ONLY`, `REVOKE`)
6. scheduled job behavior before and after effective time
7. share-link security checks (invalid/expired/revoked/download-exhausted)
8. admin section routing and actions under `/admin/users`, `/admin/tenants`, `/admin/assessments`

## 14. Operational notes

- Legacy endpoints remain available for transition compatibility where still referenced.
- `Assessment.tenantId` remains for compatibility/history, but is not the canonical access gate.
- Future hardening:
  - move internal job execution to scheduled infrastructure (e.g., Vercel cron)
  - add background retry and alerting for failed job notifications
  - complete deprecation pass of any remaining legacy admin UI surfaces

## 15. Journal policy

Engineering activity is recorded append-only in `journal.md` with:
- UTC timestamp
- Local timestamp
- task/why/changes/how
- validation output
- risks/unknowns
- next step
