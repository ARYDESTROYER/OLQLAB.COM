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

Session-security rules:
- JWT role and tenant claims are navigation hints, not an authorization source.
- `requireSession()`, `requireAdmin()`, `requireLeaderOrAdmin()`, and authenticated
  server layouts resolve the current user and organisation from Postgres on every
  request. Deleted users, archived organisations, and role changes therefore take
  effect without waiting for a user to sign out.
- `ADMIN` accounts are administration-only. They are rejected from participant
  enrollments and assessment sessions, and promotion to `ADMIN` removes participant
  enrollment/access state in the same transaction.
- Demoting a `LEADER` clears every participant whose `managerId` points to that
  account in the same identity-update transaction. The system does not guess a
  replacement manager; an admin must explicitly assign one later.
- Magic-link requests use a database-backed fixed-window limiter keyed by hashed
  email and client IP. Eligible and ineligible addresses receive the same outward
  verification-request response; only an eligible existing user with a matching seat
  receives a stored token and email.

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
- A due unenroll job is reflected synchronously in access decisions at
  `effectiveAt`, even if the scheduled worker has not persisted the job yet.
- Access resolution is read-only: it never runs job side effects from a page or API
  request. The scheduled/internal job route owns persistence, notifications, and
  share-link issuance.

## 5. Data Model (Prisma)

### 5.1 New enums
- `TenantType`: `ORGANIZATION | SOLO`
- `EnrollmentScope`: `USER | TENANT`
- `ReportAccessMode`: `KEEP_APP_ACCESS | LINK_ONLY | REVOKE`
- `AssessmentQuestionPresentationMode`: `ALL_AT_ONCE | ONE_AT_A_TIME`
- `UnenrollJobStatus`: `PENDING | COMPLETED | FAILED | CANCELLED`
- `InviteDeliveryState`: `IN_FLIGHT | UNKNOWN | SENT`

### 5.2 Updated existing models
- `Tenant`
  - added: `type`, `isArchived`
- `Assessment`
  - legacy `tenantId` retained but nullable
  - added: `ownerTenantId` (lineage/ownership)
  - added relations for enrollments/jobs/overrides/tokens/assessment-competencies
- `AssessmentPolicy`
  - added: `questionPresentationMode`
  - added: `introDescription`, `introBullets`
- `Question`
  - added optional media fields: `imageUrl`, `imageAlt`, `imageCaption`
- `OptionImpact`
  - added `assessmentCompetencyId`
  - legacy `competencyId` made optional
- `Report`
  - added: `status`, `availableAt`, `deliveryMethod`, `updatedAt`
  - `publicationGeneration` increments for each newly published artifact, even
    when the stable report row is reused
  - database/default and admin-regenerated reports start `DRAFT`; a report can
    become `PUBLISHED` only after a validated submitted attempt, either as the
    configured automatic submission transition or an explicit admin action
- `Invite`
  - durable delivery state, claim ID/time, attempt count, and provider delivery ID
    allow the same reservation to be retried without minting a second provider key
- enrollment records
  - added: `reportMode`, `reportDelayHours`

### 5.3 New models
- `AssessmentCompetency`
- `AssessmentTenantEnrollment`
- `AssessmentUserEnrollment`
- `AssessmentUnenrollJob`
- `AssessmentReportAccessOverride`
- `AssessmentReportShareToken`
- `AssessmentPreviewSession` (isolated, expiring admin previews)
- `AuthRateLimitBucket` (durable magic-link throttling)
- `ReportArchive` (attempt and manual-PDF history)
  - attempt archives embed a versioned copy of every answered question's full
    scalar definition, including section/order and `imageUrl` / `imageAlt` /
    `imageCaption`, so a retest never erases the evidence used by the prior attempt
- `AuditLog` (security-sensitive admin and job actions)

## 6. Migration and backfill strategy

Applied migration:
- `prisma/migrations/20260224100000_global_assessment_enrollments/migration.sql`
- `prisma/migrations/20260308120000_assessment_question_presentation_mode/migration.sql`
- `prisma/migrations/20260308153000_question_image_support/migration.sql`
- `prisma/migrations/20260729201000_reconcile_schema_and_runtime_safety/migration.sql`
- `prisma/migrations/20260730160000_bind_report_publications/migration.sql`
- `prisma/migrations/20260730170000_invite_delivery_claims/migration.sql`

The full tracked chain contains eleven migrations. The reconciliation migration adds
the report delivery/release fields missing from historical migration state, the
preview-session and persistent rate-limit tables, and current runtime indexes and
constraints. It also adds a durable, short-lived submission claim to `QuizSession`
so parallel submit requests cannot each invoke the report model. Existing reports
are preserved as `PUBLISHED` during reconciliation; new reports use the safe
`DRAFT` default. Legacy report-share tokens cannot be proven to belong to a
particular attempt, so the migration invalidates them instead of binding an old URL
to whichever report happens to be current. Required links must be reissued after
deployment.
The publication-binding migration gives existing published reports generation 1,
revokes pre-binding share links, and requires every new link to carry the exact
publication-version key it was issued against. A revoked legacy link must be
reissued; it is never rebound to replacement content.
The invite-delivery migration preserves all existing Invite rows as `SENT` and
adds a durable claim lease for new sends. Ambiguous or crashed sends can therefore
replay the same Invite ID/provider idempotency key without opening a duplicate
concurrent delivery.

CI applies the complete chain to a fresh PostgreSQL 16 database, runs the seed, and
uses `prisma migrate diff --exit-code` against `prisma/schema.prisma`. A schema change
is not deployable until that reconstruction remains clean.

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
2. For Neon, set `DIRECT_DATABASE_URL` to the non-pooler/direct connection string and keep `DATABASE_URL` as the pooled runtime URL.
3. Prisma Migrate should use the direct connection, not the `-pooler` host, because schema operations and advisory locks are more fragile through the pooler.
4. If Preview uses a separate database, you may keep `npx prisma migrate deploy && npm run build` as the build command.
5. If Preview shares the Production database, temporarily change the build command for the production rollout only, deploy once, confirm migration success in logs, then switch the build command back to `npm run build`.
6. Never use `db push --accept-data-loss` for this production migration flow.

