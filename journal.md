# Engineering Journal

This file is the append-only engineering diary for implementation work in this repository.

## Entry 2026-02-24-01
- Timestamp (UTC): 2026-02-24T16:44:30Z
- Timestamp (Local): 2026-02-24 22:14:30 IST (+0530)
- Task: Start signed-in UX + global navigation overhaul and journaling system rollout.
- Why: Root route behavior and cross-page navigation are inconsistent for signed-in users; user requested a full architecture-level UX fix and persistent engineering diary.
- What changed:
  - Created `journal.md` as the canonical append-only log.
  - Established required entry structure for all subsequent phases.
- How:
  - Audited auth redirects, route structure, and page-level navigation affordances.
  - Initialized this file with the first pre-implementation entry before code edits.
- Validation/output:
  - File created successfully.
  - Baseline audit identified root/dashboard coupling and navigation dead-ends.
- Risks/unknowns:
  - Route-group migration must preserve all current URL paths.
  - Shared app shell must avoid disrupting focused assessment session UX.
- Next step:
  - Implement route-group + dashboard separation and shared public/authenticated navigation components.

## Entry 2026-02-24-02
- Timestamp (UTC): 2026-02-24T16:50:19Z
- Timestamp (Local): 2026-02-24 22:20:19 IST (+0530)
- Task: Implement route architecture and navigation system overhaul.
- Why: `/` needed to remain a public landing while signed-in users required coherent workspace routing and consistent cross-page navigation.
- What changed:
  - Moved authenticated pages under `src/app/(app)` while preserving URLs.
  - Added dedicated `src/app/(app)/dashboard/page.tsx`.
  - Reworked root landing at `src/app/page.tsx` to be marketing-only.
  - Added `PublicHeader`, `ProfileMenu`, and `AppShell` navigation components.
  - Added authenticated layout `src/app/(app)/layout.tsx`.
  - Updated sign-in flow to callback to `/dashboard` and redirect signed-in users away from `/signin`.
  - Updated admin non-admin redirect target to `/dashboard`.
  - Added explicit return-path actions across assessment, reports, and admin pages.
- How:
  - Performed route moves and component creation.
  - Replaced duplicated header logic with shared navigation components.
  - Added focused session navigation mode in app shell for `/assessment/session/*` paths.
- Validation/output:
  - Structural changes completed without merge conflicts.
  - Pending lint/build verification after documentation updates.
- Risks/unknowns:
  - Need compile verification to catch any route-group path or typing regressions.
  - Need docs updated to match new `/dashboard` behavior.
- Next step:
  - Update `README.md` + `guide.md` with journal policy and navigation architecture changes.

## Entry 2026-02-24-03
- Timestamp (UTC): 2026-02-24T16:51:42Z
- Timestamp (Local): 2026-02-24 22:21:42 IST (+0530)
- Task: Document journal system and updated route behavior in handover docs.
- Why: User requested explicit journal usage policy and references from core documentation.
- What changed:
  - Updated `README.md` with navigation model (`/` landing, `/dashboard` workspace) and `journal.md` policy.
  - Updated `guide.md` sign-in flow to include `/dashboard` redirect and public landing behavior.
  - Added `guide.md` section `22. Engineering Journal Workflow (`journal.md`)`.
- How:
  - Inserted new sections in both docs and linked `journal.md`.
- Validation/output:
  - Documentation edits applied successfully.
  - Final compile/lint validation pending.
- Risks/unknowns:
  - Need final lint/build pass to ensure route-group and component wiring compiles cleanly.
- Next step:
  - Run lint/build and resolve any regressions.

## Entry 2026-02-24-04
- Timestamp (UTC): 2026-02-24T16:52:50Z
- Timestamp (Local): 2026-02-24 22:22:50 IST (+0530)
- Task: Execute validation gates after navigation and route architecture updates.
- Why: Required to ensure no regressions in route resolution, auth flow, and shared shell integration.
- What changed:
  - Ran lint/build against the full codebase after route-group migration and header/shell integration.
- How:
  - `npm run lint`
  - `npm run build`
- Validation/output:
  - `npm run lint` -> passed.
  - `npm run build` -> passed.
  - Build output confirms availability of `/dashboard`, `/assessment/*`, `/reports/*`, `/admin`, `/signin`, and marketing pages.
- Risks/unknowns:
  - Functional UX still requires manual browser walkthrough for interaction quality (menu/hover/mobile behavior).
- Next step:
  - Finalize implementation handoff summary and append completion journal entry.

