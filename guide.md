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

Product terminology convention:
- User-facing product copy should use `Organisation` / `Organisations`.
- Internal schema, route, and compatibility terms still use `tenant`, for example `tenantId`, `TenantType`, `AssessmentTenantEnrollment`, and `/admin/tenants`.
- This split is intentional. It preserves API/database compatibility while giving the UI a clearer business term.
- If a future task wants full domain renaming, treat it as a deeper refactor spanning Prisma schema, API contracts, query parameters, auth/session types, CSV shapes, internal jobs, and route paths.
- When editing admin UI, participant screens, reports, emails, or toast/error strings, prefer the business term `Organisation` unless the text is explicitly describing a technical field name.

## 2. Admin Information Architecture

Admin console is route-sectioned:
- `/admin`: overview dashboard, KPIs, pending unenroll jobs, recent actions
- `/admin/users`: participant directory + add user (solo or organisation) + move between orgs + tests/access inspection panel
- `/admin/tenants`: organisation directory + CRUD + seat limits + archive + roster/access inspection panel
- `/admin/assessments`: global library + create (title only) + publish/unpublish + manage via detail page
- `/admin/assessments/:id`: detail tabs

Assessment detail tabs:
- `Content`
- `Access` (manage user/tenant enrollments)
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
- `AssessmentQuestionPresentationMode`: `ALL_AT_ONCE | ONE_AT_A_TIME`
- `UnenrollJobStatus`: `PENDING | COMPLETED | FAILED | CANCELLED`

### 5.2 Updated existing models
- `Tenant`
  - added: `type`, `isArchived`
- `Assessment`
  - legacy `tenantId` retained but nullable
  - added: `ownerTenantId` (lineage/ownership)
  - added relations for enrollments/jobs/overrides/tokens/assessment-competencies
- `AssessmentPolicy`
  - added: `questionPresentationMode`
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
- `prisma/migrations/20260308120000_assessment_question_presentation_mode/migration.sql`

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

## 6.1 Vercel deployment rule for Prisma migrations

Do not use this in Vercel Build Command for production schema rollout:
- `npx prisma db push --accept-data-loss && npx prisma generate && next build`

Why this is wrong:
- `db push` does not apply tracked Prisma migrations from `prisma/migrations/*`.
- `db push` mutates the schema directly, which can drift from migration history.
- `--accept-data-loss` is especially unsafe in a deployed environment because it allows destructive schema changes without migration review.
- `npm run build` already runs `prisma generate && next build`, so adding another explicit `prisma generate` is redundant.

Correct command when you want Vercel to apply migrations during deploy:

```bash
npx prisma migrate deploy && npm run build
```

What this does:
- applies all unapplied SQL migrations from `prisma/migrations/*`
- records them in Prisma migration history
- then runs the normal production build

Important environment rule:
- If Preview and Production deployments point at the same database, do not leave `migrate deploy` in a global Vercel Build Command.
- Otherwise a preview deployment can attempt to run production migrations.
- Safe setup is one database per environment, or a one-time controlled production migration followed by a normal build command.

Recommended Vercel procedure for this repo:
1. Confirm `DATABASE_URL` is set correctly for the Production environment.
2. If Preview uses a separate database, you may keep `npx prisma migrate deploy && npm run build` as the build command.
3. If Preview shares the Production database, temporarily change the build command for the production rollout only, deploy once, confirm migration success in logs, then switch the build command back to `npm run build`.
4. Never use `db push --accept-data-loss` for this production migration flow.

For the current assessment presentation-mode change, the required migration is:
- `prisma/migrations/20260308120000_assessment_question_presentation_mode/migration.sql`

Practical Vercel settings check:
- `Framework Preset`: `Next.js` -> correct
- `Root Directory`: `/` -> correct if the repo root is the app root
- `Install Command`: blank/default -> fine if Vercel installs from `package-lock.json`
- `Output Directory`: default -> correct
- `Build Command`: screenshot value is not correct for migration rollout and should be replaced as described above

## 7. Admin API redesign