For the latest assessment content changes, the required migrations are:
- `prisma/migrations/20260308120000_assessment_question_presentation_mode/migration.sql`
- `prisma/migrations/20260308153000_question_image_support/migration.sql`
- `prisma/migrations/20260309113000_assessment_intro_customization/migration.sql`
- `prisma/migrations/20260729201000_reconcile_schema_and_runtime_safety/migration.sql`
- `prisma/migrations/20260730160000_bind_report_publications/migration.sql`

Practical Vercel settings check:
- `Framework Preset`: `Next.js` -> correct
- `Root Directory`: `/` -> correct if the repo root is the app root
- `Install Command`: blank/default -> fine if Vercel installs from `package-lock.json`
- `Output Directory`: default -> correct
- `Build Command`: screenshot value is not correct for migration rollout and should be replaced as described above

Neon environment-variable layout:
- `DATABASE_URL`: pooled connection string used by the running app
- `DIRECT_DATABASE_URL`: direct/non-pooling connection string used by Prisma Migrate via `directUrl` in `prisma/schema.prisma`
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token used by admin question-image upload routes
- If your log shows Prisma migrate connecting to a `-pooler` host, the deployment is still misconfigured for migrations

## 7. Admin API redesign

### 7.1 Assessments
- `GET /api/admin/assessments`
  - supports advanced filters/sort query params:
    - `q`, `status`, `minCompletionRate`, `maxCompletionRate`
    - `sortBy` (`createdAt|updatedAt|title|completionRate|participants`), `sortOrder`, `limit`
  - supports CSV export via `format=csv`
  - participant totals and status buckets describe the same current resolved
    enrollment population. Attempts belonging only to unenrolled participants
    remain in history but do not inflate current completed/in-progress counts;
    completed + in progress + not started always equals total.
- `POST /api/admin/assessments/export-results`
  - exports participant attempt data as CSV for one or more selected assessments
  - requires an explicit selection of 1 to 20 assessments
  - supports layout options:
    - `WIDE`: one row per participant attempt with dynamic question columns
    - `LONG`: one row per question response
  - supports export filters:
    - `attemptStatus` (`ALL|NOT_STARTED|IN_PROGRESS|SUBMITTED`)
    - `reportStatus` (`ALL|NOT_UPLOADED_YET|UPLOADED|AWAITING_DELIVERY_TIMER|DELIVERED_TO_USER`)
  - supports include toggles for participant, attempt, report, and answer field groups
  - applies row/column/byte preflights before hydrating answer data; answer and
    question rows are not loaded when answer fields are excluded
- `POST /api/admin/assessments` (tenant not required)
  - title-only and nested JSON definitions are supported
  - nested writes, policy, enrollments, compatibility records, and audit log are
    committed atomically
  - JSON definitions are capped at 2 MiB, 1,000 questions, 200 competencies,
    100 sections, 20 options per question, and 50 impacts per option
- `GET /api/admin/assessments/:id`
- `PATCH /api/admin/assessments/:id`
- `DELETE /api/admin/assessments/:id`
- `POST /api/admin/assessments/:id/publish`
- `POST /api/admin/assessments/:id/preview-session`
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
- `POST /api/admin/users/import-csv`
  - supports bulk user import via CSV for either:
    - one selected organisation
    - per-row solo participant creation
  - supports dry-run preview via `?dryRun=1`
  - commit mode locks the selected Organisation's seat inventory and applies the
    seat limit to every new Seat, including repair of an existing User row whose
    Seat is missing
- `PATCH /api/admin/users/:id`
  - demoting a Leader atomically clears that account from all direct reports
- `DELETE /api/admin/users/:id`
- `GET /api/admin/users/:id/tests`
  - returns current attempts plus immutable `ReportArchive` history
- `GET /api/admin/users/:id/access`
- `POST /api/admin/users/:id/enrollments`
- `POST /api/admin/invites/send`
  - reserves each invite before contacting the provider and uses the invite ID as
    the provider idempotency key
  - new, ambiguous, and stale in-flight reservations are claimed under the tenant
    lock with a unique five-minute lease; the provider call runs outside the
    transaction and all final state transitions are conditional on that claim ID
  - an ambiguous transport/no-receipt failure becomes `UNKNOWN` and the next batch
    safely replays the same Invite ID/idempotency key; a definitive rejection may
    delete the reservation, while success persists `SENT` and the provider receipt

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
- `GET /api/internal/jobs/unenrollments/run` (Vercel Cron + `CRON_SECRET`)
- `POST /api/internal/jobs/unenrollments/run`
- `POST /api/internal/jobs/unenrollments/:id/run`
- `GET /api/reports/leader`
  - cursor-paginates a leader's direct-report submissions in pages of 30
- `GET /api/reports/leader/:userId/:assessmentId`
- `GET /api/reports/leader/:userId/:assessmentId/pdf`
- `GET /api/reports/shared/:token`
- `POST /api/reports/shared/:token/activate`
- `GET /api/reports/shared/:token/pdf`
- `PATCH /api/admin/reports/:reportId` (Save Draft)
- `POST /api/admin/reports/:reportId/send` (Publish/Email)
- `POST /api/admin/reports/:reportId/manual-pdf` (Upload/replace manual PDF)
- `DELETE /api/admin/reports/:reportId/manual-pdf` (Archive/remove manual PDF)

Admin users, organisations, and assessments lists default to 100 rows and may be
expanded to 500 in the UI. Their JSON responses expose `hasMore`, truncation, and
candidate-count metadata instead of silently looking complete. List CSV exports
evaluate up to 5,000 matching rows and return `413` when the file would be
incomplete or exceed 4 MiB; operators must narrow the filters rather than receive
a partial export.

### 7.5 Admin Settings
- `GET /api/admin/settings/auth-signin`
  - returns current auth sign-in settings, defaults, allowed expiry options, supported template variables, and storage writability state
