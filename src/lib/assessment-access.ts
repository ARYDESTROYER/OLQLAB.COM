import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

export type EnrollmentSource =
  | { scope: "USER"; enrollmentId: string }
  | {
    scope: "TENANT";
    enrollmentId: string;
    tenantId: string;
    includeFutureUsers: boolean;
    enrolledAt: Date;
  };

export type AssessmentAccessResolution = {
  assessmentId: string;
  userId: string;
  assessmentExists: boolean;
  isPublished: boolean;
  hasDirectEnrollment: boolean;
  hasTenantEnrollment: boolean;
  hasActiveEnrollment: boolean;
  overrideMode: "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE" | null;
  canStartAssessment: boolean;
  canViewAppReport: boolean;
  canViewViaLinkOnly: boolean;
  isRevoked: boolean;
  sources: EnrollmentSource[];
  enrollmentReportMode: "AUTO" | "MANUAL";
  enrollmentReportDelayHours: number;
};

export async function resolveAssessmentAccess(
  userId: string,
  assessmentId: string,
  atTime: Date = new Date(),
): Promise<AssessmentAccessResolution> {
  try {
    const [user, assessment, directEnrollment, override] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tenantId: true,
          createdAt: true,
        },
      }),
      db.assessment.findUnique({
        where: { id: assessmentId },
        select: {
          id: true,
          isPublished: true,
        },
      }),
      db.assessmentUserEnrollment.findFirst({
        where: {
          assessmentId,
          userId,
          active: true,
          createdAt: {
            lte: atTime,
          },
        },
        select: {
          id: true,
          createdAt: true,
          reportMode: true,
          reportDelayHours: true,
        },
      }),
      db.assessmentReportAccessOverride.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId,
            userId,
          },
        },
        select: {
          mode: true,
        },
      }),
    ]);

    const tenantEnrollments = user
      ? await db.assessmentTenantEnrollment.findMany({
        where: {
          assessmentId,
          active: true,
          createdAt: {
            lte: atTime,
          },
          tenantId: user.tenantId,
        },
        select: {
          id: true,
          tenantId: true,
          includeFutureUsers: true,
          createdAt: true,
          reportMode: true,
          reportDelayHours: true,
        },
      })
      : [];

    const directSources: EnrollmentSource[] =
      directEnrollment && directEnrollment.createdAt <= atTime
        ? [{ scope: "USER", enrollmentId: directEnrollment.id }]
        : [];

    const tenantSources: EnrollmentSource[] = [];
    if (user) {
      for (const enrollment of tenantEnrollments) {
        const qualifies =
          enrollment.includeFutureUsers || user.createdAt <= enrollment.createdAt;
        if (!qualifies) continue;
        tenantSources.push({
          scope: "TENANT",
          enrollmentId: enrollment.id,
          tenantId: enrollment.tenantId,
          includeFutureUsers: enrollment.includeFutureUsers,
          enrolledAt: enrollment.createdAt,
        });
      }
    }

    const hasDirectEnrollment = directSources.length > 0;
    const hasTenantEnrollment = tenantSources.length > 0;
    const hasActiveEnrollment = hasDirectEnrollment || hasTenantEnrollment;

    const overrideMode = override?.mode || null;
    const assessmentExists = Boolean(assessment);
    const isPublished = Boolean(assessment?.isPublished);
    const canStartAssessment = assessmentExists && isPublished && hasActiveEnrollment;

    // Precedence rule: active enrollment always wins over restrictive override modes.
    const canViewViaLinkOnly = !hasActiveEnrollment && overrideMode === "LINK_ONLY";
    const canViewAppReport = hasActiveEnrollment || overrideMode === "KEEP_APP_ACCESS";
    const isRevoked =
      !hasActiveEnrollment && (overrideMode === "LINK_ONLY" || overrideMode === "REVOKE");

    let enrollmentReportMode: "AUTO" | "MANUAL" = "AUTO";
    let enrollmentReportDelayHours = 0;

    if (directEnrollment && directEnrollment.createdAt <= atTime) {
      enrollmentReportMode = directEnrollment.reportMode || "AUTO";
      enrollmentReportDelayHours = directEnrollment.reportDelayHours || 0;
    } else if (tenantEnrollments.length > 0) {
      const qualifying = tenantEnrollments.find(
        (enrollment) =>
          enrollment.includeFutureUsers || (user && user.createdAt <= enrollment.createdAt),
      );
      if (qualifying) {
        enrollmentReportMode = qualifying.reportMode || "AUTO";
        enrollmentReportDelayHours = qualifying.reportDelayHours || 0;
      }
    }

    return {
      assessmentId,
      userId,
      assessmentExists,
      isPublished,
      hasDirectEnrollment,
      hasTenantEnrollment,
      hasActiveEnrollment,
      overrideMode,
      canStartAssessment,
      canViewAppReport,
      canViewViaLinkOnly,
      isRevoked,
      sources: [...directSources, ...tenantSources],
      enrollmentReportMode,
      enrollmentReportDelayHours,
    };
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const [user, assessment] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tenantId: true,
        },
      }),
      db.assessment.findUnique({
        where: { id: assessmentId },
        select: {
          id: true,
          tenantId: true,
          isPublished: true,
        },
      }),
    ]);

    const assessmentExists = Boolean(assessment);
    const isPublished = Boolean(assessment?.isPublished);
    const hasTenantEnrollment =
      Boolean(user) &&
      Boolean(assessment) &&
      assessment?.tenantId === user?.tenantId;
    const hasActiveEnrollment = hasTenantEnrollment;

    return {
      assessmentId,
      userId,
      assessmentExists,
      isPublished,
      hasDirectEnrollment: false,
      hasTenantEnrollment,
      hasActiveEnrollment,
      overrideMode: null,
      canStartAssessment: assessmentExists && isPublished && hasActiveEnrollment,
      canViewAppReport: hasActiveEnrollment,
      canViewViaLinkOnly: false,
      isRevoked: !hasActiveEnrollment,
      sources: [],
      enrollmentReportMode: "AUTO",
      enrollmentReportDelayHours: 0,
    };
  }
}