## Entry 2026-02-24-05
- Timestamp (UTC): 2026-02-24T16:53:07Z
- Timestamp (Local): 2026-02-24 22:23:07 IST (+0530)
- Task: Final handoff completion record.
- Why: Close the implementation cycle with a clear summary of delivered scope and remaining follow-up checks.
- What changed:
  - Completed signed-in UX rerouting to `/dashboard`.
  - Completed shared public header + profile dropdown behavior.
  - Completed authenticated global app shell with focused session mode.
  - Completed route-group migration for app pages.
  - Completed journal policy documentation updates in README and guide.
- How:
  - Implemented component and route changes.
  - Ran lint/build and recorded outputs.
  - Logged each phase in append-only journal entries.
- Validation/output:
  - Lint/build green.
  - Route map confirms expected public and authenticated endpoints.
- Risks/unknowns:
  - Final visual UX quality should be confirmed in manual browser pass across desktop/mobile breakpoints.
- Next step:
  - User review and feedback pass for any visual refinements.

## Entry 2026-02-24-06
- Timestamp (UTC): 2026-02-24T16:54:13Z
- Timestamp (Local): 2026-02-24 22:24:13 IST (+0530)
- Task: Final UX polish for profile menu interaction.
- Why: Align dropdown behavior with expected hover-based discoverability while preserving click interaction.
- What changed:
  - Updated `ProfileMenu` to open on hover and close on mouse leave, while keeping click toggle support.
- How:
  - Added mouse enter/leave handlers on the profile menu wrapper.
  - Re-ran lint.
- Validation/output:
  - `npm run lint` -> passed.
- Risks/unknowns:
  - None identified for this patch-level UI change.
- Next step:
  - Deliver implementation summary and await UX review feedback.

## Entry 2026-02-24-07
- Timestamp (UTC): 2026-02-24T16:55:01Z
- Timestamp (Local): 2026-02-24 22:25:01 IST (+0530)
- Task: Re-run production build after final profile-menu interaction tweak.
- Why: Ensure the final patch remains deployment-safe.
- What changed:
  - Executed full production build on latest working tree.
- How:
  - `npm run build`
- Validation/output:
  - Build passed.
  - Route map includes `/dashboard` and all authenticated/marketing routes.
- Risks/unknowns:
  - None identified from build output.
- Next step:
  - Final implementation delivery to user.


## Entry 2026-02-24-08
- Timestamp (UTC): 2026-02-24T17:35:12Z
- Timestamp (Local): 2026-02-24 23:05:12 IST (+0530)
- Task: Implement global-assessment schema and explicit enrollment entities.
- Why: The previous tenant-coupled model (`Assessment.tenantId`) does not scale for reusable assessments and explicit access governance.
- What changed:
  - Added Prisma enums: `TenantType`, `EnrollmentScope`, `ReportAccessMode`, `UnenrollJobStatus`.
  - Added models: `AssessmentCompetency`, `AssessmentTenantEnrollment`, `AssessmentUserEnrollment`, `AssessmentUnenrollJob`, `AssessmentReportAccessOverride`, `AssessmentReportShareToken`.
  - Updated `Tenant`, `Assessment`, and `OptionImpact` for the new model.
  - Added migration `20260224100000_global_assessment_enrollments`.
- How:
  - Updated `prisma/schema.prisma` and created SQL migration with indices/FKs/enum DDL.
  - Preserved legacy compatibility fields where required.
- Validation/output:
  - `prisma generate` succeeds inside `npm run build` pipeline.
- Risks/unknowns:
  - Existing data requires backfill to activate new enrollment graph for old assessments.
- Next step:
  - Add migration backfill and rollback scripts.

## Entry 2026-02-24-09
- Timestamp (UTC): 2026-02-24T17:42:26Z
- Timestamp (Local): 2026-02-24 23:12:26 IST (+0530)
- Task: Add migration backfill and rollback tooling.
- Why: Existing assessments and impacts must be remapped to the new enrollment/competency model without data loss.
- What changed:
  - Added `prisma/scripts/backfill-global-assessment-enrollments.ts`.
  - Added `prisma/scripts/rollback-global-assessment-enrollments.ts`.
  - Added scripts in `package.json`:
    - `prisma:backfill:global-assessments`
    - `prisma:rollback:global-assessments`
- How:
  - Backfill tags records for idempotent rollback.
  - Script seeds tenant enrollments from legacy assessment linkage and remaps option impacts.