- `PATCH /api/admin/settings/auth-signin`
  - validates and persists sign-in settings for:
    - magic-link expiry minutes (`2 | 5 | 10 | 20 | 30 | 60 | 360`)
    - email subject template
    - email text template
    - email HTML template
  - rejects unsupported template variables and requires `{{magicLinkUrl}}`
  - returns `503` when settings storage is read-only (missing `BLOB_READ_WRITE_TOKEN`)

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

Question content contract (used by JSON creation flows and internally by CSV import persistence):

```json
{
  "code": "Q31",
  "prompt": "A teammate misses a deadline. What do you do first?",
  "imageUrl": "/question-images/q31-missed-deadline.png",
  "imageAlt": "Illustration of a teammate missing a deadline on a project board",
  "imageCaption": "Use the situation shown in the image to guide your response.",
  "questionType": "SJT_SINGLE",
  "category": "Response Orientation",
  "trait": null,
  "reverse": false,
  "scaleMin": 1,
  "scaleMax": 1,
  "options": [
    { "code": "A", "text": "Ask for blockers" },
    { "code": "B", "text": "Escalate immediately" }
  ]
}
```

Rules for question media:
- `imageUrl` is optional and may use only a root-relative
  `/question-images/*` path or an OLQ Lab-managed Vercel Blob HTTPS URL whose
  path is also under `/question-images/*`.
- Arbitrary external URLs are rejected during JSON/CSV/manual authoring and
  suppressed when reading legacy data so an assessment cannot turn a participant's
  browser into a third-party tracking request.
- `imageAlt` and `imageCaption` are optional, but they are only meaningful when `imageUrl` exists.
- Media does not change answer semantics; answer behavior still depends only on `questionType`.
- This is intentionally additive so existing LIKERT, SJT, and FREE_TEXT questions keep working without migration-time content rewrites.
- The first participant `QuizSession` freezes the assessment question version.
  Direct creation, scored-content edits, `imageUrl` changes, CSV question imports,
  image replacement/removal, and question deletion return `409` after attempt
  history exists. Clone the assessment for a new question version. The first
  session creation and every question-evidence write share an assessment-scoped
  database lock so the freeze cannot be bypassed by concurrent requests.
- Direct question POST/PATCH and full JSON assessment authoring share the same
  bounded integer scale contract (`0..100`, maximum span `20`, max not below
  min). A partial PATCH validates the combined result while preserving the
  stored counterpart when only `scaleMin` or `scaleMax` is supplied.

## 9. Participant runtime updates

Updated runtime behavior:
- `/assessment/current` lists only published assessments with active resolved enrollment.
- `/assessment/:id` uses the assessment title plus policy-backed intro copy/checklist instead of one hardcoded generic pre-start message.
- `/api/assessment/sessions/start` gates via resolver (not tenant-id match).
- `/reports/current` lists only submitted reports with app access allowed.
- `/api/reports/me/:assessmentId` and `/pdf` enforce override/report-mode logic.
- participant session rendering supports optional question reference images below the prompt and above the answer controls without changing scoring, submit validation, or access rules.
- participant session responses never include score weights, reverse-scoring flags,
  competency impacts, or other answer-key metadata.
- answer writes validate that the question belongs to the session assessment and
  that the value matches its response type/range. Per-session database locks and an
  answer snapshot compare-and-set make concurrent answer/submit requests deterministic.
- locally edited free-text answers remain explicitly `unsaved` until their exact
  edit version is acknowledged by the answer API. Pending, dirty, or failed saves
  install unload and same-origin navigation guards; internal navigation requires
  an explicit discard confirmation, and a failed save is never labelled saved.
- AI report submission first acquires a durable five-minute lease for the exact
  answer snapshot. A second submit receives retryable `409` without invoking the
  model, answer edits are blocked while the lease is live, and failures clear only
  the claim they own.

Leader/admin visibility:
- participant self-access restrictions do not automatically remove leader/admin-level visibility gates.

Admin preview/testing:
- admins can launch a preview session for any assessment directly from the assessment detail page
- preview sessions reuse the live participant answering UI so admins can inspect real look-and-feel, question presentation mode, navigation, and image rendering
- preview launch does not require enrollment and can be used on draft assessments
- preview answers live only in `AssessmentPreviewSession`, expire automatically, and
  never create or mutate participant sessions, answers, scores, reports, retest
  eligibility, enrollment, or report access
- preview submission does not generate participant scores or reports and returns the admin to the assessment detail page
- admin workspace navigation omits participant Assessment Centre/My Reports links;
  preview mode instead provides an explicit return to assessment management

Retest/reset/regeneration:
- participant validity checks rely on enrollment/participation logic rather than
  legacy tenant coupling
- reset and regeneration serialize on the participant's session lock; regeneration
  snapshots the submitted timestamp and answers before model work, then revalidates
  both under that lock before archive/score/report writes. A reset or retest that
  wins during generation produces `409 ATTEMPT_CHANGED` and no stale report write.

## 10. Unenroll execution engine

Implementation:
- `src/lib/unenroll-jobs.ts`

Job execution flow (`runDueUnenrollJobs`):
1. claim due jobs (`PENDING` + `effectiveAt <= now`) or a forced job
2. deactivate matching enrollment records
3. compute and checkpoint the impacted-user snapshot
4. upsert `AssessmentReportAccessOverride` per recipient
5. for `LINK_ONLY`, mint an attempt-bound token only when a published report is
   currently releasable
6. optionally send email (Resend) and persist an idempotent recipient receipt
7. checkpoint between recipients and yield before the function deadline
8. mark the job `COMPLETED`, or retain retry/checkpoint state for a bounded retry

Execution modes:
- synchronous read overlay: participant/report authorization treats a due job as
  effective immediately without mutating database state
- scheduled worker: Vercel cron calls
  `GET /api/internal/jobs/unenrollments/run` every 15 minutes
- operator fallback: an authenticated admin or internal secret can run one job
  explicitly

Delivery guarantees:
- only one worker claim may own a job at a time
- recipient effects are idempotent and checkpointed, so a timeout/retry does not
  send already-recorded notifications again
