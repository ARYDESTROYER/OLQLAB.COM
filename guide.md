# OLQLAB Guide (Deep Technical Handover)

This guide is the canonical implementation handover for the OLQLAB platform as it exists in this repository.
It is intentionally detailed so a new engineer can operate, debug, extend, and deploy the system without additional tribal context.

## 1. Product Purpose

OLQLAB is a corporate personality + workplace behavior assessment platform.

The system combines:
- trait-based personality items (`LIKERT_TRAIT`)
- scenario judgment items (`SJT_SINGLE`) with competency impacts

And provides:
- invite-only email sign-in
- role-based access (`ADMIN`, `EMPLOYEE`, `LEADER`)
- assessment assignment/completion workflow
- participant and leader report views
- multi-page PDF report export
- admin tooling for tenant/user/assessment operations
- admin-only report regeneration for submitted assessments

## 2. Role and Access Model

### 2.1 Roles

- `ADMIN`
  - Full access to `/admin`
  - Tenant management, participant import, assessment authoring, publish policy, participation tracking
  - Can regenerate reports for submitted sessions in their own tenant
- `EMPLOYEE`
  - Can complete published assessments in their tenant
  - Can view own report based on assessment policy
- `LEADER`
  - Same as employee for own data
  - Can view direct-report leader report when policy allows

### 2.2 Core Access Guards

- `requireSession()` ensures authenticated user
- `requireAdmin()` ensures `session.user.role === "ADMIN"`

Access is validated server-side in route handlers; frontend UI is not relied on as security.

## 3. Data Model (Prisma)

Primary models relevant to assessment and reporting:
- `Tenant`
- `User`
- `Seat`
- `Assessment`
- `AssessmentSection`
- `Question`
- `QuestionOption`
- `OptionImpact`
- `QuizSession`
- `Answer`
- `Score`
- `Report`

### 3.1 Runtime Entities

- `QuizSession` is unique per (`assessmentId`, `userId`)
- `QuizSession.status` transitions:
  - `IN_PROGRESS` -> `SUBMITTED`
- `Score` stores numeric outputs:
  - Big Five trait percentages
  - `competencyJson` raw competency deltas
- `Report` stores narrative JSON (`narrativeJson`) consumed by web and PDF report outputs

## 4. End-to-End Runtime Flow

### 4.1 Sign-in

1. User requests magic link at `/signin`
2. NextAuth callback validates:
   - user exists
   - seat exists in same tenant
3. seat marked `assigned=true` on successful sign-in

### 4.2 Assessment

1. User opens `/assessment/current`
2. Published assessments for user tenant are listed with status:
   - `Not Started`
   - `In Progress`
   - `Completed`
3. Start/resume creates or reuses session
4. Answers persist by question
5. Submit route computes score + narrative and stores `Score` + `Report`

### 4.3 Reporting

- `/reports/current` lists submitted assessments
- `/reports/me/[assessmentId]` renders participant report
- `/reports/leader/[userId]/[assessmentId]` renders leader view when policy allows
- `/api/reports/me/[assessmentId]/pdf` exports participant PDF

Policy gates are enforced before report access:
- `showResultsToEmployee`
- `resultReleaseDelayHours`
- `leaderCanViewFullReport` (for leader route)

## 5. Report Architecture (v2)

The report system is now a long-form narrative model designed for premium deliverables.

### 5.1 Scoring Layer (`src/lib/score.ts`)

`computeScores(questions, answers)`:
- Trait scoring:
  - Normalizes LIKERT values to 0..1, handles reverse scoring
  - Aggregates and scales to 0..100 percentages
- Competency scoring:
  - Resolves selected SJT option
  - Sums `OptionImpact.delta` per competency

Output:
- `traits`: Big Five percentages
- `competencies`: sorted competency deltas

### 5.2 Narrative Layer (`generateNarrative`)

`generateNarrative(traits, competencies)` now returns a structured `GeneratedNarrative` payload:
- `reportVersion: "v2"`
- `profileHeadline`
- `summary`
- `strengths`
- `growthAreas`
- `actions`
- `workplaceSignals`
- `reflectionPrompts`
- `managerDiscussionGuide`
- `traitNarratives` (per trait)
- `competencyThemes` (named themes, strength/focus)
- `competencyBreakdown` (stored raw, not shown as score table in participant report)

### 5.3 Trait Narrative Rules

Each trait gets:
- qualitative band (`high`, `moderate`, `emerging`)
- contextual interpretation
- leverage guidance
- development focus