- Validation/output:
  - Build-time TypeScript compile includes updated script references with no package-script errors.
- Risks/unknowns:
  - Backfill execution should be run in controlled order in shared environments.
- Next step:
  - Switch runtime/API access checks to enrollment resolver.

## Entry 2026-02-24-10
- Timestamp (UTC): 2026-02-24T17:53:19Z
- Timestamp (Local): 2026-02-24 23:23:19 IST (+0530)
- Task: Implement access resolution and unenroll execution core services.
- Why: Access behavior must be deterministic and centralized for all participant/admin routes.
- What changed:
  - Added `src/lib/assessment-access.ts` with `resolveAssessmentAccess`, `listResolvedAssessmentUsers`, and participation helpers.
  - Added `src/lib/unenroll-jobs.ts` for due-job execution, override application, token issuance/lookup/consume, and optional email dispatch.
  - Added env support in `src/lib/env.ts` and `.env.example`:
    - `INTERNAL_JOB_SECRET`
    - `REPORT_SHARE_BASE_URL`
- How:
  - Applied union enrollment logic with override precedence.
  - Implemented lazy + forced job execution support.
- Validation/output:
  - Runtime and API modules compile through `next build` TypeScript checks.
- Risks/unknowns:
  - Production cron scheduling still depends on infrastructure-level invocation.
- Next step:
  - Rewire admin and participant endpoints to use these services.

## Entry 2026-02-24-11
- Timestamp (UTC): 2026-02-24T18:02:03Z
- Timestamp (Local): 2026-02-24 23:32:03 IST (+0530)
- Task: Deliver admin API redesign for users/tenants/assessments/jobs.
- Why: Admin console needed explicit section endpoints and canonical enrollment/unenroll contracts.
- What changed:
  - Added assessment access/enrollment/unenroll/jobs APIs.
  - Added users tests/access/enrollments APIs and user patch operations (move tenant, convert solo).
  - Added tenants access/users/enrollments/patch APIs.
  - Added internal job run endpoints and shared-link report endpoints.
  - Updated assessment create/list/detail APIs to global model and participant stats.
- How:
  - Implemented admin guards and payload validation.
  - Added immediate execution for due unenroll jobs and dry-run preview mode.
- Validation/output:
  - Route generation in build output includes all new endpoints under `/api/admin/*`, `/api/internal/*`, and `/api/reports/shared/*`.
- Risks/unknowns:
  - Legacy consumers should be migrated to canonical endpoints over time.
- Next step:
  - Complete admin UI section pages and detail workflows.

## Entry 2026-02-24-12
- Timestamp (UTC): 2026-02-24T18:08:47Z
- Timestamp (Local): 2026-02-24 23:38:47 IST (+0530)
- Task: Restructure admin UI into sectioned console and assessment detail workflows.
- Why: Monolithic admin UI did not map to operational workflows and made future scaling difficult.
- What changed:
  - Added `src/app/(app)/admin/layout.tsx` with section navigation.
  - Replaced `/admin` with overview KPIs and pending-job visibility.
  - Implemented `/admin/users`, `/admin/tenants`, `/admin/assessments` clients.
  - Implemented `/admin/assessments/[id]` detail screen with tabs and unenroll wizard.
  - Removed obsolete monolithic component `src/app/(app)/admin/AdminClient.tsx`.
- How:
  - Connected section UIs to new admin APIs.
  - Added participant actions (regenerate, retest, reset) inside assessment detail.
- Validation/output:
  - Build route manifest includes `/admin`, `/admin/users`, `/admin/tenants`, `/admin/assessments`, `/admin/assessments/[id]`.
- Risks/unknowns:
  - Further UI refinement can improve ergonomics for very large datasets.
- Next step:
  - Finish participant/report runtime alignment and run full quality gates.

## Entry 2026-02-24-13
- Timestamp (UTC): 2026-02-24T18:13:41Z
- Timestamp (Local): 2026-02-24 23:43:41 IST (+0530)
- Task: Align participant/report runtime and link-based report access logic.
- Why: Access checks had to move from tenant equality to resolver-driven behavior.
- What changed:
  - Updated `/api/assessment/sessions/start` to enforce resolver access and lazy job checks.
  - Updated `/assessment/current` and `/reports/current` pages to resolve active visibility under the new model.
  - Updated `/api/reports/me/:assessmentId` and `/pdf` for override/report-mode behavior.
  - Added link endpoints for tokenized report payload and PDF retrieval.
  - Updated score engine mapping to support `assessmentCompetency` fallback from legacy competency links.