- the route has a 60-second maximum duration and the worker stops accepting more
  work before that hard deadline

## 11. Share-link security model

Token table:
- hash only stored (`tokenHash`), never plaintext
- token is bound to the exact report/attempt it was issued for, not merely the
  user-assessment pair
- token also stores the exact publication-version key (report id, publication
  generation, workflow, canonical narrative, and manual-PDF content). Lookup,
  activation, HTML, reservation, and final PDF revalidation reject a key mismatch.
- expiration (`expiresAt`)
- revocation (`revokedAt`)
- download cap (`maxDownloads`, `downloadsUsed`)

Validation rules:
- invalid, expired, revoked, or exhausted tokens are denied
- token issuance, lookup, HTML display, and PDF download all re-evaluate the
  persisted report-access override and release policy
- only `LINK_ONLY` from the source job or current active enrollment may authorize a
  link; a completed `REVOKE` cannot be bypassed by an older token
- reset/retest revokes live tokens, and deleting the bound report invalidates the
  token even across issuance/reset races
- unpublish, narrative edits, PDF replace/remove, regeneration, and a new
  publication revoke prior live tokens. Reverting to old text later cannot revive
  an old URL because republishing increments `publicationGeneration`.
- `/pdf` reserves one download atomically before expensive hydration/rendering,
  releases that exact reservation if rendering fails, and revalidates the bound
  report, grant, token, release policy, and access immediately before returning
  the bytes
- email contains only a scanner-safe landing URL. The initial GET returns no report
  content; an explicit same-origin POST issues a short-lived signed, HttpOnly grant
  bound to that token. Shared HTML, JSON, and PDF routes all require the grant, and
  email never embeds a direct PDF URL.
- report-publication email retries derive one stable content-version key for both
  the share token and Resend idempotency. Definitive provider rejection revokes an
  undelivered link; an ambiguous transport failure leaves it valid because the
  provider may already have accepted the email.
- an explicit "deliver again" action supplies a stable UUID for that operator
  attempt. It derives a fresh token/provider key (and therefore a fresh download
  quota), while retrying the same ambiguous redelivery reuses the UUID, token,
  expiry, and already-consumed quota instead of silently extending access.
  Reissuing an actually expired deterministic link starts a new expiry window and
  resets its bounded quota; an active retry never does.

## 12. Admin UX behavior details

### 12.1 Users section (Participant Directory)
- add account: toggle between participant and admin creation
- add user: toggle between "Add to Organisation" (org + email) or "Add Solo Participant" (email only)
- admin creation is organisation-only; solo creation remains participant-only
- existing participant accounts can be promoted to admin from the row action menu or the inline edit form
- bulk add users: CSV-driven import supports either:
  - bulk add into one selected organisation
  - bulk create solo participants (one solo organisation per row)
  - dry-run preview with importable rows and per-row issues before commit
  - template download and CSV file load/paste workflow in the users admin page
  - missing-Seat repairs consume capacity exactly like any other new Seat and are
    skipped with `seat_limit_reached` when the Organisation is full
- demoting a Leader leaves their former direct reports unassigned; reassignment is
  always an explicit admin action
- solo participants can be grouped into an organisation later via Move
- delete user (non-admin, with confirmation dialog)
- move user between organisations (seat checks)
- bulk actions for selected users:
  - move selected users
  - make selected users solo
  - delete selected users
- inspect tests: slide-over panel showing sessions table, report archives
- inspect access: slide-over panel showing enrolled assessments and access status
- row-level actions (`Edit`, `Promote to Admin`, `Make Solo`, `View Tests`, `View Access`, `Delete Everything`) are dispatched through the shared `ActionMenu` portal component; menu-item clicks must remain portal-safe so document-level outside-click handlers do not cancel the item click before the callback fires
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
- assessments list page includes two export paths:
  - `Export CSV` for the assessment library rows themselves
  - `Export Results` for participant attempt/report/answer data
- results export modal supports:
  - an explicit selection of 1 to 20 assessments
  - layout choice (`WIDE` or `LONG`)
  - attempt-status filtering
  - report-readiness filtering
  - include toggles for participant fields, attempt timing, report metadata, and answers
- exported report readiness uses the admin-facing labels:
  - `Not uploaded yet`
  - `Uploaded`
  - `Awaiting delivery timer`
  - `Delivered to user`
- "Manage" button opens detail view for enrollment, policy, content editing
- assessment detail header includes `Test Assessment`, which launches an admin-only preview session into the real participant flow without requiring enrollment
- manage explicit user/tenant enrollments from detail page Access tab (includes Report Mode toggle: AUTO/MANUAL and delay settings)
- user enrollment target selection is search-backed so large participant directories are not limited by the default admin-list pagination window
- content tab manual question builder supports optional image metadata fields: `imageUrl`, `imageAlt`, `imageCaption`
- saved question cards expose the full stored question payload inline, including question position/code, prompt, response type, category, scale, section, image metadata, all answer options, and per-option marks / competency impacts
- saved question cards support inline editing for all stored question content fields available on this screen, including question code, prompt, type, category, scale, trait, reverse scoring, section, image metadata, SJT option rows, and per-option competency delta values
- saved question rows support direct image upload in addition to manual URL entry:
  - drag-and-drop upload
  - click-to-upload file picker
  - replace uploaded image
  - remove uploaded image
- content tab CSV import supports optional image columns:
  - `image_url`
  - `image_alt`
  - `image_caption`
- image-backed questions continue using the existing answer types (`LIKERT_TRAIT`, `SJT_SINGLE`, `FREE_TEXT`); the image is display metadata, not a separate scoring mode
- policy tab includes question presentation mode:
  - `ALL_AT_ONCE`: current full-form rendering with all questions on one page
  - `ONE_AT_A_TIME`: guided participant flow with previous/next navigation
- policy tab also controls the participant pre-start intro copy (`introDescription`) and checklist bullets (`introBullets`) shown before Begin Assessment
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

### 12.5 Admin Settings: Sign-in controls
- admin console now includes `/admin/settings` for auth sign-in controls
- configurable sign-in link expiry dropdown options:
  - `2 minutes`
  - `5 minutes`
  - `10 minutes`
  - `20 minutes`
  - `30 minutes`
  - `1 hour`
  - `6 hours`