export async function listResolvedAssessmentUsers(
  assessmentId: string,
  q?: string,
) {
  let directEnrollments: Array<{
    id: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: "EMPLOYEE" | "LEADER" | "ADMIN";
      tenantId: string;
      createdAt: Date;
      manager: { email: string } | null;
    };
  }> = [];
  let tenantEnrollments: Array<{
    id: string;
    tenantId: string;
    includeFutureUsers: boolean;
    createdAt: Date;
    tenant: {
      users: Array<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: "EMPLOYEE" | "LEADER" | "ADMIN";
        tenantId: string;
        createdAt: Date;
        manager: { email: string } | null;
      }>;
    };
  }> = [];

  try {
    [directEnrollments, tenantEnrollments] = await Promise.all([
      db.assessmentUserEnrollment.findMany({
        where: {
          assessmentId,
          active: true,
          user: {
            role: { in: ["EMPLOYEE", "LEADER"] },
            ...(q
              ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              }
              : {}),
          },
        },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              tenantId: true,
              createdAt: true,
              manager: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      }),
      db.assessmentTenantEnrollment.findMany({
        where: {
          assessmentId,
          active: true,
        },
        select: {
          id: true,
          tenantId: true,
          includeFutureUsers: true,
          createdAt: true,
          tenant: {
            select: {
              users: {
                where: {
                  role: { in: ["EMPLOYEE", "LEADER"] },
                  ...(q
                    ? {
                      OR: [
                        { firstName: { contains: q, mode: "insensitive" } },
                        { lastName: { contains: q, mode: "insensitive" } },
                        { email: { contains: q, mode: "insensitive" } },
                      ],
                    }
                    : {}),
                },
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  tenantId: true,
                  createdAt: true,
                  manager: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        tenantId: true,
      },
    });
    if (!assessment?.tenantId) return [];

    const users = await db.user.findMany({
      where: {
        tenantId: assessment.tenantId,
        role: { in: ["EMPLOYEE", "LEADER"] },
        ...(q
          ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
          : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        manager: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        firstName: "asc",
      },
    });

    return users.map((user) => ({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as "EMPLOYEE" | "LEADER",
      tenantId: user.tenantId,
      managerEmail: user.manager?.email || null,
      sources: [],
    }));
  }

  const map = new Map<
    string,
    {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      role: "EMPLOYEE" | "LEADER";
      tenantId: string;
      managerEmail: string | null;
      sources: Array<{ scope: "USER" | "TENANT"; enrollmentId: string }>;
    }
  >();

  for (const enrollment of directEnrollments) {
    const user = enrollment.user;
    const existing = map.get(user.id);
    if (existing) {
      existing.sources.push({ scope: "USER", enrollmentId: enrollment.id });
      continue;
    }

    map.set(user.id, {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as "EMPLOYEE" | "LEADER",
      tenantId: user.tenantId,
      managerEmail: user.manager?.email || null,
      sources: [{ scope: "USER", enrollmentId: enrollment.id }],
    });
  }

  for (const enrollment of tenantEnrollments) {
    for (const user of enrollment.tenant.users) {
      if (!enrollment.includeFutureUsers && user.createdAt > enrollment.createdAt) {
        continue;
      }

      const existing = map.get(user.id);
      if (existing) {
        existing.sources.push({ scope: "TENANT", enrollmentId: enrollment.id });
        continue;
      }

      map.set(user.id, {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as "EMPLOYEE" | "LEADER",
        tenantId: user.tenantId,
        managerEmail: user.manager?.email || null,
        sources: [{ scope: "TENANT", enrollmentId: enrollment.id }],
      });
    }
  }

  return [...map.values()].sort((a, b) => a.firstName.localeCompare(b.firstName));
}

export async function hasAnyAssessmentParticipation(
  assessmentId: string,
  userId: string,
) {
  const [activeEnrollment, session] = await Promise.all([
    resolveAssessmentAccess(userId, assessmentId),
    db.quizSession.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId,
          userId,
        },
      },
      select: { id: true },
    }),
  ]);

  return activeEnrollment.hasActiveEnrollment || Boolean(session);
}
