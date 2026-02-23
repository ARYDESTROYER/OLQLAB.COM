# PersonaPilot MVP

Corporate personality assessment platform (pilot v1) built with Next.js, Prisma, Vercel Postgres, Auth.js magic links, and Resend.

## Features implemented

- Multi-tenant core model with seats, users, roles (`ADMIN`, `EMPLOYEE`, `LEADER`)
- CSV import for employees (`email, first_name, last_name, manager_email`)
- Invite-only sign in (only imported seat emails can login)
- Assessment creation + publish policy controls
- Assessment session flow (start, answer autosave, submit)
- Big Five scoring + narrative report generation
- Employee report access gating based on policy
- Leader report endpoint with permission checks

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Prisma ORM
- Postgres (Vercel Postgres)
- NextAuth/Auth.js + Prisma Adapter + Email provider
- Resend for emails

## Required environment variables

Create `.env.local` (copy from `.env.example`):

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
NEXTAUTH_SECRET="replace-with-random-secret"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY="re_xxx"
EMAIL_FROM="noreply@yourdomain.com"
```

## Local run

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Open: `http://localhost:3000`

## MVP usage flow

1. Sign in as seeded admin email: `admin@democorp.com` (magic link)
2. Open `/admin`
3. Create tenant (or use seeded one)
4. Import employees via CSV text box
5. Send invites
6. Create assessment
7. Publish assessment with policy
8. Employee opens `/assessment/current`, completes quiz
9. Employee views report at `/reports/me/:assessmentId`
10. Leader/admin can query leader report endpoint/page

## API endpoints implemented

- `POST /api/admin/tenants`
- `POST /api/admin/users/import-csv`
- `POST /api/admin/invites/send`
- `POST /api/admin/assessments`
- `POST /api/admin/assessments/:id/publish`
- `POST /api/assessment/sessions/start`
- `GET /api/assessment/sessions/:id`
- `POST /api/assessment/sessions/:id/answer`
- `POST /api/assessment/sessions/:id/submit`
- `GET /api/reports/me/:assessmentId`
- `GET /api/reports/leader/:userId/:assessmentId`

## Deploy to Vercel

1. Push this repo to GitHub.
2. Create Vercel project from repo.
3. Add Vercel Postgres integration and copy `DATABASE_URL`.
4. Add env vars in Vercel project settings:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (your deployed domain)
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
5. Run Prisma migration against production DB:

```bash
npx prisma migrate deploy
```

6. Seed production (optional for demo tenant):

```bash
npm run prisma:seed
```

7. Trigger a deployment.

## Notes

- Compliance/SSO not included in this pilot scope.
- Leader dashboard UI is minimal; endpoint logic is implemented.
- Assessment authoring is basic and optimized for speed to launch.