- page explicitly shows the currently persisted expiry setting
- admin can edit sign-in email templates (subject, text, HTML)
- supported template variables:
  - `{{firstName}}`
  - `{{lastName}}`
  - `{{fullName}}`
  - `{{magicLinkUrl}}`
  - `{{expiryLabel}}`
- validation behavior:
  - unknown variables are rejected
  - templates must include `{{magicLinkUrl}}`
- storage fail-safe behavior:
  - if Blob settings storage is unavailable, system falls back to safe defaults
  - settings page remains readable and clearly reports read-only mode
  - auth sign-in and email sending continue using fallback defaults instead of failing closed
- runtime effect note:
  - expiry changes apply only to newly generated sign-in links
  - already-issued links keep their original expiry

## 13. Validation checklist

Primary quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm audit --omit=dev --audit-level=low
npm run build
```

Release infrastructure gates:
- use Node `22.x` (`.nvmrc` and `package.json#engines`)
- install exactly from the committed lockfile with `npm ci`
- run `npm run env:check` with environment-specific deployment values
- apply and seed the full migration chain on fresh PostgreSQL 16
- require zero Prisma schema drift
- smoke-test `/api/health` and `/api/health/ready`
- inspect the build manifest: marketing/legal pages remain `○` static while
  sign-in, participant, leader, admin, and API routes remain `ƒ` dynamic

Architecture scenarios to validate manually:
1. migration integrity for legacy assessments and impacts
2. access union (direct-only, tenant-only, combined)
3. no-enrollment invisibility for participants
4. `includeFutureUsers` true/false behavior for newly created users
5. unenroll mode behavior (`KEEP_APP_ACCESS`, `LINK_ONLY`, `REVOKE`)
6. scheduled job behavior before and after effective time
7. share-link security checks (invalid/expired/revoked/download-exhausted)
8. admin section routing and actions under `/admin/users`, `/admin/tenants`, `/admin/assessments`
9. admin account workflow:
  - create a new admin under an organisation from `/admin/users`
  - promote an existing participant to admin from the row action menu
  - confirm solo admin creation is blocked
10. bulk user CSV import behavior:
  - organisation mode respects seat limits and archived-organisation guards
  - an existing same-organisation user with a missing Seat cannot bypass a full
    Organisation's seat limit
  - solo mode creates one solo organisation per valid row
  - duplicate emails in the same file are skipped clearly
  - emails already attached to other organisations are skipped clearly
  - demoting a Leader clears all of their direct reports atomically
11. assessment access user search behavior:
  - searching by participant name returns matching users beyond the first 100 records
  - searching by email returns the correct participant quickly
  - selecting a search result creates the enrollment successfully
12. question presentation mode behavior:
  - `ALL_AT_ONCE` preserves the existing full assessment flow and submit gating
  - `ONE_AT_A_TIME` restores the first unanswered question on resume and keeps previous/next navigation stable
  - free-text answers persist when leaving a question and again during final submit
  - locally edited or failed free-text saves show unsaved/failed state, warn on
    reload, and require explicit confirmation before same-origin navigation can
    discard them
13. shared row-action menu click behavior:
  - open `Actions` on a user row and confirm `View Tests` opens the inspect panel
  - open `Actions` on a user row and confirm `View Access` opens the inspect panel
  - verify at least one row action in tenants and assessments still fires correctly after the shared menu fix
  - verify clicking outside the menu still dismisses it
  - verify Escape still dismisses it
14. question image behavior:
  - questions without image metadata render exactly as before
  - questions with `imageUrl` render the image in both `ALL_AT_ONCE` and `ONE_AT_A_TIME` participant flows
  - SJT image questions still require option selection before submit
  - FREE_TEXT image questions still require non-empty text before submit
  - clearing an image in admin also clears stale `imageAlt` and `imageCaption`
15. admin response-review behavior:
  - `/admin/assessments/:id/participants/:userId/responses` shows the same question image/caption metadata that the participant saw
16. assessment results export behavior:
  - `Export Results` from `/admin/assessments` includes enrolled users without a started session as `Not started`
  - `WIDE` layout places one participant-attempt per row and expands question answers into dynamic columns
  - `LONG` layout places one participant-question pair per row with explicit question metadata and answer fields
  - report status labels map correctly for manual PDF workflow, delayed auto delivery, and already delivered reports
17. admin sign-in settings behavior:
  - `/admin/settings` loads current settings and displays persisted expiry value
  - updating expiry to each allowed option affects newly generated links only
  - updated text/HTML templates render with correct placeholder substitution
  - invalid template variables are rejected with a validation error
  - missing `BLOB_READ_WRITE_TOKEN` yields read-only status in UI and `503` from PATCH while sign-in still works with fallback defaults
18. two-step magic-link sign-in behavior:
  - newly requested magic links open `/signin/confirm` first
  - `/signin/confirm` displays greeting + `Continue to Sign-in` CTA and does not auto-consume token
  - submitting continue form reaches `/api/auth/continue` and then redirects to `/api/auth/callback/email`
  - malformed `tokenUrl` values are rejected and redirected safely to `/signin?error=invalid_link`
  - unknown, unseated, archived-organisation, and throttled addresses receive the
    same outward response without a verification token or email
  - a deleted user, archived organisation, or demoted admin loses access on the
    next request despite stale JWT claims
19. report release and privacy behavior:
  - database-default, regenerated, and manual reports remain `DRAFT`; configured
    automatic reports publish only as part of a validated submission
  - publication is rejected without a submitted attempt and, for manual workflow,
    without a structurally valid uploaded PDF
  - self, leader, shared HTML, and shared PDF paths all enforce audience policy,
    availability delay, current access override, and publication state
  - reset/retest invalidates attempt-bound share links; an old URL cannot expose a
    later attempt
  - repeated/concurrent manual-PDF replacement/removal archives every displaced
    document rather than silently overwriting it
  - long paragraphs and Unicode text render across PDF pages without clipping
