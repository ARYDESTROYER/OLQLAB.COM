import { Prisma } from "@prisma/client";
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

export type DueUnenrollJob = {
  id: string;
  targetScope: "USER" | "TENANT";
  targetId: string;
  reportMode: "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE";
  effectiveAt: Date;
  createdAt: Date;
};

export function isAssessmentParticipantRole(role: "ADMIN" | "EMPLOYEE" | "LEADER") {
  return role === "EMPLOYEE" || role === "LEADER";
}

export function resolveDueUnenrollOverlay(input: {
  userId: string;
  tenantId: string;
  userCreatedAt: Date;
  tenantEnrollments: Array<{
    id: string;
    tenantId: string;
    includeFutureUsers: boolean;
    createdAt: Date;
  }>;
  dueJobs: DueUnenrollJob[];
}) {
  const applicableJobs = input.dueJobs.filter((job) => {
    if (job.targetScope === "USER") return job.targetId === input.userId;
    if (job.targetId !== input.tenantId) return false;
    return input.tenantEnrollments.some(
      (enrollment) =>
        enrollment.tenantId === job.targetId &&
        (enrollment.includeFutureUsers || input.userCreatedAt <= enrollment.createdAt),
    );
  });
  applicableJobs.sort(
    (a, b) =>
      b.effectiveAt.getTime() - a.effectiveAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      b.id.localeCompare(a.id),
  );

  return {
    directEnrollmentRevoked: applicableJobs.some(
      (job) => job.targetScope === "USER",
    ),
    revokedTenantIds: new Set(
      applicableJobs
        .filter((job) => job.targetScope === "TENANT")
        .map((job) => job.targetId),
    ),
    overrideMode: applicableJobs[0]?.reportMode || null,
    sourceJobId: applicableJobs[0]?.id || null,
  };
}

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
          role: true,
        },
      }),
      db.assessment.findUnique({
        where: { id: assessmentId },
        select: {
          id: true,
          isPublished: true,
        },
      }),
      db.assessmentUserEnrollment.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId,
            userId,
          },
        },
        select: {
          id: true,
          active: true,
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

    const [tenantEnrollments, dueJobs] = user
      ? await Promise.all([
          db.assessmentTenantEnrollment.findMany({
            where: {
              assessmentId,
              createdAt: {
                lte: atTime,
              },
              tenantId: user.tenantId,
            },
            select: {
              id: true,
              active: true,
              tenantId: true,
              includeFutureUsers: true,
              createdAt: true,
              reportMode: true,
              reportDelayHours: true,
            },
          }),
          db.assessmentUnenrollJob.findMany({
            where: {
              assessmentId,
              effectiveAt: { lte: atTime },
              status: { in: ["PENDING", "FAILED"] },
              OR: [
                { targetScope: "USER", targetId: userId },
                { targetScope: "TENANT", targetId: user.tenantId },
              ],
            },
            select: {
              targetScope: true,
              id: true,
              targetId: true,
              reportMode: true,
              effectiveAt: true,
              createdAt: true,
            },
          }),
        ])
      : [[], []];

    const participantEligible = Boolean(user && isAssessmentParticipantRole(user.role));
    const dueOverlay = user
      ? resolveDueUnenrollOverlay({
          userId,
          tenantId: user.tenantId,
          userCreatedAt: user.createdAt,
          tenantEnrollments,
          dueJobs,
        })
      : {
          directEnrollmentRevoked: false,
          revokedTenantIds: new Set<string>(),
          overrideMode: null,
          sourceJobId: null,
        };

    const directSources: EnrollmentSource[] =
      participantEligible &&
      directEnrollment?.active &&
      directEnrollment.createdAt <= atTime &&
      !dueOverlay.directEnrollmentRevoked
        ? [{ scope: "USER", enrollmentId: directEnrollment.id }]
        : [];

    const tenantSources: EnrollmentSource[] = [];
    if (user && participantEligible) {
      for (const enrollment of tenantEnrollments) {
        if (!enrollment.active || dueOverlay.revokedTenantIds.has(enrollment.tenantId)) {
          continue;
        }
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

    const overrideMode = dueOverlay.overrideMode || override?.mode || null;
    const assessmentExists = Boolean(assessment);
    const isPublished = Boolean(assessment?.isPublished);
    const canStartAssessment = assessmentExists && isPublished && hasActiveEnrollment;

    // Precedence rule: active enrollment always wins over restrictive override modes.
    const canViewViaLinkOnly =
      participantEligible && !hasActiveEnrollment && overrideMode === "LINK_ONLY";
    const canViewAppReport =
      participantEligible && (hasActiveEnrollment || overrideMode === "KEEP_APP_ACCESS");
    const isRevoked =
      !participantEligible ||
      (!hasActiveEnrollment && (overrideMode === "LINK_ONLY" || overrideMode === "REVOKE"));

    let enrollmentReportMode: "AUTO" | "MANUAL" = "AUTO";
    let enrollmentReportDelayHours = 0;

    if (directSources.length > 0 && directEnrollment) {
      enrollmentReportMode = directEnrollment.reportMode || "AUTO";
      enrollmentReportDelayHours = directEnrollment.reportDelayHours || 0;
    } else if (tenantSources.length > 0) {
      const qualifying = tenantEnrollments.find(
        (enrollment) =>
          enrollment.active &&
          !dueOverlay.revokedTenantIds.has(enrollment.tenantId) &&
          (enrollment.includeFutureUsers ||
            (user && user.createdAt <= enrollment.createdAt)),
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
          role: true,
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
      Boolean(user && isAssessmentParticipantRole(user.role)) &&
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
  options?: { hardLimit?: number },
) {
  const hardLimit =
    typeof options?.hardLimit === "number" && options.hardLimit >= 0
      ? Math.floor(options.hardLimit)
      : null;
  let boundedUserIds: string[] | null = null;

  if (hardLimit !== null) {
    try {
      const [direct, tenantEnrollments] = await Promise.all([
        db.assessmentUserEnrollment.findMany({
          where: { assessmentId, active: true },
          select: { userId: true },
          take: hardLimit + 1,
        }),
        db.assessmentTenantEnrollment.findMany({
          where: { assessmentId, active: true },
          select: { tenantId: true, includeFutureUsers: true, createdAt: true },
          take: hardLimit + 1,
        }),
      ]);
      if (direct.length > hardLimit || tenantEnrollments.length > hardLimit) {
        throw new ResolvedAssessmentUsersLimitError(hardLimit);
      }

      const candidates = await db.user.findMany({
        where: {
          role: { in: ["EMPLOYEE", "LEADER"] },
          ...(q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" as const } },
                  { lastName: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
          AND: {
            OR: [
              ...(direct.length
                ? [{ id: { in: direct.map((item) => item.userId) } }]
                : []),
              ...tenantEnrollments.map((enrollment) => ({
                tenantId: enrollment.tenantId,
                ...(enrollment.includeFutureUsers
                  ? {}
                  : { createdAt: { lte: enrollment.createdAt } }),
              })),
            ],
          },
        },
        select: { id: true },
        take: hardLimit + 1,
      });
      if (candidates.length > hardLimit) {
        throw new ResolvedAssessmentUsersLimitError(hardLimit);
      }
      boundedUserIds = candidates.map((candidate) => candidate.id);
    } catch (error) {
      if (error instanceof ResolvedAssessmentUsersLimitError) throw error;
      if (!isSchemaCompatibilityError(error)) throw error;
      boundedUserIds = null;
    }
  }

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
            ...(boundedUserIds ? { id: { in: boundedUserIds } } : {}),
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
                  ...(boundedUserIds ? { id: { in: boundedUserIds } } : {}),
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
      ...(hardLimit !== null ? { take: hardLimit + 1 } : {}),
    });

    if (hardLimit !== null && users.length > hardLimit) {
      throw new ResolvedAssessmentUsersLimitError(hardLimit);
    }

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

export class ResolvedAssessmentUsersLimitError extends Error {
  constructor(readonly limit: number) {
    super(`Resolved assessment participants exceed the hard limit of ${limit}.`);
    this.name = "ResolvedAssessmentUsersLimitError";
  }
}

export class AssessmentCountSchemaCompatibilityError extends Error {
  constructor(options?: ErrorOptions) {
    super("Assessment enrollment tables are not available yet.", options);
    this.name = "AssessmentCountSchemaCompatibilityError";
  }
}

function normalizedAssessmentCountIds(assessmentIds: string[]) {
  const uniqueIds = Array.from(new Set(assessmentIds.filter(Boolean)));
  if (uniqueIds.length > 5_000) {
    throw new Error("Assessment participant counts are limited to 5,000 assessments per request.");
  }
  return uniqueIds;
}

function resolvedAssessmentParticipantsSql(assessmentIds: string[]) {
  return Prisma.sql`
    SELECT enrollment."assessmentId", enrollment."userId"
    FROM "AssessmentUserEnrollment" AS enrollment
    INNER JOIN "User" AS participant ON participant."id" = enrollment."userId"
    WHERE enrollment."active" = TRUE
      AND enrollment."createdAt" <= NOW()
      AND participant."role"::text IN ('EMPLOYEE', 'LEADER')
      AND enrollment."assessmentId" IN (${Prisma.join(assessmentIds)})
      AND NOT EXISTS (
        SELECT 1
        FROM "AssessmentUnenrollJob" AS job
        WHERE job."assessmentId" = enrollment."assessmentId"
          AND job."targetScope"::text = 'USER'
          AND job."targetId" = enrollment."userId"
          AND job."effectiveAt" <= NOW()
          AND job."status"::text IN ('PENDING', 'FAILED')
      )

    UNION

    SELECT enrollment."assessmentId", participant."id" AS "userId"
    FROM "AssessmentTenantEnrollment" AS enrollment
    INNER JOIN "User" AS participant ON participant."tenantId" = enrollment."tenantId"
    WHERE enrollment."active" = TRUE
      AND enrollment."createdAt" <= NOW()
      AND participant."role"::text IN ('EMPLOYEE', 'LEADER')
      AND (
        enrollment."includeFutureUsers" = TRUE
        OR participant."createdAt" <= enrollment."createdAt"
      )
      AND enrollment."assessmentId" IN (${Prisma.join(assessmentIds)})
      AND NOT EXISTS (
        SELECT 1
        FROM "AssessmentUnenrollJob" AS job
        WHERE job."assessmentId" = enrollment."assessmentId"
          AND job."targetScope"::text = 'TENANT'
          AND job."targetId" = enrollment."tenantId"
          AND job."effectiveAt" <= NOW()
          AND job."status"::text IN ('PENDING', 'FAILED')
      )
  `;
}

function rethrowAssessmentCountCompatibilityError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    ["42P01", "42703"].includes(String(error.meta?.code || ""))
  ) {
    throw new AssessmentCountSchemaCompatibilityError({ cause: error });
  }
  throw error;
}

/**
 * Resolve current participant and attempt-status counts in one statement. The
 * UNION removes duplicate direct/Organisation eligibility, while the single SQL
 * snapshot keeps totals and buckets coherent during concurrent unenrollment.
 */
export async function countResolvedAssessmentListStats(
  assessmentIds: string[],
) {
  const uniqueIds = normalizedAssessmentCountIds(assessmentIds);
  if (uniqueIds.length === 0) {
    return {
      eligibleByAssessmentId: new Map<string, number>(),
      sessionCounts: [] as Array<{
        assessmentId: string;
        status: "IN_PROGRESS" | "SUBMITTED";
        _count: { _all: number };
      }>,
    };
  }

  try {
    const eligibleParticipants = resolvedAssessmentParticipantsSql(uniqueIds);
    const rows = await db.$queryRaw<
      Array<{
        assessmentId: string;
        participantCount: number;
        completedCount: number;
        inProgressCount: number;
      }>
    >(Prisma.sql`
      WITH eligible AS (
        ${eligibleParticipants}
      )
      SELECT
        eligible."assessmentId",
        COUNT(*)::int AS "participantCount",
        COUNT(*) FILTER (WHERE session."status"::text = 'SUBMITTED')::int
          AS "completedCount",
        COUNT(*) FILTER (WHERE session."status"::text = 'IN_PROGRESS')::int
          AS "inProgressCount"
      FROM eligible
      LEFT JOIN "QuizSession" AS session
        ON session."assessmentId" = eligible."assessmentId"
        AND session."userId" = eligible."userId"
      GROUP BY eligible."assessmentId"
    `);

    return {
      eligibleByAssessmentId: new Map(
        rows.map((row) => [row.assessmentId, Number(row.participantCount)]),
      ),
      sessionCounts: rows.flatMap((row) => [
        {
          assessmentId: row.assessmentId,
          status: "SUBMITTED" as const,
          _count: { _all: Number(row.completedCount) },
        },
        {
          assessmentId: row.assessmentId,
          status: "IN_PROGRESS" as const,
          _count: { _all: Number(row.inProgressCount) },
        },
      ]),
    };
  } catch (error) {
    rethrowAssessmentCountCompatibilityError(error);
  }
}

export async function countResolvedAssessmentUsersByAssessment(
  assessmentIds: string[],
) {
  return (await countResolvedAssessmentListStats(assessmentIds))
    .eligibleByAssessmentId;
}

/**
 * Count attempt statuses only for participants who still resolve as enrolled.
 * Historical attempts remain in the database but do not inflate the current
 * assessment-library population after an unenrollment takes effect.
 */
export async function countResolvedAssessmentSessionsByAssessment(
  assessmentIds: string[],
) {
  return (await countResolvedAssessmentListStats(assessmentIds)).sessionCounts;
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
