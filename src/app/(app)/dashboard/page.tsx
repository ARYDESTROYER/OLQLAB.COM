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

type QuickLink = {
  href: string;
  numeral: string;
  eyebrow: string;
  title: string;
  body: string;
};

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

  const orgName = userRecord?.tenant?.name || session.user.tenantId || "—";

  const quickLinks: QuickLink[] = [
    {
      href: "/assessment/current",
      numeral: "I",
      eyebrow: "Participant",
      title: "Assessment Center",
      body: "Start pending assessments and resume in-progress attempts.",
    },
    {
      href: "/reports/current",
      numeral: "II",
      eyebrow: "Participant",
      title: "My Reports",
      body: "Open completed reports and download PDF copies.",
    },
  ];

  if (role === "ADMIN") {
    quickLinks.push({
      href: "/admin",
      numeral: "III",
      eyebrow: "Operations",
      title: "Admin Console",
      body: "Manage organisations, users, assessments, completion tracking, and policy rules.",
    });
  }

  const metrics: Array<{ label: string; value: string | number }> = [
    { label: "Published assessments", value: publishedAssessments },
    { label: "Completed by you", value: mySubmittedCount },
    { label: "Role", value: roleLabel(role) },
    { label: "Organisation", value: orgName },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 pt-12 pb-24 md:px-10 md:pt-16 md:pb-32">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="inline-flex items-center text-[11px] font-medium uppercase tracking-[0.28em] text-[#101114]/55">
              <span className="brass-dot" aria-hidden /> OLQLAB workspace
            </p>
            <h1 className="font-display mt-8 text-balance text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.03em]">
              Welcome back, {fullName}<span className="brass-period">.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#101114]/64 md:text-base">
              {session.user.email}
            </p>
          </div>
          <span className="workspace-chip" data-tone="brass">
            {roleLabel(role)}
          </span>
        </div>
      </section>

      <section
        aria-label="Workspace metrics"
        className="mt-[var(--workspace-section-y)] grid gap-y-8 border-y border-[#101114]/15 py-[var(--workspace-metric-py)] md:grid-cols-4 md:gap-x-10"
      >
        {metrics.map((metric, idx) => (
          <div
            key={metric.label}
            className={`flex flex-col gap-3 md:gap-4 ${
              idx > 0 ? "md:border-l md:border-[#101114]/10 md:pl-10" : ""
            }`}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
              {metric.label}
            </p>
            <p className="font-display truncate text-[clamp(2.25rem,4.5vw,3.5rem)] leading-none tracking-[-0.02em] text-[#101114]">
              {metric.value}
            </p>
          </div>
        ))}
      </section>

      <section
        aria-label="Quick links"
        className="mt-[var(--workspace-section-y)] grid gap-x-10 gap-y-12 md:grid-cols-3"
      >
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group block border-t border-[#101114]/15 pt-8 transition-colors duration-200 hover:border-[#B5803C]/55"
          >
            <p className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#B5803C]">
              <span className="font-display text-base normal-case tracking-tight text-[#B5803C]">
                {link.numeral}
              </span>
              <span>{link.eyebrow}</span>
            </p>
            <h2 className="font-display mt-4 text-[clamp(1.75rem,3.5vw,2.25rem)] leading-tight tracking-tight text-[#101114]">
              {link.title}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#101114]/68">
              {link.body}
            </p>
            <span className="link-underline mt-6 inline-flex items-center gap-3 text-sm font-medium text-[#101114]">
              Open
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