20. concurrency and atomicity behavior:
  - concurrent participant/admin/CSV user creation cannot oversubscribe an
    organisation seat limit
  - nested assessment creation and CSV imports are all-or-nothing
  - concurrent answer/submit requests cannot publish from a stale answer snapshot
  - parallel AI submit requests share a durable database lease, so at most one
    report-model call owns a live answer snapshot; edits receive a retryable `409`
    while the lease is live and a stale lease can be recovered
  - concurrent share downloads cannot exceed `maxDownloads`
  - first-session creation (from participant start or an admin reset) and
    question/image writes serialize on the same assessment lock; once history
    exists, direct create/edit/delete, CSV import, and dedicated image
    replace/remove paths all reject definition changes
  - an ambiguous invite-provider failure remains retryable with the same provider
    idempotency key; a live claim blocks concurrent replay, stale claims recover
    after five minutes, and an older worker cannot overwrite a newer claim
21. browser matrix:
  - public marketing, legal, sign-in, and legacy `/singin` redirect
  - admin, participant, and leader navigation/authorization
  - participant start, resume, every answer type, submit, report, and PDF
  - admin preview isolation, report editing/dirty-navigation prompt, manual report,
    enrollment, and user/organisation inspection
  - secure shared HTML/PDF link including invalid and exhausted tokens
  - repeat essential navigation at desktop and mobile viewports and inspect browser
    console errors

## 14. Operational notes

- Legacy endpoints remain available for transition compatibility where still referenced.
- `Assessment.tenantId` remains for compatibility/history, but is not the canonical access gate.
- Product language is intentionally decoupled from the legacy/internal domain model:
  - UI, docs, and surfaced API messages say `Organisation`.
  - Internal storage/contracts may still say `tenant`.
  - Avoid mixing both terms in the same user-facing flow unless a technical field name is being shown verbatim.
- Vercel cron is configured in `vercel.json` for `*/15 * * * *`. Confirm the
  deployed Vercel plan supports that schedule before release; otherwise use a
  supported cadence or external scheduler without weakening the synchronous
  effective-time authorization overlay.
- `NEXTAUTH_URL` and `REPORT_SHARE_BASE_URL` must be environment-specific HTTPS
  origins. `DATABASE_URL` is the pooled runtime URL and `DIRECT_DATABASE_URL` is the
  direct migration URL.
- `INTERNAL_JOB_SECRET` and `CRON_SECRET` are both at least 32 characters and must
  differ. Vercel Cron authenticates with `CRON_SECRET`.
- CI and Dependabot are defined under `.github/`; production dependency audit is a
  blocking CI gate.
- Remaining operational hardening is external monitoring/alerting for repeated job
  or delivery failures and final deprecation of legacy compatibility surfaces.

## 14.1 Question image asset guidance

Recommended asset strategy:
- Place product-owned static image assets under `public/question-images/*` and reference them with root-relative paths such as `/question-images/q31.png`.
- Managed uploads may use only the project's public Vercel Blob hostname and
  `/question-images/*` key space. Third-party hosts are not supported.
- Prefer compressed PNG or JPEG assets sized for assessment readability; avoid excessively large files that slow session rendering.
- For admin uploads in this repo, the preferred managed storage target is Vercel Blob rather than database bytes.

Authoring guidance:
- Keep prompt text self-contained; use the image as supporting context, not as the only place the user can learn what the question asks.
- Always provide useful `imageAlt` text for accessibility and for failure cases where the image does not load.
- Use `imageCaption` only when there is a short instruction or framing note that adds value beyond the prompt itself.
- Do not create a separate `QuestionType` just to represent visual media. Existing answer types remain the canonical behavior contract.

Admin upload guidance:
- Manual `imageUrl` entry remains supported for safe local or managed-Blob URLs and CSV-driven content.
- Saved question rows can upload images directly via drag-and-drop or file picker.
- Upload validation allows signature-matching `jpg`, `png`, and `webp` up to 4 MiB;
  the multipart envelope is capped below Vercel's 4.5 MB request limit.
- Removing an uploaded image clears `imageUrl`, `imageAlt`, and `imageCaption` together.

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
4. Admin reviews canonical question order, participant answers, and any question reference images/captions.
5. Admin uploads a structurally valid PDF of at most 4 MiB
   (`/api/admin/reports/:reportId/manual-pdf`) and can notify immediately or later.
6. When published, participant can download PDF in app and via secure no-login share links.

Release and history rules:
- report rows default to `DRAFT`
- upload with `notifyNow` cannot publish until the assessment session is submitted
- email notification failures return a failure status while preserving the already
  uploaded/published state for safe operator retry
- manual PDF replace/remove takes a database lock, re-reads current state inside the
  transaction, and archives the displaced bytes before mutation
- editor PATCH, publish/send, upload/replace, and removal use the same per-report
  transaction lock. Publication readiness, current PDF state, participant, and
  submission state are re-read after the lock; email occurs only after commit and
  revalidates publication/access before issuing a link.
- saving changed narrative content from a published report atomically revokes its
  links and returns it to `DRAFT`; edits are not audience-visible until a deliberate
  republish creates the next publication generation.
- report narrative requests and canonical JSON are capped at 256 KiB. Generated
  PDFs reject canonical input beyond 100,000 characters or 50 pages, and long-word
  wrapping is linear-time. Manual PDF uploads remain capped at 4 MiB.
- every AI-report publish transition runs the same canonical PDF renderer as a
  preflight before opening the mutation transaction. Character/page-limit failures
  return `413 PDF_RENDER_LIMIT` with an instruction to shorten the report; a
  concurrent narrative/title/participant/workflow change returns retryable
  `409 REPORT_CHANGED`. Manual workflow publication skips this generated-PDF
  preflight and continues to rely on the structurally validated uploaded PDF.
- the admin `View Tests` panel exposes current attempt state and report archives

