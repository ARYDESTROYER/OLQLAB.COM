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
