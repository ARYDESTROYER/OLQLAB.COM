# AGENTS.md — Project conventions and working agreement

> **You are about to work on `olqlab-com`.** Before you touch anything, read this file end-to-end. It points to two documents (`guide.md` and `journal.md`) that together define how this codebase is built and changed. Treat them as the source of truth — they outrank assumptions you might bring from other Next.js / NextAuth / Prisma projects.

---

## 1. Project orientation in one paragraph

`olqlab-com` is the marketing site and assessment application for OLQ Lab — a leadership development practice. The stack is **Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + Prisma 6 + Postgres (Neon) + NextAuth 4 (Email/magic-link) + Resend + Vercel**. Public marketing routes live at the top of `src/app/`; the authenticated app sits under `src/app/(app)/` with its own layout; sign-in routes sit under `src/app/(auth)/`. Admin routes are nested under `src/app/(app)/admin/` and protected by an admin layout. Deployed to `www.olqlab.com` (production, from `main`) and `staging.olqlab.com` (preview, from `staging` branch).

---

## 2. The two documents that govern this repo

### `guide.md` — the architectural truth

Located at the repo root. This is **the canonical technical handover**: data model, access-control resolution, admin information architecture, API contracts, sign-in flow, validation checklist, Vercel deployment rules. Read the relevant section before any non-trivial change. If your change touches something `guide.md` describes (sign-in, enrollment, reports, admin endpoints, deployment commands), update `guide.md` in the same commit so the doc never drifts.

**High-traffic sections to know exist:**

- **§3** — Roles (`ADMIN`, `EMPLOYEE`, `LEADER`) and route-guard helpers (`requireAdmin()`, `requireSession()`).
- **§4** — Access model: `resolveAssessmentAccess(userId, assessmentId)` is the single source of truth for "can this user start this assessment / view this report". Don't reinvent access logic — call this.
- **§5** — Prisma data model. New tables and fields are tracked here.
- **§6.1** — Vercel migration rule: **never** use `db push --accept-data-loss` in the build command. Use `npx prisma migrate deploy && npm run build`. Read this before touching `prisma/schema.prisma`.
- **§13** — Validation checklist of behaviors that must keep working. Specifically:
  - **§13.18** — the two-step magic-link sign-in contract: the email must link to `/signin/confirm`, which then POSTs to `/api/auth/continue`, which 303-redirects to `/api/auth/callback/email`. Do **not** short-circuit this chain — it exists to defeat enterprise email scanners pre-fetching one-time tokens.
- **§14** — operational notes and future hardening (e.g. moving `runDueUnenrollJobs` to Vercel cron).
- **§15** — **journal policy** (see below).
- **§16** — line-ending policy (LF, enforced by `.gitattributes`). On Windows, stage carefully; don't commit pure CRLF-to-LF churn alongside feature work.

### `journal.md` — append-only engineering log

Also at the repo root. **Every meaningful change to this repo gets a journal entry in the same commit.** This is non-optional (per `guide.md` §15). The format, also per §15:

- UTC timestamp
- Local timestamp (typically IST)
- **Task** — one line, imperative
- **Why** — the problem you're solving
- **What changed** — exact files and the substantive change in each
- **How** — the technique / design choice, briefly
- **Validation/output** — what you ran (`npm run lint`, `npm run build`, manual browser test, curl) and what the result was
- **Risks/unknowns** — what could break, what you're not 100% sure of
- **Next step** — what should happen after this lands (test on staging, fold into PR, etc.)

Entry headers follow the pattern `## Entry YYYY-MM-DD-NN` where `NN` is the nth entry that calendar day. Look at the last few existing entries in `journal.md` for shape.

**Why this matters:** the journal is the only durable record of *why* a decision was made. Code shows what; commits show when; the journal shows the reasoning. Future you (or future Codex) will rely on it to avoid re-litigating settled questions.

---

## 3. Working agreement for changes

### Before you edit anything