New/updated API surface:
- `GET /api/admin/assessments/:id/participants/:userId/responses`
- `POST /api/admin/reports/:reportId/manual-pdf`
- `POST /api/admin/reports/:reportId/send` now enforces uploaded PDF for `MANUAL_PDF_UPLOAD`
- `GET /api/reports/me/:assessmentId` now returns manual pending/ready messaging metadata
- `GET /api/reports/me/:assessmentId/pdf` and `GET /api/reports/shared/:token/pdf` stream uploaded manual PDFs when applicable

## 19. Image-Backed Questions

Feature intent:
- Support OLQ-style questions where a prompt can be followed by an image and then the normal answer control.
- Keep the answer model stable so no existing scoring/report/access logic needs to be rewritten.

Implementation strategy:
- store media as nullable fields on `Question`
- keep `QuestionType` unchanged (`LIKERT_TRAIT`, `SJT_SINGLE`, `FREE_TEXT`)
- render media as presentation-only context in participant and admin-review UIs
- allow media authoring through both direct URL entry and managed Blob upload from the admin content UI

Why this architecture is used:
- scoring logic already branches by answer mode, not by presentation style
- submit validation already branches by answer mode, not by presentation style
- using media metadata avoids introducing a fourth answer contract that would have to be threaded through participant UI, submit validation, scoring, CSV parsing, and response review

CSV authoring examples:
- SJT with image:
  - `question_type=SJT_SINGLE`
  - `image_url=/question-images/q31-missed-deadline.png`
  - `image_alt=Illustration of a teammate missing a deadline on a project board`
  - `image_caption=Use the situation shown in the image to guide your response.`
- FREE_TEXT with image:
  - `question_type=FREE_TEXT`
  - `image_url=/question-images/q56-leadership-cue.png`
  - options must remain blank because FREE_TEXT answer semantics do not change

Compatibility notes:
- Existing questions remain valid because the media fields are nullable.
- Existing CSV files remain valid because the new image columns are optional.
- Existing reports and score generation continue to work because question images do not affect score calculation.
- Latest deployment requires the question-image migration before any runtime path selects the new columns.

Managed upload flow:
1. Admin creates or opens an existing saved question row in Assessment Content.
2. Admin either pastes a URL manually or drops/selects an image file.
3. Upload route stores the image in Vercel Blob under a question-scoped path.
4. A per-question database lock re-reads the current asset before replacement or
   removal, so concurrent admins cannot delete the winning upload.
5. Blob public URL is written back to `Question.imageUrl`; only the exact displaced
   managed object is removed, and a failed database write cleans up its orphan.
6. Participant and admin-review UIs consume the same `imageUrl` field as before.

API surface for managed uploads:
- `POST /api/admin/assessments/:id/questions/:questionId/image`
- `DELETE /api/admin/assessments/:id/questions/:questionId/image`

## 20. Troubleshooting: Vercel deploy fails with Prisma `P3009` on Neon

Symptom:
- Vercel build runs `npx prisma migrate deploy && npm run build`.
- Prisma stops with `Error: P3009`.
- Error text says a previous migration failed and new migrations will not be applied.
- In the observed production incident, the blocked migration was `20260306001000_manual_pdf_report_workflow` and the database error inside `_prisma_migrations.logs` was `ERROR: type "ReportWorkflow" already exists`.

What this means:
- Prisma checks migration history before applying new migrations.
- If any earlier migration is marked failed in `_prisma_migrations`, Prisma blocks the chain.
- In this incident, the database already contained the schema objects from the manual-PDF migration, but Prisma still considered that migration unresolved.
- Because of that block, the later migration `20260308120000_assessment_question_presentation_mode` could not run, leaving production code ahead of the database schema.

How to diagnose safely in Neon:
1. Open the production Neon SQL editor.
2. Inspect `_prisma_migrations`:

```sql
SELECT
  migration_name,
  started_at,
  finished_at,
  rolled_back_at,
  logs
FROM "_prisma_migrations"
ORDER BY started_at DESC;
```

3. Check whether the supposedly failed migration's schema objects already exist. For the manual-PDF migration, verify:
   - `AssessmentPolicy.reportWorkflow`
   - `AssessmentPolicy.randomizeQuestionOrder`
   - `AssessmentPolicy.submissionAlertAdminIds`
   - `Answer.textValue`
   - table `ReportPdfAsset`
   - enum `ReportWorkflow`
   - enum value `FREE_TEXT` on `QuestionType`

Example verification queries:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'AssessmentPolicy' AND column_name IN ('reportWorkflow', 'randomizeQuestionOrder', 'submissionAlertAdminIds', 'questionPresentationMode'))
    OR
    (table_name = 'Answer' AND column_name IN ('textValue'))
    OR
    (table_name = 'Question' AND column_name IN ('imageUrl', 'imageAlt', 'imageCaption'))
  )
ORDER BY table_name, column_name;
```

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'ReportPdfAsset';
```

```sql
SELECT
  t.typname AS enum_name,
  e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('QuestionType', 'ReportWorkflow')
ORDER BY t.typname, e.enumsortorder;
```

Safe recovery rule:
- If the schema objects from the failed migration already exist, do not try to recreate or manually delete them.
- Instead, mark that migration as applied in Prisma history, then rerun `migrate deploy`.

Recovery steps used for this repo:
1. Point `DATABASE_URL` at the production Neon database.
2. Mark the stuck migration as applied:

```bash
npx prisma migrate resolve --applied 20260306001000_manual_pdf_report_workflow
```

3. Confirm status:

```bash
npx prisma migrate status
```

4. Apply remaining migrations:

```bash
npx prisma migrate deploy
```

5. Recheck that `AssessmentPolicy.questionPresentationMode` and `Question.imageUrl` now exist.
6. Redeploy Vercel and retest `/api/admin/assessments` plus CSV import.

Important guardrails:
- Do not use `prisma db push` to bypass this state.
- Do not hand-edit `_prisma_migrations` rows in SQL.
- Do not delete enums/tables/columns manually if they already exist from the failed migration.
- Use `migrate resolve` only after verifying whether the schema changes from the failed migration are already present.

## 21. Troubleshooting: Vercel deploy fails with Prisma `P1002` advisory-lock timeout on Neon