- How:
  - Routed access-sensitive paths through `resolveAssessmentAccess` and `runDueUnenrollJobs`.
  - Maintained existing retest/reset/regeneration behavior while removing tenant-coupled assumptions.
- Validation/output:
  - TypeScript compilation in `npm run build` confirms runtime route compatibility.
- Risks/unknowns:
  - Email-delivery behavior depends on external provider configuration.
- Next step:
  - Update README/guide with final architecture and run final lint/build validation.

## Entry 2026-02-24-14
- Timestamp (UTC): 2026-02-24T18:16:23Z
- Timestamp (Local): 2026-02-24 23:46:23 IST (+0530)
- Task: Documentation cutover and final validation.
- Why: User requested explicit planning/documentation alignment with implemented architecture.
- What changed:
  - Rewrote `README.md` for global assessments + explicit enrollment model.
  - Rewrote `guide.md` to document schema, API contracts, runtime flow, unenroll jobs, and share-link security.
  - Appended this phase journal with implementation and validation outcomes.
- How:
  - Reconciled docs against current routes/services/schema.
  - Captured quality-gate output and route generation evidence.
- Validation/output:
  - `npm run lint` -> passed.
  - `npm run build` -> passed.
  - Build route output includes new admin sections and shared-link/internal-job endpoints.
- Risks/unknowns:
  - Manual end-to-end browser smoke for invite/start/submit/report and scheduled unenroll timing still recommended.
- Next step:
  - Execute scenario-based manual QA and then plan legacy endpoint deprecation timeline.

## Entry 2026-02-24-15
- Timestamp (UTC): 2026-02-24T18:50:25Z
- Timestamp (Local): 2026-02-25 00:20:25 IST (+0530)
- Task: Fix non-working admin/runtime button flows caused by schema mismatch in deployed environments.
- Why: Production logs showed `P2021`/`P2022` errors (missing new tables/columns), which broke admin and participant actions after the re-architecture deploy.
- What changed:
  - Added schema-compatibility helpers in `src/lib/prisma-errors.ts`.
  - Added compatibility fallbacks in core services (`assessment-access`, `unenroll-jobs`) so missing unenroll/enrollment tables no longer hard-crash requests.
  - Added fallback handling across admin APIs for tenants/users/assessments/access/jobs/participants to return usable responses or explicit `409` JSON migration-required messages instead of unhandled 500 HTML errors.
  - Added compatibility behavior in admin overview and related routes to continue rendering when `AssessmentUnenrollJob` is unavailable.
- How:
  - Wrapped new-schema Prisma calls in guarded `try/catch` blocks.
  - Added legacy-path query logic where feasible (tenant-coupled fallback) and no-op behavior for missing unenroll tables.
- Validation/output:
  - `npm run lint` -> passed.
  - `npm run build` -> passed.
  - Route generation remains intact for all admin/runtime endpoints.
- Risks/unknowns:
  - Full new feature set (explicit enrollments/unenroll jobs/share links) still requires DB migration to be applied for complete functionality.
- Next step:
  - Apply production DB migration (`prisma migrate deploy`) and then run full admin action smoke tests.

## Entry 2026-02-25-01
- Timestamp (UTC): 2026-02-25T05:38:44Z
- Timestamp (Local): 2026-02-25 11:08:44 IST (+0530)
- Task: Refine Assessment Enrollment UI on the Users admin dashboard.
- Why: Requiring admins to memorize or manually paste an `Assessment ID` string to enroll/unenroll users was highly impractical and error-prone.
- What changed:
  - Modified `UsersClient.tsx` to automatically fetch available assessments from `/api/admin/assessments`.
  - Replaced the free-text `Assessment ID for row actions` input with a dynamic `<select>` dropdown menu.
- How:
  - Implemented `loadAssessments` callback triggered on component mount.
  - Mapped API response to `<option>` elements displaying the assessment title (and a `(Draft)` flag for unpublished ones).
  - Updated validation in `enrollmentAction` to handle the dropdown state directly.
- Validation/output:
  - Verified logic statically; standard build validation (`npm run build`) could not be run locally due to missing Node.js path environment.
- Risks/unknowns:
  - Visual layout should be verified once deployed to ensure the dropdown aligns cleanly with neighboring inputs.
- Next step:
  - Deploy to testing environment to manually verify the dropdown populates options correctly and successfully dispatches enrollment actions.