1. **Read the user's request twice.** They often have implicit constraints ("just like the rest of the codebase", "don't change the API contract") that aren't in the literal words.
2. **Check `guide.md` for the relevant section.** If there's a contract listed there, your change must preserve it or update both the code and the guide together.
3. **Look at existing patterns.** Grep for similar features. Reuse `resolveAssessmentAccess`, `requireAdmin`, `getServerAuthSession`, the editorial design tokens (`--brass`, `--cream`, `--ink`, `font-display`), the `reveal-on-scroll` animation system. Don't introduce parallel implementations.
4. **For non-trivial changes, plan first.** Use the plan-mode workflow when the user invokes it. Write a focused implementation plan with files to change, verification steps, and rollback.

### While editing

1. **One coherent change per commit.** If you discover a tangential issue, file it for later or call it out in the response — don't fold it in unless it's truly blocking.
2. **Match existing code style.** Tailwind utility ordering, type imports, file headers. Look at neighboring files.
3. **TypeScript strict.** Use `unknown` over `any`, narrow with type guards, augment NextAuth types in `src/types/next-auth.d.ts` rather than casting at every call site.
4. **LF line endings everywhere.** `.gitattributes` enforces this; your editor should respect it. If GitHub Desktop warns about CRLF→LF on a diff, you've got a mixed file — fix it before committing.

### Validation gates before committing

1. `npm run lint` — must show **0 errors**. Pre-existing warnings (currently 3 in `ReportEditorClient.tsx` / `report-format.ts`) are fine; don't introduce new ones.
2. `npm run build` — must complete cleanly. Inspect the route manifest at the end:
   - Marketing pages (`/`, `/about`, `/framework`, `/assessments`, `/coaching`, `/blindspot`, `/contact`, `/oql`) **must** show `○` (Static) — they're CDN-cached. If your change accidentally drags one to `ƒ` (Dynamic), investigate before pushing.
   - Authenticated routes (`/dashboard`, `/admin/*`, `/reports/*`, `/assessment/*`) **must** show `ƒ` (Dynamic) — they're auth-gated.
   - `/signin` and `/signin/confirm` **must** remain `ƒ` (Dynamic) — they redirect already-signed-in users.
3. For UI changes, render a static preview when you can't run the full app locally (no `DATABASE_URL` in dev). The `tmp/` directory is untracked and meant for these.
4. For auth/session changes, trace the entire sign-in flow in your head before pushing — magic link → `/signin/confirm` → `/api/auth/continue` → `/api/auth/callback/email` → JWT cookie set → dashboard. If you can't picture all five hops working, you have more reading to do.

### Committing

1. **Stage only intended files** by name. Never `git add -A` or `git add .` — `tmp/`, `.Codex/`, and unstaged scratch work shouldn't ride along.
2. **Commit message format**: short imperative subject (under 70 chars), blank line, then a paragraph or two explaining the *why* and the *what*. End with the `Co-Authored-By: Codex...` trailer when applicable.
3. **Append to `journal.md` in the same commit.** Always. See §2 above.
4. **Push to `staging`**, not `main`, unless explicitly told otherwise. `staging.olqlab.com` is the validation gate; `main` deploys to production.

### After pushing

1. Check Vercel for the deployment via the MCP tools (`list_deployments` filtered by `since`, then `get_deployment` for the sha you pushed). Wait for `state: READY`.
2. Verify the live behavior with `curl -sI` against `staging.olqlab.com` and grep for the headers / markers your change should affect.
3. Report results back to the user with a before/after comparison if applicable. Include actual header strings, not vague claims.
4. Open or update PR #1 (the standing `staging → main` PR) only when the user signals they're ready to ship to production.

---

## 4. Domain vocabulary (don't mix up)

- **User-facing UI says "Organisation"**. Internal schema and API use **`tenant`** (TenantType, tenantId, `AssessmentTenantEnrollment`, `/admin/tenants`). This split is intentional. When editing UI text, error messages, or emails, say "Organisation". When editing API contracts or Prisma models, say "tenant".
- **Roles**: `ADMIN` (full power), `EMPLOYEE` (default participant), `LEADER` (manager-level participant, can view team reports). Magic-link sign-in only works for users with an existing `Seat` row matching their tenant — the `signIn` callback in `src/lib/auth.ts` enforces this.
- **Assessments are global** (per `guide.md` §1). Access is resolved via *enrollment records*, not by `Assessment.tenantId` (which is legacy). Always go through `resolveAssessmentAccess`.

