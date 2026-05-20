import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

function roleLabel(role: Role) {
  if (role === "ADMIN") return "Admin";
  if (role === "LEADER") return "Leader";
  return "Participant";
}

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return null;
  }

  const [mySubmittedCount, userRecord] = await Promise.all([
    db.quizSession.count({
      where: {
        userId: session.user.id,
        status: "SUBMITTED",
      },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        firstName: true,
        lastName: true,
        tenantId: true,
        createdAt: true,
        tenant: {
          select: { name: true },
        },
      },
    }),
  ]);

  let publishedAssessments = 0;

  if (userRecord) {
    try {
      publishedAssessments = (
        await db.assessment.findMany({
          where: {
            isPublished: true,
            OR: [
              {
                userEnrollments: {
                  some: {
                    userId: session.user.id,
                    active: true,
                  },
                },
              },
              {
                tenantEnrollments: {
                  some: {
                    tenantId: userRecord.tenantId,
                    active: true,
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            userEnrollments: {
              where: {
                userId: session.user.id,
                active: true,
              },
              select: {
                id: true,
              },
            },
            tenantEnrollments: {
              where: {
                tenantId: userRecord.tenantId,
                active: true,
              },
              select: {
                includeFutureUsers: true,
                createdAt: true,
              },
            },
          },
        })
      ).filter((assessment) => {
        if (assessment.userEnrollments.length > 0) return true;
        return assessment.tenantEnrollments.some(
          (enrollment) => enrollment.includeFutureUsers || userRecord.createdAt <= enrollment.createdAt,
        );
      }).length;
    } catch (error) {
      if (!isSchemaCompatibilityError(error)) throw error;

      publishedAssessments = await db.assessment.count({
        where: {
          tenantId: userRecord.tenantId,
          isPublished: true,
        },
      });
    }
  }

  const role = session.user.role as Role;
  const fullName =
    `${userRecord?.firstName || session.user.firstName || ""} ${userRecord?.lastName || session.user.lastName || ""}`.trim() ||
    session.user.email ||
    "Participant";

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8 md:px-10 md:py-12">
      <section className="section-frame glass-panel rounded-[2rem] p-8 shadow-[0_24px_64px_-34px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">OLQLAB Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Welcome back, {fullName}</h1>
            <p className="mt-2 text-sm text-slate-600">{session.user.email}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">
            {roleLabel(role)}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Published Assessments</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{publishedAssessments}</p>
          </div>
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Completed By You</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{mySubmittedCount}</p>
          </div>
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{roleLabel(role)}</p>
          </div>
          <div className="metric-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Organisation</p>
            <p className="mt-2 truncate text-sm font-semibold text-slate-900">
              {userRecord?.tenant?.name || session.user.tenantId || "-"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/assessment/current"
          className="hover-lift rounded-2xl border border-slate-200 bg-white/88 p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Participant</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Assessment Center</h2>
          <p className="mt-2 text-sm text-slate-600">Start pending assessments and resume in-progress attempts.</p>
        </Link>

        <Link
          href="/reports/current"
          className="hover-lift rounded-2xl border border-slate-200 bg-white/88 p-6 shadow-sm"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Participant</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">My Reports</h2>
          <p className="mt-2 text-sm text-slate-600">Open completed reports and download PDF copies.</p>
        </Link>

        {role === "ADMIN" && (
          <Link
            href="/admin"
            className="hover-lift rounded-2xl border border-cyan-200 bg-cyan-50/90 p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Operations</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Admin Console</h2>
            <p className="mt-2 text-sm text-slate-700">
              Manage companies, users, assessments, completion tracking, and policy rules.
            </p>
          </Link>
        )}
      </section>
    </main>
  );
}