This replaces the old score-only bullet style and produces actionable context per trait.

### 5.4 AI Enrichment Layer (`src/lib/ai-report.ts`)

`generateAiNarrative(...)` is optional (requires `OPENAI_API_KEY`).

Prompt constraints:
- no clinical/medical framing
- no numeric score output in narrative
- no “AI” mention in generated prose
- workplace-specific examples preferred

If model output fails JSON parse, fallback narrative is used.

### 5.5 Narrative Metadata

At submit (and admin regeneration), narrative stores:
- `assessmentTakenAt`
- `assessmentTitle`
- `participantName`
- optional `aiNarrative`

When admin regeneration is used, metadata also includes:
- `regeneratedAt`
- `regeneratedByAdminId`

## 6. PDF Architecture (3-page minimum)

PDF route:
- `GET /api/reports/me/:assessmentId/pdf`

Characteristics:
- fixed 3-page structure (cover/summary, trait context, development plan)
- explicit `Test Taken` timestamp in identity block
- richer typography and section hierarchy
- no raw competency +/- table shown to participant

Page structure:
- Page 1:
  - title and assessment identity
  - participant identity
  - test taken date/time
  - summary + strength snapshot + development snapshot
- Page 2:
  - trait context cards
  - scenario behavior themes
- Page 3:
  - action plan
  - workplace signals
  - reflection prompts
  - manager discussion guide
  - extended insight block (if present)

## 7. Admin Report Regeneration (New)

### 7.1 Purpose

Allows admins to rebuild report outputs for already submitted assessments after:
- report logic updates
- narrative style changes
- prompt improvements
- bug fixes in scoring or formatting

### 7.2 Route

- `POST /api/admin/reports/regenerate`

Request body:
```json
{
  "assessmentId": "<assessment-id>",
  "userId": "<participant-user-id>"
}
```

### 7.3 Security and Scope

Route enforces:
- authenticated admin (`requireAdmin`)
- assessment session exists for provided `assessmentId` + `userId`
- assessment tenant matches admin tenant
- session status is `SUBMITTED`

### 7.4 Regeneration Steps

1. Load submitted `QuizSession` with questions/options/impacts/answers/user
2. Recompute `traits` + `competencies` via `computeScores`
3. Rebuild base narrative via `generateNarrative`
4. Optionally generate enrichment via `generateAiNarrative`
5. Upsert `Score`
6. Upsert `Report` with fresh `narrativeJson`

### 7.5 User Impact

No migration needed.

Because participant report endpoints always load current `Report` row:
- regenerated report is immediately visible to participant and leader views
- PDF export immediately reflects new content

## 8. Admin UI Behavior

File:
- `src/app/admin/AdminClient.tsx`

Participation tracker includes:
- filter by status (`ALL`, `SUBMITTED`, `IN_PROGRESS`, `NOT_STARTED`)
- per-participant status and timestamps
- `Regenerate Report` action only for `SUBMITTED` rows

The action sends:
- `POST /api/admin/reports/regenerate`

Response is displayed in the admin panel for operator feedback.

## 9. API Catalog

### 9.1 Admin

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
- `POST /api/admin/reports/regenerate`

### 9.2 Assessment Runtime

- `POST /api/assessment/sessions/start`
- `GET /api/assessment/sessions/:id`
- `POST /api/assessment/sessions/:id/answer`
- `POST /api/assessment/sessions/:id/submit`

### 9.3 Reports

- `GET /api/reports/me/:assessmentId`
- `GET /api/reports/me/:assessmentId/pdf`
- `GET /api/reports/leader/:userId/:assessmentId`

### 9.4 Auth

- `GET/POST /api/auth/[...nextauth]`

## 10. Environment Variables

Required:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Optional:
- `OPENAI_API_KEY`
- `REPORT_LLM_MODEL` (default: `gpt-4o-mini`)

## 11. Local Setup and Quality Gates