Symptom:
- Vercel build runs `npx prisma migrate deploy && npm run build`.
- Prisma reaches the database, but fails with `P1002` while trying to acquire the advisory lock.
- Error text includes:
  - `Timed out trying to acquire a postgres advisory lock`
  - `SELECT pg_advisory_lock(72707369)`
  - timeout around `10000ms`
- In the reported case, the datasource log showed Prisma connecting to a Neon `-pooler` host during migrate.

What this usually means:
- another migration process is already running against the same database, or
- Prisma Migrate is being run through the Neon pooler instead of a direct connection, or
- both of the above are happening because multiple Vercel deployments are trying to migrate the same Neon database at once

Highest-probability fix for this stack:
1. In `prisma/schema.prisma`, configure Prisma datasource `directUrl = env("DIRECT_DATABASE_URL")`.
2. In Vercel, keep `DATABASE_URL` on the pooled Neon connection string.
3. In Vercel, add `DIRECT_DATABASE_URL` using Neon's direct/non-pooler connection string.
4. Redeploy.

How to recognize the wrong Neon URL:
- pooled host example: contains `-pooler.`
- direct host example: the standard Neon endpoint without `-pooler`

Operational recovery steps:
1. Cancel any in-progress or duplicate Vercel deployments that might also be trying to run `migrate deploy`.
2. Confirm Preview and Production are not both running migrations against the same Neon database at the same time.
3. Set `DIRECT_DATABASE_URL` in Vercel Production.
4. Retry the deployment.

If the timeout persists after moving Prisma Migrate to `DIRECT_DATABASE_URL`:
1. Check Neon connection/activity dashboards for another session holding the migration lock.
2. Wait for the other migration to finish or stop the competing deployment.
3. Retry `migrate deploy` once only one migrator is active.

Practical recommendation for this repo:
- Keep `migrate deploy` only on controlled production rollouts unless Preview has its own database.
- If Preview and Production share one Neon database, use `npm run build` for normal Preview deploys and run migrations only in the environment you explicitly intend to promote.

## 22. Admin-managed sign-in settings (no migration path)

Goal:
- allow admins to control magic-link expiry and sign-in email copy without database schema changes

Storage model:
- settings are persisted to Vercel Blob as JSON at `admin-settings/auth-signin.json`
- no Prisma models, no schema fields, and no migrations are required for this feature

Fail-safe behavior:
- auth token creation attempts to read settings; if storage read fails, it falls back to safe defaults
- email template rendering attempts to read settings; if storage read fails, it falls back to safe defaults
- settings writes require `BLOB_READ_WRITE_TOKEN`; if missing, admin page is read-only and API returns a clear `503`
- in-memory cache (short TTL) reduces storage round-trips while keeping updates reasonably fresh

Default sign-in settings:
- expiry: `30 minutes`
- subject: `Your OLQLab sign-in link`
- default text and HTML templates include `{{magicLinkUrl}}` and `{{expiryLabel}}`

Auth integration details:
- NextAuth verification-token expiry is overridden at adapter token-creation time
- sign-in email subject/text/HTML are rendered from templates using supported variables
- template rendering supports optional whitespace inside `{{ ... }}` markers
- admin invitations are issued only to eligible, seated users in the selected
  active Organisation; orphaned, cross-Organisation, and admin-only rows are
  skipped explicitly. Invite email links prefill `/signin?email=...` without
  changing the generic outward magic-link response.
- delivery uses a durable Invite claim rather than holding a database transaction
  across the provider call. `UNKNOWN` and stale `IN_FLIGHT` rows are reported as
  remaining work and retried with `invite:<Invite.id>`; `SENT` rows are never
  selected again.

Operational notes:
- this feature can be rolled out with a normal push and deploy; there is no migration gate
- for writable admin settings in deployed environments, ensure `BLOB_READ_WRITE_TOKEN` is set

## 23. Two-step magic-link confirmation flow

Goal:
- reduce enterprise email-security prefetch/scanner consumption of one-time sign-in links

Flow summary:
1. user requests a magic link from `/signin`
2. email link opens `/signin/confirm` instead of directly opening `/api/auth/callback/email`
3. `/signin/confirm` renders a greeting and an explicit `Continue to Sign-in` button
4. only the explicit user submit triggers `/api/auth/continue` (POST)
5. `/api/auth/continue` validates the embedded callback URL and then issues a `303` redirect to `/api/auth/callback/email?...`
6. NextAuth consumes the verification token at the callback stage as before

Implementation details:
- helper library: `src/lib/magic-link-continue.ts`
  - builds confirm URL for email templates
  - validates callback URLs before rendering/continuing
- confirm page: `src/app/(auth)/signin/confirm/page.tsx`
  - performs defensive token-url validation before rendering
  - renders a generic greeting without an account lookup or enumeration side channel
  - never auto-redirects to the callback URL
- continue route: `src/app/api/auth/continue/route.ts`
  - accepts `POST` only for token consumption flow
  - rejects malformed/unsafe callback URLs and returns user to safe sign-in error
- email generation integration: `src/lib/auth.ts`
  - sign-in email now injects confirm-page URL as `{{magicLinkUrl}}`
  - token issuance and expiry remain unchanged

Security/robustness notes:
- callback URL allowlist validation enforces expected path: `/api/auth/callback/email`
- callback URL origin must match configured public auth origin
- invalid token-url input is handled safely and does not become an open redirect
- the explicit Continue action verifies that NextAuth created a live session before
  routing to the dashboard
- the confirm page issues a short-lived same-site nonce bound to the token URL;
  `/api/auth/continue` requires and consumes it and rejects cross-site form posts,
  preventing login-CSRF/session-swap attacks
- verification requests are persistently rate-limited by hashed email and IP and
  fail closed if the limiter datastore is unavailable
- this is intentionally scanner-resistance hardening, not a complete anti-automation system
- CSRF/dwell-time/OTP fallback can be layered later if needed

Known behavior:
- already-issued links from before this rollout still follow old behavior
- newly issued links follow the two-step confirm flow
- if enterprise scanners can execute full browser flows including form submit, failures can still occur (less common)