---

## 5. Things that have bitten us before — read these

- **`NEXTAUTH_URL` per-environment**: if Preview env doesn't have its own `NEXTAUTH_URL`, magic-link emails point to whatever Production thinks the URL is. Verify in Vercel project settings whenever sign-in feels wrong on a non-prod environment.
- **`position: fixed` and CSS `transform`**: a CSS `transform` on any ancestor turns it into the containing block for fixed-positioned descendants. If you need a true viewport overlay (modal, full-page loader), portal it to `document.body` with `react-dom`'s `createPortal`. The sign-in overlay has this problem fixed; reuse the pattern.
- **`setState` inside `useEffect`**: ESLint rule `react-hooks/set-state-in-effect` will fire if you do `useEffect(() => setX(true), [])`. Put `setX` inside an async `.then()` or after `await` instead. The codebase consistently follows this pattern.
- **Marketing pages must stay static**: removing the `getServerAuthSession()` call from `PublicHeader.tsx` is what made `/`, `/about`, `/framework`, etc. CDN-cached. If you reintroduce a `cookies()`, `headers()`, or `getServerSession()` call into any component that those pages render server-side, you'll undo the optimization. The next build will show the page as `ƒ` again — check the manifest.
- **`react-hooks/exhaustive-deps` and the module-cache pattern**: `HeaderAuthSlot.tsx` uses a module-level `let cached` promise that survives across renders. Don't put this inside a component — it must be at module scope to dedupe across SPA navigations.

---

## 6. Quick reference — paths and commands

```
src/app/(app)/layout.tsx              auth gate + AppShell
src/app/(app)/dashboard/page.tsx      post-sign-in landing
src/app/(app)/admin/layout.tsx        admin-role gate
src/app/(auth)/signin/page.tsx        sign-in form
src/app/(auth)/signin/confirm/page.tsx two-step magic-link confirm
src/app/api/auth/[...nextauth]/route.ts NextAuth handler (don't customise — use callbacks in lib/auth.ts)
src/app/api/auth/continue/route.ts    magic-link continue endpoint (POST → 303)

src/components/navigation/PublicHeader.tsx  marketing header (must NOT call session)
src/components/navigation/HeaderAuthSlot.tsx client island that swaps Sign in <-> Dashboard
src/components/navigation/AppShell.tsx  authenticated nav (client)
src/components/marketing/MarketingChrome.tsx page wrapper used by /about etc.

src/lib/auth.ts                      NextAuth options + getServerAuthSession (cached)
src/lib/db.ts                        Prisma singleton
src/lib/assessment-access.ts         resolveAssessmentAccess — single source of truth
src/lib/unenroll-jobs.ts             unenroll job processor (do not invoke from request render path)
src/lib/admin-auth-settings.ts       admin-managed sign-in settings (Blob-backed)
src/lib/magic-link-continue.ts       URL validation for the two-step magic-link flow

src/types/next-auth.d.ts             Session + JWT type augmentation

prisma/schema.prisma                 data model
prisma/migrations/                   migration history (use `prisma migrate deploy` only)

guide.md                             architectural truth — keep updated
journal.md                           append-only activity log — keep updated
AGENTS.md                            this file — project conventions
```

```
npm run lint        ESLint
npm run build       Prisma generate + Next build (use to check route manifest)
npm run dev         Local dev (requires .env.local with DATABASE_URL etc.)
npm run prisma:migrate         apply migrations locally
npm run prisma:backfill:global-assessments    one-time backfill script
```

---

## 7. The shortest possible version of this file

1. Read `guide.md` for the relevant section before changing anything.
2. Append a `journal.md` entry in the same commit as every meaningful change.
3. Lint clean. Build clean. Marketing pages must stay `○ Static`.
4. Push to `staging`. Verify with curl + Vercel logs. Only then PR to `main`.
5. Re-read this file if you're surprised by something.