### 7.1 Assessments
- `GET /api/admin/assessments`
  - supports advanced filters/sort query params:
    - `q`, `status`, `minCompletionRate`, `maxCompletionRate`
    - `sortBy` (`createdAt|updatedAt|title|completionRate|participants`), `sortOrder`, `limit`
  - supports CSV export via `format=csv`
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
  - supports advanced filters/sort query params:
    - `q`, `tenantId`, `role`, `tenantType`, `hasManager`, `tenantArchived`
    - `sortBy` (`createdAt|updatedAt|name|email`), `sortOrder`, `limit`
  - supports CSV export via `format=csv`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/users/:id/tests`
- `GET /api/admin/users/:id/access`
- `POST /api/admin/users/:id/enrollments`

### 7.3 Tenants
- `GET /api/admin/tenants`
  - supports advanced filters/sort query params:
    - `q`, `includeArchived`, `type`, `seatState`
    - `sortBy` (`updatedAt|createdAt|name|seatLimit|seatsUsed|seatUtilization`), `sortOrder`, `limit`
  - supports CSV export via `format=csv`
- `POST /api/admin/tenants`
- `PATCH /api/admin/tenants/:id`
- `GET /api/admin/tenants/:id/users`
- `GET /api/admin/tenants/:id/access`
- `POST /api/admin/tenants/:id/enrollments`

### 7.4 Jobs, Links, and Reports
- `POST /api/internal/jobs/unenrollments/run`
- `POST /api/internal/jobs/unenrollments/:id/run`
- `GET /api/reports/shared/:token`
- `GET /api/reports/shared/:token/pdf`
- `PATCH /api/admin/reports/:reportId` (Save Draft)
- `POST /api/admin/reports/:reportId/send` (Publish/Email)

## 8. Canonical payload contracts

Enrollment payload (`POST /api/admin/assessments/:id/enrollments`):

```json
{
  "scope": "USER | TENANT",
  "targetId": "string",
  "includeFutureUsers": true,
  "reportMode": "AUTO | MANUAL",
  "reportDelayHours": 0
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

### 12.1 Users section (Participant Directory)
- add user: toggle between "Add to Organisation" (org + email) or "Add Solo Participant" (email only)
- solo participants can be grouped into an organisation later via Move
- delete user (non-admin, with confirmation dialog)
- move user between organisations (seat checks)
- bulk actions for selected users:
  - move selected users
  - make selected users solo
  - delete selected users
- inspect tests: slide-over panel showing sessions table, report archives
- inspect access: slide-over panel showing enrolled assessments and access status
- row-level actions (`Edit`, `Make Solo`, `View Tests`, `View Access`, `Delete Everything`) are dispatched through the shared `ActionMenu` portal component; menu-item clicks must remain portal-safe so document-level outside-click handlers do not cancel the item click before the callback fires
- enrollment/unenrollment managed from Assessment > Access tab (not on users page)
- SOLO tenants hidden from org dropdowns but users show "(Solo)" label
- advanced filters and sorting available in-table
- CSV export button available for filtered result set

### 12.2 Tenants section (Organisation Directory)
- create organisation: name + seat limit (always ORGANIZATION type, SOLO tenants hidden from UI)
- inline edit name, seat limit, archived status
- bulk actions for selected tenants:
  - archive selected
  - unarchive selected
- inspect organisation users/access via slide-over panel
- default filter shows ORGANIZATION rows; SOLO rows can be viewed by changing tenant-type filter
- seat-capacity state view (`HAS_ROOM | AT_CAPACITY | OVER_CAPACITY`) and utilization shown per row
- advanced filters and sorting available in-table
- CSV export button available for filtered result set

### 12.3 Assessments section
- create assessment: title only (no owner tenant — access managed from detail page)
- publish/unpublish
- bulk actions for selected assessments:
  - publish selected
  - unpublish selected
  - delete selected (guarded by confirmation)
- "Manage" button opens detail view for enrollment, policy, content editing
- manage explicit user/tenant enrollments from detail page Access tab (includes Report Mode toggle: AUTO/MANUAL and delay settings)
- policy tab includes question presentation mode:
  - `ALL_AT_ONCE`: current full-form rendering with all questions on one page
  - `ONE_AT_A_TIME`: guided participant flow with previous/next navigation
- question presentation mode affects only participant rendering; scoring, access, retests, and report workflows stay unchanged
- view submitted participant reports from detail page Participants tab
- clicking "View Report" opens the Google Docs-lite Report Editor (`/admin/reports/[id]`) to review/edit AI drafts or publish them.
- all actions display toast notifications instead of raw JSON output
- run unenroll wizard with scheduling and report mode controls
- advanced filters and sorting available in-table
- completion-rate range filtering available
- CSV export button available for filtered result set

### 12.4 Shared admin row-action menu behavior
- users, tenants, and assessments tables all use the same shared `ActionMenu` component
- the menu is intentionally rendered with `createPortal(...)` so dropdowns are not clipped by table containers, overflow boundaries, or stacking contexts
- outside-click dismissal must treat both the trigger wrapper and the portaled floating menu as internal click targets
- if outside-click logic only checks the non-portaled wrapper, clicks on visible menu items can be misclassified as outside clicks during `mousedown`
- failure mode: the dropdown closes immediately and the intended action callback never runs, which appears in the UI as "button does nothing"
- known affected actions before the fix included `View Tests` and `View Access` on `/admin/users`, but the same bug could suppress row actions on `/admin/tenants` and `/admin/assessments` because they share the same component
- current fix strategy in `src/components/admin/ActionMenu.tsx`:
  - maintain a ref for the trigger/container
  - maintain a second ref for the portaled menu DOM node
  - close only when the event target is outside both refs
  - keep the portal architecture rather than removing it, because the portal solves the correct layout problem and the bug was in click-boundary detection
- companion hardening in `src/app/(app)/admin/users/UsersClient.tsx`:
  - `openInspect(...)` now checks `res.ok` explicitly
  - unsuccessful responses show a toast and clear panel data instead of leaving partially loaded state

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
9. question presentation mode behavior:
  - `ALL_AT_ONCE` preserves the existing full assessment flow and submit gating
  - `ONE_AT_A_TIME` restores the first unanswered question on resume and keeps previous/next navigation stable
  - free-text answers persist when leaving a question and again during final submit
10. shared row-action menu click behavior:
  - open `Actions` on a user row and confirm `View Tests` opens the inspect panel
  - open `Actions` on a user row and confirm `View Access` opens the inspect panel
  - verify at least one row action in tenants and assessments still fires correctly after the shared menu fix
  - verify clicking outside the menu still dismisses it
  - verify Escape still dismisses it

## 14. Operational notes

- Legacy endpoints remain available for transition compatibility where still referenced.
- `Assessment.tenantId` remains for compatibility/history, but is not the canonical access gate.
- Product language is intentionally decoupled from the legacy/internal domain model:
  - UI, docs, and surfaced API messages say `Organisation`.
  - Internal storage/contracts may still say `tenant`.
  - Avoid mixing both terms in the same user-facing flow unless a technical field name is being shown verbatim.
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

## 16. Troubleshooting: GitHub Desktop line-ending warning

Warning text:
- `This diff contains a change in line endings from 'CRLF' to 'LF'.`

What it means:
- This is a normalization warning, not an application/runtime error.
- Repository policy in `.gitattributes` enforces LF for text files: `* text=auto eol=lf`.
- On Windows, files that were previously CRLF can appear as changed when normalized to LF.

Why it appears after edits:
- Editor save or tooling rewrites file content and Git re-normalizes line endings to LF.
- GitHub Desktop highlights this so reviewers know the diff includes end-of-line conversion.

Recommended workflow:
1. Keep repository policy as LF (do not switch project files back to CRLF).
2. Stage only intended files and verify content changes are real, not only EOL churn.
3. If many files are noisy due normalization, do a dedicated normalization commit separate from feature work.

Optional one-time normalization command:

```bash
git add --renormalize .
```

Then commit with a message like:
- `chore: normalize line endings to LF`

Prevention tips:
- Configure editor default EOL to LF for this repo.
- Add/keep `.gitattributes` as source of truth for line endings.
- Avoid mixing large line-ending cleanups with product/UI changes.

## 17. Troubleshooting: Admin row-action menu appears clickable but does nothing

Symptom:
- In `/admin/users`, clicking `View Tests` or `View Access` from the `Actions` dropdown appears to do nothing.
- Similar silent failures can occur for row actions in `/admin/tenants` and `/admin/assessments` because they use the same shared menu component.

Root cause:
- The shared `ActionMenu` renders the dropdown with `createPortal(...)` into `document.body`.
- The menu also registers a document-level `mousedown` listener to close on outside click.
- If the outside-click logic only checks the non-portaled wrapper ref, then a click on a portaled menu item is incorrectly treated as an outside click.
- That closes the menu during `mousedown` before the menu item's `onClick` handler executes.

Why the UI looks broken:
- The menu visibly opens.
- The item text is clickable.
- The click closes the menu, but the actual callback never runs.
- To the admin, this looks like the button is dead even though the row action is wired correctly.

Correct fix:
- Keep the portal rendering.
- Track both the trigger/container ref and the portaled menu ref.
- In the outside-click handler, bail out when the event target is inside either ref.
- Do not patch each individual action callback; this is a shared-component boundary bug, not a Users-page business-logic bug.

Companion hardening:
- For inspect actions in `/admin/users`, handle non-2xx responses explicitly and show a toast instead of assuming every response body is a successful payload.

Validation after fix:
- `npm run lint` passes with 0 errors; only pre-existing unrelated warnings remain.
- Full `npm run build` may still fail for unrelated missing TipTap packages in the report editor path; that build failure is separate from the admin action-menu issue and should not be conflated with it.

## 18. Manual PDF Workflow (CPR Exam Modules)

New assessment policy controls:
- `reportWorkflow`: `AI_STANDARD | MANUAL_PDF_UPLOAD`
- `randomizeQuestionOrder`: boolean (participant-only randomized display)
- `submissionAlertAdminIds`: admin user IDs notified on submit

New question/answer support:
- `QuestionType.FREE_TEXT`
- `Answer.textValue`

Manual workflow behavior:
1. Participant submits assessment.
2. Report remains `DRAFT`; participant sees pending-notification message.
3. Selected admins receive completion email with direct response-review link.
4. Admin reviews canonical question order and participant answers.
5. Admin uploads PDF (`/api/admin/reports/:reportId/manual-pdf`) and can notify immediately or later.
6. When published, participant can download PDF in app and via secure no-login share links.

New/updated API surface:
- `GET /api/admin/assessments/:id/participants/:userId/responses`
- `POST /api/admin/reports/:reportId/manual-pdf`
- `POST /api/admin/reports/:reportId/send` now enforces uploaded PDF for `MANUAL_PDF_UPLOAD`
- `GET /api/reports/me/:assessmentId` now returns manual pending/ready messaging metadata
- `GET /api/reports/me/:assessmentId/pdf` and `GET /api/reports/shared/:token/pdf` stream uploaded manual PDFs when applicable