```bash
cd "/Users/ary/Documents/New project"
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Quality checks:
```bash
npm run lint
npm run build
```

## 12. Production Deployment Runbook

1. Push repository to GitHub
2. Import in Vercel
3. Attach Neon Postgres
4. Set all required environment variables
5. Deploy
6. Run migrations:
```bash
DATABASE_URL="<PROD_DATABASE_URL_UNPOOLED>" npx prisma migrate deploy
```
7. Optional seed:
```bash
DATABASE_URL="<PROD_DATABASE_URL_UNPOOLED>" npm run prisma:seed
```

## 13. Smoke Tests (Post Deploy)

### 13.1 Core Runtime

1. Admin sign-in
2. Client select/create
3. Add participant(s)
4. Send invite
5. Publish assessment
6. Participant starts and submits assessment
7. Participant views report and downloads PDF
8. Leader views report (if policy allows)

### 13.2 Regeneration Runtime

1. Admin opens participation tracker
2. Select submitted participant
3. Trigger `Regenerate Report`
4. Confirm success payload in admin UI
5. Open participant report URL and verify refreshed narrative
6. Re-download PDF and verify refreshed content and test timestamp

## 14. Troubleshooting

### 14.1 Report missing for participant

Check:
- session exists and `status=SUBMITTED`
- assessment policy `showResultsToEmployee=true`
- release delay elapsed (`resultReleaseDelayHours`)
- `Score` and `Report` rows exist for (`assessmentId`, `userId`)

### 14.2 Regeneration fails with 400

Likely causes:
- `assessmentId` or `userId` missing in request body
- session not in `SUBMITTED` status

### 14.3 Regeneration fails with 403

Likely cause:
- admin tenant does not match assessment tenant

### 14.4 Regeneration succeeds but text feels old

Check:
- participant is opening correct assessment report
- regenerate was run for correct (`assessmentId`, `userId`)
- optional AI key/model config if expecting enriched sections

### 14.5 PDF still looks short

Ensure request is hitting updated route version and deployment is current.
Current implementation always creates 3 pages in the PDF endpoint.

## 15. Extension Notes

Recommended next extensions:
- audit log entry for regeneration events (`who`, `when`, `which report`)
- optional batch regeneration endpoint by assessment
- admin preview diff (before/after narrative)
- queue-backed regeneration for high-volume tenants
- report version pinning by assessment policy

## 16. Security and Maintenance

- Keep all secrets in environment variables only
- Rotate credentials after sharing/testing
- Do not commit `.env.local`
- Run lint/build before every deploy
- Keep Prisma + Next.js dependencies aligned with runtime Node version

## 17. File Reference Map

Primary files for report and regeneration behavior:
- `src/lib/score.ts`
- `src/lib/ai-report.ts`
- `src/app/api/assessment/sessions/[id]/submit/route.ts`
- `src/app/api/admin/reports/regenerate/route.ts`
- `src/app/api/reports/me/[assessmentId]/route.ts`
- `src/app/api/reports/leader/[userId]/[assessmentId]/route.ts`
- `src/app/api/reports/me/[assessmentId]/pdf/route.ts`
- `src/app/reports/me/[assessmentId]/page.tsx`
- `src/app/reports/leader/[userId]/[assessmentId]/page.tsx`
- `src/app/admin/AdminClient.tsx`

## 18. Journey Update (Report Visual Upgrade)

Date:
- `2026-02-24` (implementation pass)

Summary of this pass:
- Upgraded report presentation quality in both web and PDF outputs.
- Added stronger visual cues (trait signal bars/visual maps) without exposing numeric trait scores.
- Improved personalization by addressing the participant by name in report surfaces.
- Expanded PDF readability and section sizing, including a dedicated extended-insights page when data exists.
- Renamed report section title from `12-Week Action Plan` to `Action Plan`.

Technical details:
1. Narrative text update
- Removed timeboxed phrasing in generated action steps to keep the section timeless and cleaner.
- File: `src/lib/score.ts`

2. AI narrative sanitization
- Added cleanup logic to strip score-style output patterns from enrichment text if the model returns them.
- File: `src/lib/ai-report.ts`

3. Participant report UI visual refresh
- Added `Trait Signal Map` with bar-style visual indicators and band labels only.
- Removed numeric rendering from trait visuals.
- Added participant-name personalization in the report hero.
- Updated section title to `Action Plan`.
- File: `src/app/reports/me/[assessmentId]/page.tsx`

4. PDF redesign
- Rebuilt PDF composition with stronger layout hierarchy and larger readable content blocks.
- Added trait signal bars (visual only, no numeric labels).
- Improved spacing, card structure, and narrative flow across pages.
- Ensured extended insights are no longer compressed by allocating a dedicated full page when available.
- Kept minimum report size at 3 pages, with optional 4th page for extended insights.
- File: `src/app/api/reports/me/[assessmentId]/pdf/route.ts`

Validation:
- `npm run lint` passed
- `npm run build` passed

Operational note:
- Existing reports reflect this new visual style in web/PDF immediately.
- Narrative text improvements appear most fully after submit or admin regeneration.