## Entry 2026-02-26-01
- Timestamp (UTC): 2026-02-25T19:50:48Z
- Timestamp (Local): 2026-02-26 01:20:48 IST (+0530)
- Task: Admin console QoL improvement pass — toasts, confirmations, empty states, action menus, and search UX.
- Why: Raw JSON output dumping, missing delete confirmations, empty table states, cluttered row action buttons, and aggressive search debounce degraded admin usability.
- What changed:
  - Created `src/components/admin/Toast.tsx` — imperative toast notification system with auto-dismiss and variant styling.
  - Created `src/components/admin/ConfirmDialog.tsx` — native HTML `<dialog>` confirmation modal with danger/default variants.
  - Created `src/components/admin/EmptyState.tsx` — table row empty state component.
  - Created `src/components/admin/ActionMenu.tsx` — kebab dropdown for row-level actions with variant support.
  - Added `@keyframes slide-in-toast` and `@keyframes slide-in-menu` animations to `globals.css`.
  - Wired `ToastContainer` into `src/app/(app)/admin/layout.tsx`.
  - Rewrote `UsersClient.tsx`: replaced raw JSON output with toast notifications, added confirm dialog for delete, added empty state, replaced inline action buttons with `ActionMenu` dropdown, added Enter-key search trigger.
  - Rewrote `TenantsClient.tsx`: replaced raw JSON output with toast notifications, added empty state, added Enter-key search trigger.
  - Rewrote `AssessmentsClient.tsx`: replaced raw JSON output with toast notifications, added confirm dialog for delete, added empty state, added Enter-key search trigger.
- How:
  - Built four zero-dependency shared UI primitives using only React state, refs, and native HTML dialog.
  - Used global singleton pattern for toast API so any client component can call `toast()` without prop drilling.
  - Maintained all existing API contracts and data flows; only UI presentation layer changed.
- Validation/output:
  - All files verified structurally. Build validation (`npm run build`) deferred to deployment environment due to missing local Node.js.
- Risks/unknowns:
  - Visual alignment and animation behavior should be confirmed in browser after deployment.
  - `ActionMenu` z-index may need adjustment if used inside overflow-hidden containers.
- Next step:
  - Deploy and confirm toast animations, confirm dialog interactions, and action menu positioning across admin pages.

## Entry 2026-02-26-02
- Timestamp (UTC): 2026-02-25T20:33:03Z
- Timestamp (Local): 2026-02-26 02:03:03 IST (+0530)
- Task: Comprehensive admin console UX redesign addressing 6 user-reported issues.
- Why: User reported confusing Create User form (too many fields, SOLO tenants visible), inspect data dumping to console instead of UI, unnecessary assessment owner tenant, confusing tenant types, and overall low-effort UX.
- What changed:
  - Created `src/components/admin/InspectPanel.tsx` — slide-over side panel with `TestsView` and `AccessView` sub-components for structured data display.
  - Added `@keyframes slide-in-panel` animation to `globals.css`.
  - Rewrote `UsersClient.tsx`:
    - Renamed section to "Add Participant" (org + email required, optional name/manager behind toggle).
    - Role removed from form (defaults to EMPLOYEE).
    - SOLO tenants hidden from all dropdowns.
    - Tests/Access buttons now open InspectPanel with formatted tables.
    - "Convert to Solo" removed from action menu.
  - Rewrote `TenantsClient.tsx`:
    - Renamed to "Organizations" throughout.
    - SOLO tenants filtered out of table and create form.
    - Type column/dropdown removed (always ORGANIZATION).
    - Users/Access buttons now open InspectPanel.
  - Rewrote `AssessmentsClient.tsx`:
    - Owner tenant dropdown removed from create form (just title).
    - Owner column removed from table.
    - Helper text added: "Access can be managed from the assessment settings page."
  - Updated `guide.md` §2 (Admin IA) and §12 (Admin UX behavior) to reflect all changes.
- How:
  - All changes are UI-only — no schema migrations, no API contract changes.
  - InspectPanel uses native Escape key handling and body scroll lock.
  - SOLO tenant filtering done client-side via `.filter(t => t.type === "ORGANIZATION")`.
- Validation/output:
  - All files verified structurally. Build validation deferred to deployment.
- Risks/unknowns:
  - InspectPanel z-index (9991) should be verified against other overlays.
  - Tenant inspect panel for Access/Users renders raw JSON pending structured sub-views.
- Next step:
  - Deploy and verify UX improvements across all admin pages in production.
