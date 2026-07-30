import crypto from "node:crypto";
import { Prisma, ReportAccessMode, UnenrollJobStatus } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit-log";
import {
  isAssessmentParticipantRole,
  resolveDueUnenrollOverlay,
  type DueUnenrollJob,
} from "@/lib/assessment-access";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { validateUnenrollDelivery } from "@/lib/identity-policy";
import { isMissingTableError } from "@/lib/prisma-errors";
import { evaluateReportRelease } from "@/lib/report-release";
import { buildScannerResistantReportLinkHtml } from "@/lib/report-share-grant";
import { buildPublishedReportDeliveryIdempotencyKey } from "@/lib/report-delivery-idempotency";
import { sendEmailOrThrow } from "@/lib/resend";

export const BACKFILL_TAG = "backfill_20260224100000_global_assessment_enrollments";

const DEFAULT_LINK_TTL_HOURS = 168;
const MAX_LINK_TTL_HOURS = 720;
const DEFAULT_MAX_DOWNLOADS = 5;
const MAX_DOWNLOADS = 100;
const DEFAULT_JOB_BATCH_SIZE = 25;
const MAX_JOB_BATCH_SIZE = 50;
const DEFAULT_RECIPIENT_BATCH_SIZE = 10;
const MAX_RECIPIENT_BATCH_SIZE = 25;
const MAX_JOB_ATTEMPTS = 3;
const JOB_RETRY_DELAY_MS = 5 * 60 * 1000;
const JOB_CLAIM_LEASE_MS = 10 * 60 * 1000;
const JOB_CLAIM_PREFIX = "JOB_CLAIM_V1";
const JOB_FAILURE_PREFIX = "JOB_FAILURE_V1";
const JOB_CHECKPOINT_PREFIX = "JOB_CHECKPOINT_V1";
const RECIPIENT_RECEIPT_PREFIX = "unenroll.job.recipient.completed";
const DEFAULT_DEADLINE_RESERVE_MS = 5_000;

type UnenrollJobWithAssessment = Prisma.AssessmentUnenrollJobGetPayload<{
  include: {
    assessment: {
      select: {
        id: true;
        title: true;
        policy: {
          select: {
            reportWorkflow: true;
          };
        };
      };
    };
  };
}>;

type ImpactedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  createdAt: Date;
};

type ShareTokenClient = Pick<
  Prisma.TransactionClient,
  "assessmentReportShareToken"
>;

type ShareAccessClient = Pick<
  Prisma.TransactionClient,
  | "assessmentReportAccessOverride"
  | "assessmentTenantEnrollment"
  | "assessmentUnenrollJob"
  | "assessmentUserEnrollment"
  | "user"
>;

type ReportShareBindingClient = Pick<
  Prisma.TransactionClient,
  "quizSession" | "report"
>;

type UnenrollJobOrder = Pick<
  UnenrollJobWithAssessment,
  "createdAt" | "effectiveAt" | "id"
>;

class UnenrollJobSupersededError extends Error {
  constructor(readonly supersededByJobId: string) {
    super(`Unenroll job was superseded by ${supersededByJobId}.`);
    this.name = "UnenrollJobSupersededError";
  }
}

export function selectLatestUnenrollJob<T extends UnenrollJobOrder>(jobs: T[]) {
  return [...jobs].sort(
    (a, b) =>
      b.effectiveAt.getTime() - a.effectiveAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      b.id.localeCompare(a.id),
  )[0] || null;
}

export function selectLatestApplicableUnenrollJobForRecipient<
  T extends DueUnenrollJob,
>(input: {
  userId: string;
  tenantId: string;
  userCreatedAt: Date;
  tenantEnrollments: Array<{
    id: string;
    tenantId: string;
    includeFutureUsers: boolean;
    createdAt: Date;
  }>;
  jobs: T[];
}) {
  const overlay = resolveDueUnenrollOverlay({
    userId: input.userId,
    tenantId: input.tenantId,
    userCreatedAt: input.userCreatedAt,
    tenantEnrollments: input.tenantEnrollments,
    dueJobs: input.jobs,
  });
  return input.jobs.find((job) => job.id === overlay.sourceJobId) || null;
}

export async function lockUnenrollTarget(
  tx: Prisma.TransactionClient,
  input: {
    assessmentId: string;
    targetScope: "USER" | "TENANT";
    targetId: string;
  },
) {
  const key = `${input.assessmentId}:${input.targetScope}:${input.targetId}`;
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext(${`olq-unenroll-target:${key}`})
    ) IS NULL AS "lockResult"
  `);
}

async function lockUnenrollRecipientTargets(
  tx: Prisma.TransactionClient,
  input: {
    assessmentId: string;
    userId: string;
    tenantId: string;
  },
) {
  const targets = [
    { targetScope: "TENANT" as const, targetId: input.tenantId },
    { targetScope: "USER" as const, targetId: input.userId },
  ].sort((a, b) =>
    `${a.targetScope}:${a.targetId}`.localeCompare(
      `${b.targetScope}:${b.targetId}`,
    ),
  );
  for (const target of targets) {
    await lockUnenrollTarget(tx, {
      assessmentId: input.assessmentId,
      ...target,
    });
  }
}

async function assertLatestUnenrollTargetJob(
  client: Pick<Prisma.TransactionClient, "assessmentUnenrollJob">,
  job: UnenrollJobWithAssessment,
  now: Date,
) {
  const latest = await client.assessmentUnenrollJob.findFirst({
    where: {
      assessmentId: job.assessmentId,
      targetScope: job.targetScope,
      targetId: job.targetId,
      effectiveAt: { lte: now },
      status: { not: UnenrollJobStatus.CANCELLED },
    },
    select: { id: true },
    orderBy: [
      { effectiveAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });
  if (latest && latest.id !== job.id) {
    throw new UnenrollJobSupersededError(latest.id);
  }
}

async function findCrossScopeRecipientSupersession(
  tx: Prisma.TransactionClient,
  input: {
    job: UnenrollJobWithAssessment;
    user: ImpactedUser;
    now: Date;
  },
) {
  const [tenantEnrollments, jobs] = await Promise.all([
    tx.assessmentTenantEnrollment.findMany({
      where: {
        assessmentId: input.job.assessmentId,
        tenantId: input.user.tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        includeFutureUsers: true,
        createdAt: true,
      },
    }),
    tx.assessmentUnenrollJob.findMany({
      where: {
        assessmentId: input.job.assessmentId,
        effectiveAt: { lte: input.now },
        status: { not: UnenrollJobStatus.CANCELLED },
        OR: [
          { targetScope: "USER", targetId: input.user.id },
          { targetScope: "TENANT", targetId: input.user.tenantId },
        ],
      },
      select: {
        id: true,
        targetScope: true,
        targetId: true,
        reportMode: true,
        effectiveAt: true,
        createdAt: true,
      },
    }),
  ]);
  const latest = selectLatestApplicableUnenrollJobForRecipient({
    userId: input.user.id,
    tenantId: input.user.tenantId,
    userCreatedAt: input.user.createdAt,
    tenantEnrollments,
    jobs,
  });
  if (!latest || latest.id === input.job.id) return null;
  if (
    latest.targetScope === input.job.targetScope &&
    latest.targetId === input.job.targetId
  ) {
    throw new UnenrollJobSupersededError(latest.id);
  }
  return latest.id;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPlainToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function isReportShareTokenAllowed(input: {
  role: "ADMIN" | "EMPLOYEE" | "LEADER";
  hasActiveEnrollment: boolean;
  dueMode: "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE" | null;
  dueSourceJobId: string | null;
  durableMode: "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE" | null;
  durableSourceJobId: string | null;
  tokenSourceJobId: string | null;
}) {
  if (!isAssessmentParticipantRole(input.role)) return false;
  if (input.dueMode) {
    if (input.dueMode === ReportAccessMode.KEEP_APP_ACCESS) return true;
    if (input.dueMode === ReportAccessMode.REVOKE) return false;
    return Boolean(
      input.dueSourceJobId && input.tokenSourceJobId === input.dueSourceJobId,
    );
  }

  if (input.hasActiveEnrollment) return true;
  if (input.durableMode === ReportAccessMode.KEEP_APP_ACCESS) return true;
  if (input.durableMode !== ReportAccessMode.LINK_ONLY) return false;
  return Boolean(
    input.durableSourceJobId &&
      input.tokenSourceJobId === input.durableSourceJobId,
  );
}

async function isReportShareAllowedAt(
  client: ShareAccessClient,
  input: {
    assessmentId: string;
    userId: string;
    tokenSourceJobId: string | null;
    now: Date;
  },
) {
  const user = await client.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      tenantId: true,
      createdAt: true,
      role: true,
    },
  });
  if (!user) return false;

  const [directEnrollment, tenantEnrollments, durableOverride, dueJobs] =
    await Promise.all([
      client.assessmentUserEnrollment.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId: input.assessmentId,
            userId: user.id,
          },
        },
        select: { active: true, createdAt: true },
      }),
      client.assessmentTenantEnrollment.findMany({
        where: {
          assessmentId: input.assessmentId,
          tenantId: user.tenantId,
          createdAt: { lte: input.now },
        },
        select: {
          id: true,
          active: true,
          tenantId: true,
          includeFutureUsers: true,
          createdAt: true,
        },
      }),
      client.assessmentReportAccessOverride.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId: input.assessmentId,
            userId: user.id,
          },
        },
        select: { mode: true, sourceJobId: true },
      }),
      client.assessmentUnenrollJob.findMany({
        where: {
          assessmentId: input.assessmentId,
          effectiveAt: { lte: input.now },
          status: {
            in: [UnenrollJobStatus.PENDING, UnenrollJobStatus.FAILED],
          },
          OR: [
            { targetScope: "USER", targetId: user.id },
            { targetScope: "TENANT", targetId: user.tenantId },
          ],
        },
        select: {
          id: true,
          targetScope: true,
          targetId: true,
          reportMode: true,
          effectiveAt: true,
          createdAt: true,
        },
      }),
    ]);
  const overlay = resolveDueUnenrollOverlay({
    userId: user.id,
    tenantId: user.tenantId,
    userCreatedAt: user.createdAt,
    tenantEnrollments,
    dueJobs,
  });
  const hasActiveEnrollment = Boolean(
    directEnrollment?.active &&
      directEnrollment.createdAt <= input.now &&
      !overlay.directEnrollmentRevoked,
  ) ||
    tenantEnrollments.some(
      (enrollment) =>
        enrollment.active &&
        !overlay.revokedTenantIds.has(enrollment.tenantId) &&
        (enrollment.includeFutureUsers || user.createdAt <= enrollment.createdAt),
    );
  return isReportShareTokenAllowed({
    role: user.role,
    hasActiveEnrollment,
    dueMode: overlay.overrideMode,
    dueSourceJobId: overlay.sourceJobId,
    durableMode: durableOverride?.mode || null,
    durableSourceJobId: durableOverride?.sourceJobId || null,
    tokenSourceJobId: input.tokenSourceJobId,
  });
}

export async function cancelOutstandingUnenrollJobs(
  client: Prisma.TransactionClient,
  input: {
    assessmentId: string;
    targetScope: "USER" | "TENANT";
    targetId: string;
  },
) {
  await lockUnenrollTarget(client, input);
  const jobs = await client.assessmentUnenrollJob.findMany({
    where: {
      assessmentId: input.assessmentId,
      targetScope: input.targetScope,
      targetId: input.targetId,
      status: { in: [UnenrollJobStatus.PENDING, UnenrollJobStatus.FAILED] },
    },
    select: { id: true },
  });
  if (!jobs.length) return { cancelledJobs: 0, revokedTokens: 0 };

  const jobIds = jobs.map((job) => job.id);
  const [cancelled, revoked] = await Promise.all([
    client.assessmentUnenrollJob.updateMany({
      where: {
        id: { in: jobIds },
        status: { in: [UnenrollJobStatus.PENDING, UnenrollJobStatus.FAILED] },
      },
      data: {
        status: UnenrollJobStatus.CANCELLED,
        errorMessage: "Cancelled because enrollment was reactivated.",
      },
    }),
    client.assessmentReportShareToken.updateMany({
      where: {
        sourceJobId: { in: jobIds },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }),
  ]);
  return { cancelledJobs: cancelled.count, revokedTokens: revoked.count };
}

export function createIdempotentShareToken(input: {
  idempotencyKey: string;
  reportId: string;
  publicationVersionKey: string;
  secret: string;
}) {
  return crypto
    .createHmac("sha256", input.secret)
    .update(
      `olq-report-share-v3:${input.reportId}:${input.publicationVersionKey}:${input.idempotencyKey}`,
    )
    .digest("base64url");
}

async function persistIdempotentShareToken(input: {
  tokenHash: string;
  assessmentId: string;
  userId: string;
  reportId: string;
  publicationVersionKey: string;
  sourceJobId?: string;
  proposedExpiresAt: Date;
  maxDownloads: number;
  now: Date;
}) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${`olq-report-share-token:${input.tokenHash}`})
        ) IS NULL AS "lockResult"
      `);
      const existing = await tx.assessmentReportShareToken.findUnique({
        where: { tokenHash: input.tokenHash },
        select: {
          id: true,
          assessmentId: true,
          userId: true,
          reportId: true,
          publicationVersionKey: true,
          sourceJobId: true,
          expiresAt: true,
        },
      });

      if (existing) {
        if (
          existing.assessmentId !== input.assessmentId ||
          existing.userId !== input.userId ||
          existing.reportId !== input.reportId ||
          existing.publicationVersionKey !== input.publicationVersionKey ||
          (existing.sourceJobId || null) !== (input.sourceJobId || null)
        ) {
          return null;
        }
        const renewExpiredToken = existing.expiresAt <= input.now;
        const updated = await tx.assessmentReportShareToken.update({
          where: { id: existing.id },
          data: {
            revokedAt: null,
            ...(renewExpiredToken
              ? {
                  expiresAt: input.proposedExpiresAt,
                  downloadsUsed: 0,
                  maxDownloads: input.maxDownloads,
                }
              : {}),
          },
          select: { expiresAt: true },
        });
        return updated.expiresAt;
      }

      const created = await tx.assessmentReportShareToken.create({
        data: {
          tokenHash: input.tokenHash,
          assessmentId: input.assessmentId,
          userId: input.userId,
          reportId: input.reportId,
          publicationVersionKey: input.publicationVersionKey,
          expiresAt: input.proposedExpiresAt,
          maxDownloads: input.maxDownloads,
          sourceJobId: input.sourceJobId,
        },
        select: { expiresAt: true },
      });
      return created.expiresAt;
    },
    { maxWait: 5_000, timeout: 15_000 },
  );
}

function normalizeTtlHours(value?: number | null) {
  if (!Number.isInteger(value) || !value || value < 1) return DEFAULT_LINK_TTL_HOURS;
  return Math.min(value, MAX_LINK_TTL_HOURS);
}

function normalizeMaxDownloads(value?: number | null) {
  if (!Number.isInteger(value) || !value || value < 1) return DEFAULT_MAX_DOWNLOADS;
  return Math.min(value, MAX_DOWNLOADS);
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shareBaseUrl() {
  const env = getEnv();
  return (env.REPORT_SHARE_BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

async function getReportShareBinding(
  client: ReportShareBindingClient,
  input: {
    assessmentId: string;
    userId: string;
    now: Date;
  },
) {
  const [report, session] = await Promise.all([
    client.report.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: input.assessmentId,
          userId: input.userId,
        },
      },
      select: {
        id: true,
        publicationGeneration: true,
        narrativeJson: true,
        status: true,
        availableAt: true,
        pdfAsset: { select: { id: true, pdfBytes: true } },
        assessment: {
          select: {
            policy: {
              select: {
                reportWorkflow: true,
                showResultsToEmployee: true,
                resultReleaseDelayHours: true,
              },
            },
          },
        },
      },
    }),
    client.quizSession.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: input.assessmentId,
          userId: input.userId,
        },
      },
      select: { status: true, submittedAt: true },
    }),
  ]);

  if (!report || session?.status !== "SUBMITTED") return null;
  const ready = evaluateReportRelease({
    audience: "SHARED",
    now: input.now,
    report: {
      status: report.status,
      availableAt: report.availableAt,
      hasManualPdf: Boolean(report.pdfAsset),
    },
    policy: {
      reportWorkflow: report.assessment.policy?.reportWorkflow || "AI_STANDARD",
      showResultsToEmployee: report.assessment.policy?.showResultsToEmployee ?? true,
      resultReleaseDelayHours: report.assessment.policy?.resultReleaseDelayHours || 0,
    },
    submittedAt: session?.submittedAt || null,
  }).ready;
  const reportWorkflow = report.assessment.policy?.reportWorkflow || "AI_STANDARD";
  return ready
    ? {
        reportId: report.id,
        publicationVersionKey: buildPublishedReportDeliveryIdempotencyKey({
          reportId: report.id,
          publicationGeneration: report.publicationGeneration,
          reportWorkflow,
          narrativeJson: report.narrativeJson,
          manualPdf: report.pdfAsset,
        }),
      }
    : null;
}

export function reportShareTokenMatchesPublication(input: {
  token: { reportId: string; publicationVersionKey: string };
  binding: { reportId: string; publicationVersionKey: string } | null;
}) {
  return Boolean(
    input.binding &&
      input.binding.reportId === input.token.reportId &&
      input.binding.publicationVersionKey === input.token.publicationVersionKey,
  );
}

export async function issueReportShareToken(input: {
  assessmentId: string;
  userId: string;
  sourceJobId?: string;
  ttlHours?: number;
  maxDownloads?: number;
  idempotencyKey?: string;
  expectedPublicationVersionKey?: string;
}) {
  const now = new Date();
  if (
    !(await isReportShareAllowedAt(db, {
      assessmentId: input.assessmentId,
      userId: input.userId,
      tokenSourceJobId: input.sourceJobId || null,
      now,
    }))
  ) {
    return null;
  }
  const binding = await getReportShareBinding(db, {
    assessmentId: input.assessmentId,
    userId: input.userId,
    now,
  });
  if (!binding) return null;
  if (
    input.expectedPublicationVersionKey &&
    binding.publicationVersionKey !== input.expectedPublicationVersionKey
  ) {
    return null;
  }

  const plainToken = input.idempotencyKey
    ? createIdempotentShareToken({
        idempotencyKey: input.idempotencyKey,
        reportId: binding.reportId,
        publicationVersionKey: binding.publicationVersionKey,
        secret: getEnv().NEXTAUTH_SECRET,
      })
    : createPlainToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(now.getTime() + normalizeTtlHours(input.ttlHours) * 60 * 60 * 1000);
  const maxDownloads = normalizeMaxDownloads(input.maxDownloads);

  let persistedExpiresAt = expiresAt;
  try {
    if (input.idempotencyKey) {
      const persisted = await persistIdempotentShareToken({
        tokenHash,
        assessmentId: input.assessmentId,
        userId: input.userId,
        reportId: binding.reportId,
        publicationVersionKey: binding.publicationVersionKey,
        sourceJobId: input.sourceJobId,
        proposedExpiresAt: expiresAt,
        maxDownloads,
        now,
      });
      if (!persisted) return null;
      persistedExpiresAt = persisted;
    } else {
      await db.assessmentReportShareToken.create({
        data: {
          tokenHash,
          assessmentId: input.assessmentId,
          userId: input.userId,
          reportId: binding.reportId,
          publicationVersionKey: binding.publicationVersionKey,
          expiresAt,
          maxDownloads,
          sourceJobId: input.sourceJobId,
        },
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2003" || error.code === "P2025")
    ) {
      return null;
    }
    if (!isMissingTableError(error, "assessmentreportsharetoken")) throw error;
    return null;
  }

  return { token: plainToken, expiresAt: persistedExpiresAt };
}

export async function revokeReportShareTokens(input: {
  assessmentId: string;
  userId: string;
  sourceJobId?: string;
}) {
  try {
    const result = await db.assessmentReportShareToken.updateMany({
      where: {
        assessmentId: input.assessmentId,
        userId: input.userId,
        revokedAt: null,
        ...(input.sourceJobId ? { sourceJobId: input.sourceJobId } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  } catch (error) {
    if (!isMissingTableError(error, "assessmentreportsharetoken")) throw error;
    return 0;
  }
}

export async function revokeReportShareToken(token: string) {
  try {
    const result = await db.assessmentReportShareToken.updateMany({
      where: {
        tokenHash: hashToken(token),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  } catch (error) {
    if (!isMissingTableError(error, "assessmentreportsharetoken")) throw error;
    return false;
  }
}

export async function lookupReportShareToken(token: string) {
  try {
    const row = await db.assessmentReportShareToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        assessment: { include: { policy: true } },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            tenantId: true,
            createdAt: true,
            role: true,
          },
        },
      },
    });

    if (!row || row.revokedAt || row.expiresAt <= new Date()) return null;
    if (row.downloadsUsed >= row.maxDownloads) return null;
    if (
      !(await isReportShareAllowedAt(db, {
        assessmentId: row.assessmentId,
        userId: row.userId,
        tokenSourceJobId: row.sourceJobId,
        now: new Date(),
      }))
    ) {
      return null;
    }
    const binding = await getReportShareBinding(db, {
      assessmentId: row.assessmentId,
      userId: row.userId,
      now: new Date(),
    });
    if (!reportShareTokenMatchesPublication({ token: row, binding })) {
      return null;
    }
    return row;
  } catch (error) {
    if (!isMissingTableError(error, "assessmentreportsharetoken")) throw error;
    return null;
  }
}

/**
 * Atomically reserves one bounded PDF download before report hydration/rendering.
 * The optimistic downloadsUsed predicate ensures parallel requests cannot all
 * reserve the final slot after reading the same counter value.
 */
export async function reserveReportShareTokenDownload(token: string) {
  const now = new Date();
  try {
    return await db.$transaction(async (tx) => {
      const row = await tx.assessmentReportShareToken.findUnique({
        where: { tokenHash: hashToken(token) },
        include: {
          assessment: { include: { policy: true } },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              tenantId: true,
              createdAt: true,
              role: true,
            },
          },
        },
      });

      if (!row || row.revokedAt || row.expiresAt <= now) return null;
      if (row.downloadsUsed >= row.maxDownloads) return null;
      if (
        !(await isReportShareAllowedAt(tx, {
          assessmentId: row.assessmentId,
          userId: row.userId,
          tokenSourceJobId: row.sourceJobId,
          now,
        }))
      ) {
        return null;
      }
      const binding = await getReportShareBinding(tx, {
        assessmentId: row.assessmentId,
        userId: row.userId,
        now,
      });
      if (!reportShareTokenMatchesPublication({ token: row, binding })) {
        return null;
      }

      const consumed = await tx.assessmentReportShareToken.updateMany({
        where: {
          id: row.id,
          downloadsUsed: row.downloadsUsed,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { downloadsUsed: { increment: 1 } },
      });
      if (consumed.count !== 1) return null;

      return { ...row, downloadsUsed: row.downloadsUsed + 1 };
    });
  } catch (error) {
    if (!isMissingTableError(error, "assessmentreportsharetoken")) throw error;
    return null;
  }
}

/**
 * Releases a reservation when PDF generation cannot produce a response. The
 * decrement is atomic and scoped to the exact token row returned by reserve.
 * Keeping this separate from revocation means a revoked/deleted token remains
 * unavailable even if cleanup cannot find it.
 */
export async function releaseReportShareTokenDownloadReservation(tokenId: string) {
  try {
    const released = await db.assessmentReportShareToken.updateMany({
      where: {
        id: tokenId,
        downloadsUsed: { gt: 0 },
      },
      data: { downloadsUsed: { decrement: 1 } },
    });
    return released.count === 1;
  } catch (error) {
    if (!isMissingTableError(error, "assessmentreportsharetoken")) throw error;
    return false;
  }
}

/**
 * Revalidates a previously reserved slot immediately before response delivery.
 * Unlike lookupReportShareToken, this intentionally permits downloadsUsed to
 * equal maxDownloads because the caller already owns one of those slots.
 */
export async function revalidateReportShareTokenDownloadReservation(input: {
  tokenId: string;
  reportId: string;
}) {
  const now = new Date();
  try {
    return await db.$transaction(async (tx) => {
      const row = await tx.assessmentReportShareToken.findUnique({
        where: { id: input.tokenId },
        select: {
          id: true,
          assessmentId: true,
          userId: true,
          reportId: true,
          publicationVersionKey: true,
          sourceJobId: true,
          revokedAt: true,
          expiresAt: true,
          maxDownloads: true,
          downloadsUsed: true,
        },
      });
      if (
        !row ||
        row.reportId !== input.reportId ||
        row.revokedAt ||
        row.expiresAt <= now ||
        row.downloadsUsed < 1 ||
        row.downloadsUsed > row.maxDownloads
      ) {
        return false;
      }

      const binding = await getReportShareBinding(tx, {
        assessmentId: row.assessmentId,
        userId: row.userId,
        now,
      });
      if (!reportShareTokenMatchesPublication({ token: row, binding })) {
        return false;
      }

      return isReportShareAllowedAt(tx, {
        assessmentId: row.assessmentId,
        userId: row.userId,
        tokenSourceJobId: row.sourceJobId,
        now,
      });
    });
  } catch (error) {
    if (!isMissingTableError(error, "assessmentreportsharetoken")) throw error;
    return false;
  }
}

function encodeClaim(input: {
  claimId: string;
  attempt: number;
  claimedAt: Date;
}) {
  return `${JOB_CLAIM_PREFIX}|${input.attempt}|${input.claimedAt.toISOString()}|${input.claimId}`;
}

function encodeFailure(attempt: number, message: string) {
  const compactMessage = message.replaceAll(/[\r\n|]+/g, " ").slice(0, 600);
  return `${JOB_FAILURE_PREFIX}|${attempt}|${compactMessage}`;
}

function encodeCheckpoint(input: {
  attempt: number;
  completedRecipients: number;
  totalRecipients: number;
}) {
  return `${JOB_CHECKPOINT_PREFIX}|${input.attempt}|${input.completedRecipients}|${input.totalRecipients}`;
}

export function parseJobExecutionState(errorMessage: string | null) {
  if (!errorMessage) return { kind: "none" as const, attempt: 0 };
  const [prefix, rawAttempt, claimedAt] = errorMessage.split("|", 4);
  const attempt = Number.parseInt(rawAttempt || "", 10);

  if (prefix === JOB_CLAIM_PREFIX && Number.isInteger(attempt) && claimedAt) {
    const parsedClaimedAt = new Date(claimedAt);
    if (!Number.isNaN(parsedClaimedAt.getTime())) {
      return {
        kind: "claim" as const,
        attempt,
        claimedAt: parsedClaimedAt,
      };
    }
  }
  if (prefix === JOB_FAILURE_PREFIX && Number.isInteger(attempt)) {
    return { kind: "failure" as const, attempt };
  }
  if (prefix === JOB_CHECKPOINT_PREFIX && Number.isInteger(attempt)) {
    return { kind: "checkpoint" as const, attempt };
  }
  return { kind: "legacy_failure" as const, attempt: 1 };
}

export function isJobRetryEligible(input: {
  status: UnenrollJobStatus;
  errorMessage: string | null;
  updatedAt: Date;
  effectiveAt: Date;
  now: Date;
  forced?: boolean;
}) {
  if (input.status === UnenrollJobStatus.COMPLETED || input.status === UnenrollJobStatus.CANCELLED) {
    return false;
  }
  if (input.status === UnenrollJobStatus.PENDING) {
    return input.forced || input.effectiveAt <= input.now;
  }

  const state = parseJobExecutionState(input.errorMessage);
  if (state.kind === "claim") {
    return input.now.getTime() - state.claimedAt.getTime() >= JOB_CLAIM_LEASE_MS;
  }
  if (!input.forced && state.attempt >= MAX_JOB_ATTEMPTS) return false;
  return input.forced || input.now.getTime() - input.updatedAt.getTime() >= JOB_RETRY_DELAY_MS;
}

function nextAttempt(job: UnenrollJobWithAssessment) {
  const state = parseJobExecutionState(job.errorMessage);
  return state.kind === "checkpoint"
    ? Math.max(state.attempt, 1)
    : state.attempt + 1;
}

export function selectUnenrollRecipientBatch<T extends { id: string }>(input: {
  impactedUsers: T[];
  completedUserIds: Iterable<string>;
  limit?: number;
}) {
  const completed = new Set(input.completedUserIds);
  const pending = input.impactedUsers.filter((user) => !completed.has(user.id));
  const limit = Math.min(
    Math.max(input.limit || DEFAULT_RECIPIENT_BATCH_SIZE, 1),
    MAX_RECIPIENT_BATCH_SIZE,
  );
  return {
    batch: pending.slice(0, limit),
    remaining: Math.max(0, pending.length - limit),
    completed: input.impactedUsers.length - pending.length,
  };
}

export function shouldStopUnenrollWork(input: {
  nowMs: number;
  deadlineAtMs?: number;
  reserveMs?: number;
}) {
  if (input.deadlineAtMs === undefined) return false;
  const reserveMs = Math.max(
    input.reserveMs ?? DEFAULT_DEADLINE_RESERVE_MS,
    0,
  );
  return input.nowMs >= input.deadlineAtMs - reserveMs;
}

export async function listUnenrollImpactedUsers(input: {
  assessmentId: string;
  targetScope: "USER" | "TENANT";
  targetId: string;
}) {
  if (input.targetScope === "USER") {
    return db.user.findMany({
      where: {
        id: input.targetId,
        role: { in: ["EMPLOYEE", "LEADER"] },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantId: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    });
  }

  const enrollment = await db.assessmentTenantEnrollment.findUnique({
    where: {
      assessmentId_tenantId: {
        assessmentId: input.assessmentId,
        tenantId: input.targetId,
      },
    },
    select: {
      includeFutureUsers: true,
      createdAt: true,
    },
  });
  if (!enrollment) return [];

  const users = await db.user.findMany({
    where: {
      tenantId: input.targetId,
      role: { in: ["EMPLOYEE", "LEADER"] },
      ...(!enrollment.includeFutureUsers
        ? { createdAt: { lte: enrollment.createdAt } }
        : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      tenantId: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });
  return users;
}

async function resolveImpactedUsers(job: UnenrollJobWithAssessment) {
  return listUnenrollImpactedUsers({
    assessmentId: job.assessmentId,
    targetScope: job.targetScope,
    targetId: job.targetId,
  });
}

async function resolveAuditTenantId(job: UnenrollJobWithAssessment) {
  if (job.targetScope === "TENANT") {
    const target = await db.tenant.findUnique({
      where: { id: job.targetId },
      select: { id: true },
    });
    if (target) return target.id;
  } else {
    const target = await db.user.findUnique({
      where: { id: job.targetId },
      select: { tenantId: true },
    });
    if (target) return target.tenantId;
  }

  if (!job.createdByAdminId) return null;
  const creator = await db.user.findUnique({
    where: { id: job.createdByAdminId },
    select: { tenantId: true },
  });
  return creator?.tenantId || null;
}

async function claimJob(input: {
  job: UnenrollJobWithAssessment;
  now: Date;
  actorId?: string | null;
  trigger: string;
  auditTenantId: string | null;
}) {
  const claimId = crypto.randomUUID();
  const attempt = nextAttempt(input.job);
  const claimMessage = encodeClaim({ claimId, attempt, claimedAt: input.now });

  const claimed = await db.$transaction(async (tx) => {
    const result = await tx.assessmentUnenrollJob.updateMany({
      where: {
        id: input.job.id,
        status: input.job.status,
        updatedAt: input.job.updatedAt,
        errorMessage: input.job.errorMessage,
      },
      data: {
        status: UnenrollJobStatus.FAILED,
        errorMessage: claimMessage,
      },
    });
    if (result.count !== 1) return false;

    if (input.auditTenantId) {
      await recordAuditLog(
        {
          tenantId: input.auditTenantId,
          actorId: input.actorId || null,
          action: "unenroll.job.claimed",
          metadata: {
            jobId: input.job.id,
            attempt,
            trigger: input.trigger,
          },
        },
        tx,
      );
    }
    return true;
  });

  return claimed ? { claimMessage, attempt } : null;
}

async function assertLinkOnlyReportsReady(
  job: UnenrollJobWithAssessment,
  impactedUsers: ImpactedUser[],
  now: Date,
) {
  if (job.reportMode !== ReportAccessMode.LINK_ONLY) return;
  await assertLinkOnlyReportRecipientsReady({
    assessmentId: job.assessmentId,
    userIds: impactedUsers.map((user) => user.id),
    now,
    reportWorkflow: job.assessment.policy?.reportWorkflow || "AI_STANDARD",
  });
}

export async function assertLinkOnlyReportRecipientsReady(input: {
  assessmentId: string;
  userIds: string[];
  now?: Date;
  reportWorkflow?: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
}) {
  if (input.userIds.length === 0) return;
  const now = input.now || new Date();
  const [assessment, reports, sessions] = await Promise.all([
    db.assessment.findUnique({
      where: { id: input.assessmentId },
      select: {
        policy: {
          select: {
            reportWorkflow: true,
            showResultsToEmployee: true,
            resultReleaseDelayHours: true,
          },
        },
      },
    }),
    db.report.findMany({
      where: {
        assessmentId: input.assessmentId,
        userId: { in: input.userIds },
      },
      select: {
        userId: true,
        status: true,
        availableAt: true,
        pdfAsset: { select: { id: true } },
      },
    }),
    db.quizSession.findMany({
      where: {
        assessmentId: input.assessmentId,
        userId: { in: input.userIds },
      },
      select: { userId: true, submittedAt: true },
    }),
  ]);
  const reportsByUser = new Map(reports.map((report) => [report.userId, report]));
  const sessionsByUser = new Map(sessions.map((session) => [session.userId, session]));
  const policy = {
    reportWorkflow:
      assessment?.policy?.reportWorkflow || input.reportWorkflow || "AI_STANDARD",
    showResultsToEmployee: assessment?.policy?.showResultsToEmployee ?? true,
    resultReleaseDelayHours: assessment?.policy?.resultReleaseDelayHours || 0,
  };
  const readyUserIds = new Set(
    input.userIds.filter((userId) => {
      const report = reportsByUser.get(userId);
      return evaluateReportRelease({
        audience: "SHARED",
        now,
        report: report
          ? {
              status: report.status,
              availableAt: report.availableAt,
              hasManualPdf: Boolean(report.pdfAsset),
            }
          : null,
        policy,
        submittedAt: sessionsByUser.get(userId)?.submittedAt || null,
      }).ready;
    }),
  );
  if (input.userIds.some((userId) => !readyUserIds.has(userId))) {
    throw new Error(
      "Link-only unenrollment requires a published, currently available report for every impacted participant.",
    );
  }
}

async function revokeTokensWithClient(
  client: ShareTokenClient,
  assessmentId: string,
  userId: string,
  revokedAt: Date,
) {
  await client.assessmentReportShareToken.updateMany({
    where: { assessmentId, userId, revokedAt: null },
    data: { revokedAt },
  });
}

async function getCompletedRecipientIds(input: {
  jobId: string;
  auditTenantId: string | null;
}) {
  if (!input.auditTenantId) return new Set<string>();
  const prefix = `${RECIPIENT_RECEIPT_PREFIX}:${input.jobId}:`;
  const receipts = await db.auditLog.findMany({
    where: {
      tenantId: input.auditTenantId,
      action: { startsWith: prefix },
    },
    select: { action: true },
  });
  return new Set(
    receipts
      .map((receipt) => receipt.action.slice(prefix.length))
      .filter(Boolean),
  );
}

async function applyRecipientEffects(input: {
  job: UnenrollJobWithAssessment;
  user: ImpactedUser;
  now: Date;
  claimMessage: string;
}) {
  let token: string | null = null;
  await db.$transaction(async (tx) => {
    await lockUnenrollRecipientTargets(tx, {
      assessmentId: input.job.assessmentId,
      userId: input.user.id,
      tenantId: input.user.tenantId,
    });
    const activeClaim = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "AssessmentUnenrollJob"
      WHERE "id" = ${input.job.id}
        AND "status" = 'FAILED'::"UnenrollJobStatus"
        AND "errorMessage" = ${input.claimMessage}
      FOR UPDATE
    `);
    if (!activeClaim.length) {
      throw new Error("Unenroll job claim was cancelled or replaced.");
    }
    await assertLatestUnenrollTargetJob(tx, input.job, input.now);
    const supersededByJobId = await findCrossScopeRecipientSupersession(tx, {
      job: input.job,
      user: input.user,
      now: input.now,
    });
    if (supersededByJobId) {
      await tx.assessmentReportShareToken.updateMany({
        where: {
          assessmentId: input.job.assessmentId,
          userId: input.user.id,
          sourceJobId: input.job.id,
          revokedAt: null,
        },
        data: { revokedAt: input.now },
      });
      return;
    }

    await tx.assessmentReportAccessOverride.upsert({
      where: {
        assessmentId_userId: {
          assessmentId: input.job.assessmentId,
          userId: input.user.id,
        },
      },
      create: {
        assessmentId: input.job.assessmentId,
        userId: input.user.id,
        mode: input.job.reportMode,
        sourceJobId: input.job.id,
        createdByAdminId: input.job.createdByAdminId,
      },
      update: {
        mode: input.job.reportMode,
        sourceJobId: input.job.id,
        createdByAdminId: input.job.createdByAdminId,
      },
    });

    if (
      input.job.reportMode === ReportAccessMode.REVOKE ||
      input.job.reportMode === ReportAccessMode.LINK_ONLY
    ) {
      await revokeTokensWithClient(
        tx,
        input.job.assessmentId,
        input.user.id,
        input.now,
      );
    }

    if (input.job.reportMode === ReportAccessMode.LINK_ONLY) {
      const report = await tx.report.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId: input.job.assessmentId,
            userId: input.user.id,
          },
        },
        select: {
          id: true,
          publicationGeneration: true,
          narrativeJson: true,
          pdfAsset: { select: { id: true, pdfBytes: true } },
        },
      });
      if (!report) {
        throw new Error(
          "Link-only unenrollment requires a current report for every recipient.",
        );
      }
      const publicationVersionKey =
        buildPublishedReportDeliveryIdempotencyKey({
          reportId: report.id,
          publicationGeneration: report.publicationGeneration,
          reportWorkflow:
            input.job.assessment.policy?.reportWorkflow || "AI_STANDARD",
          narrativeJson: report.narrativeJson,
          manualPdf: report.pdfAsset,
        });
      token = createIdempotentShareToken({
        idempotencyKey: `${input.job.id}:${input.user.id}`,
        reportId: report.id,
        publicationVersionKey,
        secret: getEnv().NEXTAUTH_SECRET,
      });
      const expiresAt = new Date(
        input.now.getTime() +
          normalizeTtlHours(input.job.linkTtlHours) * 60 * 60 * 1000,
      );
      await tx.assessmentReportShareToken.upsert({
        where: { tokenHash: hashToken(token) },
        create: {
          tokenHash: hashToken(token),
          assessmentId: input.job.assessmentId,
          userId: input.user.id,
          reportId: report.id,
          publicationVersionKey,
          expiresAt,
          maxDownloads: DEFAULT_MAX_DOWNLOADS,
          sourceJobId: input.job.id,
        },
        update: {
          expiresAt,
          revokedAt: null,
          reportId: report.id,
          publicationVersionKey,
          sourceJobId: input.job.id,
        },
      });
    }
  });
  return token;
}

async function deliverJobNotification(input: {
  job: UnenrollJobWithAssessment;
  user: ImpactedUser;
  token: string | null;
  claimMessage: string;
}) {
  if (!input.job.notifyByEmail) return null;
  const notificationCheck = await db.$transaction(async (tx) => {
    await lockUnenrollRecipientTargets(tx, {
      assessmentId: input.job.assessmentId,
      userId: input.user.id,
      tenantId: input.user.tenantId,
    });
    await assertLatestUnenrollTargetJob(tx, input.job, new Date());
    const supersededByJobId = await findCrossScopeRecipientSupersession(tx, {
      job: input.job,
      user: input.user,
      now: new Date(),
    });
    if (supersededByJobId) {
      await tx.assessmentReportShareToken.updateMany({
        where: {
          assessmentId: input.job.assessmentId,
          userId: input.user.id,
          sourceJobId: input.job.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
    const activeClaim = await tx.assessmentUnenrollJob.count({
      where: {
        id: input.job.id,
        status: UnenrollJobStatus.FAILED,
        errorMessage: input.claimMessage,
      },
    });
    return { activeClaim, supersededByJobId };
  });
  if (notificationCheck.activeClaim !== 1) {
    throw new Error("Unenroll job claim was cancelled before notification.");
  }
  if (notificationCheck.supersededByJobId) return null;
  const env = getEnv();
  const baseUrl = shareBaseUrl();
  const reportLinks = input.token
    ? `${buildScannerResistantReportLinkHtml({ baseUrl, token: input.token })}
<p>This secure link expires automatically.</p>`
    : input.job.reportMode === ReportAccessMode.KEEP_APP_ACCESS
      ? `<p>Your report remains available after sign-in.</p><p><a href="${baseUrl}/reports/current">Open your reports</a></p>`
      : "<p>Your report access has been revoked.</p>";

  return sendEmailOrThrow(
    {
      from: env.EMAIL_FROM,
      to: input.user.email,
      subject: `Assessment report access changed: ${input.job.assessment.title}`,
      html: `<p>Hi ${escapeHtml(input.user.firstName || "there")},</p>
<p>Your access to <strong>${escapeHtml(input.job.assessment.title)}</strong> has changed.</p>
${reportLinks}`,
    },
    {
      idempotencyKey: input.token
        ? `unenroll-${input.job.id}-${input.user.id}-${hashToken(input.token).slice(0, 16)}`
        : `unenroll-${input.job.id}-${input.user.id}`,
    },
  );
}

async function recordRecipientCompleted(input: {
  job: UnenrollJobWithAssessment;
  user: ImpactedUser;
  auditTenantId: string;
  actorId?: string | null;
  trigger: string;
  deliveryId?: string | null;
}) {
  await recordAuditLog({
    tenantId: input.auditTenantId,
    actorId: input.actorId || null,
    action: `${RECIPIENT_RECEIPT_PREFIX}:${input.job.id}:${input.user.id}`,
    metadata: {
      jobId: input.job.id,
      userId: input.user.id,
      trigger: input.trigger,
      deliveryId: input.deliveryId || null,
    },
  });
}

async function checkpointJob(input: {
  job: UnenrollJobWithAssessment;
  claimMessage: string;
  attempt: number;
  completedRecipients: number;
  totalRecipients: number;
  auditTenantId: string | null;
  actorId?: string | null;
  trigger: string;
}) {
  const checkpointMessage = encodeCheckpoint({
    attempt: input.attempt,
    completedRecipients: input.completedRecipients,
    totalRecipients: input.totalRecipients,
  });
  return db.$transaction(async (tx) => {
    const result = await tx.assessmentUnenrollJob.updateMany({
      where: {
        id: input.job.id,
        status: UnenrollJobStatus.FAILED,
        errorMessage: input.claimMessage,
      },
      data: {
        status: UnenrollJobStatus.PENDING,
        errorMessage: checkpointMessage,
      },
    });
    if (result.count !== 1) {
      throw new Error("Unenroll job claim was lost before checkpointing.");
    }

    if (input.auditTenantId) {
      await recordAuditLog(
        {
          tenantId: input.auditTenantId,
          actorId: input.actorId || null,
          action: "unenroll.job.checkpointed",
          metadata: {
            jobId: input.job.id,
            attempt: input.attempt,
            completedRecipients: input.completedRecipients,
            totalRecipients: input.totalRecipients,
            trigger: input.trigger,
          },
        },
        tx,
      );
    }
  });
}

async function finalizeJob(input: {
  job: UnenrollJobWithAssessment;
  claimMessage: string;
  impactedUsers: number;
  now: Date;
  auditTenantId: string | null;
  actorId?: string | null;
  trigger: string;
}) {
  return db.$transaction(async (tx) => {
    await lockUnenrollTarget(tx, input.job);
    await assertLatestUnenrollTargetJob(tx, input.job, new Date());
    const result = await tx.assessmentUnenrollJob.updateMany({
      where: {
        id: input.job.id,
        status: UnenrollJobStatus.FAILED,
        errorMessage: input.claimMessage,
      },
      data: {
        status: UnenrollJobStatus.COMPLETED,
        executedAt: input.now,
        errorMessage: null,
      },
    });
    if (result.count !== 1) {
      throw new Error("Unenroll job claim was lost before completion.");
    }

    if (input.job.targetScope === "USER") {
      await tx.assessmentUserEnrollment.updateMany({
        where: {
          assessmentId: input.job.assessmentId,
          userId: input.job.targetId,
        },
        data: { active: false },
      });
    } else {
      await tx.assessmentTenantEnrollment.updateMany({
        where: {
          assessmentId: input.job.assessmentId,
          tenantId: input.job.targetId,
        },
        data: { active: false },
      });
    }

    if (input.auditTenantId) {
      await recordAuditLog(
        {
          tenantId: input.auditTenantId,
          actorId: input.actorId || null,
          action: "unenroll.job.completed",
          metadata: {
            jobId: input.job.id,
            impactedUsers: input.impactedUsers,
            trigger: input.trigger,
          },
        },
        tx,
      );
    }
  });
}

async function cancelSupersededJob(input: {
  job: UnenrollJobWithAssessment;
  claimMessage: string;
  supersededByJobId: string;
  auditTenantId: string | null;
  actorId?: string | null;
  trigger: string;
}) {
  await db.$transaction(async (tx) => {
    await lockUnenrollTarget(tx, input.job);
    const result = await tx.assessmentUnenrollJob.updateMany({
      where: {
        id: input.job.id,
        status: UnenrollJobStatus.FAILED,
        errorMessage: input.claimMessage,
      },
      data: {
        status: UnenrollJobStatus.CANCELLED,
        errorMessage: `Superseded by unenroll job ${input.supersededByJobId}.`,
      },
    });
    await tx.assessmentReportShareToken.updateMany({
      where: {
        sourceJobId: input.job.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1 || !input.auditTenantId) return;
    await recordAuditLog(
      {
        tenantId: input.auditTenantId,
        actorId: input.actorId || null,
        action: "unenroll.job.superseded",
        metadata: {
          jobId: input.job.id,
          supersededByJobId: input.supersededByJobId,
          trigger: input.trigger,
        },
      },
      tx,
    );
  });
}

async function failJob(input: {
  job: UnenrollJobWithAssessment;
  claimMessage: string;
  attempt: number;
  message: string;
  auditTenantId: string | null;
  actorId?: string | null;
  trigger: string;
}) {
  const failureMessage = encodeFailure(input.attempt, input.message);
  await db.$transaction(async (tx) => {
    const result = await tx.assessmentUnenrollJob.updateMany({
      where: {
        id: input.job.id,
        status: UnenrollJobStatus.FAILED,
        errorMessage: input.claimMessage,
      },
      data: {
        status: UnenrollJobStatus.FAILED,
        errorMessage: failureMessage,
      },
    });
    if (result.count !== 1) return;

    if (input.auditTenantId) {
      await recordAuditLog(
        {
          tenantId: input.auditTenantId,
          actorId: input.actorId || null,
          action: "unenroll.job.failed",
          metadata: {
            jobId: input.job.id,
            attempt: input.attempt,
            trigger: input.trigger,
            error: input.message.slice(0, 600),
          },
        },
        tx,
      );
    }
  });
}

export async function runDueUnenrollJobs(options?: {
  assessmentId?: string;
  forceJobId?: string;
  now?: Date;
  limit?: number;
  recipientBatchSize?: number;
  deadlineAtMs?: number;
  executionActorId?: string | null;
  trigger?: "cron" | "internal" | "admin";
}) {
  const now = options?.now || new Date();
  const limit = Math.min(Math.max(options?.limit || DEFAULT_JOB_BATCH_SIZE, 1), MAX_JOB_BATCH_SIZE);
  const recipientBatchSize = Math.min(
    Math.max(options?.recipientBatchSize || DEFAULT_RECIPIENT_BATCH_SIZE, 1),
    MAX_RECIPIENT_BATCH_SIZE,
  );
  const trigger = options?.trigger || (options?.forceJobId ? "admin" : "cron");
  const jobInclude = {
    assessment: {
      select: {
        id: true,
        title: true,
        policy: { select: { reportWorkflow: true } },
      },
    },
  } as const;

  let jobs: UnenrollJobWithAssessment[];
  try {
    if (options?.forceJobId) {
      jobs = await db.assessmentUnenrollJob.findMany({
        where: {
          id: options.forceJobId,
          ...(options.assessmentId ? { assessmentId: options.assessmentId } : {}),
        },
        include: jobInclude,
        take: 1,
      });
    } else {
      const [pendingJobs, retryJobs] = await Promise.all([
        db.assessmentUnenrollJob.findMany({
          where: {
            status: UnenrollJobStatus.PENDING,
            effectiveAt: { lte: now },
            ...(options?.assessmentId ? { assessmentId: options.assessmentId } : {}),
          },
          include: jobInclude,
          orderBy: [{ updatedAt: "asc" }, { effectiveAt: "asc" }],
          take: limit,
        }),
        db.assessmentUnenrollJob.findMany({
          where: {
            status: UnenrollJobStatus.FAILED,
            updatedAt: { lte: new Date(now.getTime() - JOB_RETRY_DELAY_MS) },
            ...(options?.assessmentId ? { assessmentId: options.assessmentId } : {}),
          },
          include: jobInclude,
          orderBy: { effectiveAt: "asc" },
          take: limit * 4,
        }),
      ]);
      jobs = [...pendingJobs, ...retryJobs].sort(
        (a, b) =>
          a.updatedAt.getTime() - b.updatedAt.getTime() ||
          a.effectiveAt.getTime() - b.effectiveAt.getTime(),
      );
    }
  } catch (error) {
    if (!isMissingTableError(error, "assessmentunenrolljob")) throw error;
    return { processed: 0, hasContinuations: false, results: [] };
  }

  const candidates = jobs
    .filter((job) =>
      isJobRetryEligible({
        status: job.status,
        errorMessage: job.errorMessage,
        updatedAt: job.updatedAt,
        effectiveAt: job.effectiveAt,
        now,
        forced: Boolean(options?.forceJobId),
      }),
    )
    .slice(0, limit);

  const results: Array<{
    jobId: string;
    status: UnenrollJobStatus;
    impactedUsers: number;
    error?: string;
    continuing?: boolean;
    remainingUsers?: number;
  }> = [];

  for (const job of candidates) {
    if (
      shouldStopUnenrollWork({
        nowMs: Date.now(),
        deadlineAtMs: options?.deadlineAtMs,
      })
    ) {
      break;
    }
    let processedRecipients = 0;
    const auditTenantId = await resolveAuditTenantId(job);
    const claim = await claimJob({
      job,
      now,
      actorId: options?.executionActorId,
      trigger,
      auditTenantId,
    });
    if (!claim) continue;

    try {
      validateUnenrollDelivery({
        reportMode: job.reportMode,
        notifyByEmail: job.notifyByEmail,
        linkTtlHours: job.linkTtlHours,
      });
      const impactedUsers = await resolveImpactedUsers(job);
      const completedUserIds = await getCompletedRecipientIds({
        jobId: job.id,
        auditTenantId,
      });
      const recipientSelection = selectUnenrollRecipientBatch({
        impactedUsers,
        completedUserIds,
        limit: recipientBatchSize,
      });
      if (recipientSelection.batch.length > 0 && !auditTenantId) {
        throw new Error("Cannot checkpoint unenrollment recipients without an audit tenant.");
      }

      await assertLinkOnlyReportsReady(job, recipientSelection.batch, now);
      for (const user of recipientSelection.batch) {
        if (
          shouldStopUnenrollWork({
            nowMs: Date.now(),
            deadlineAtMs: options?.deadlineAtMs,
          })
        ) {
          break;
        }
        const token = await applyRecipientEffects({
          job,
          user,
          now: new Date(),
          claimMessage: claim.claimMessage,
        });
        const delivery = await deliverJobNotification({
          job,
          user,
          token,
          claimMessage: claim.claimMessage,
        });
        await recordRecipientCompleted({
          job,
          user,
          auditTenantId: auditTenantId!,
          actorId: options?.executionActorId,
          trigger,
          deliveryId: delivery?.id,
        });
        processedRecipients += 1;
      }

      const remainingUsers =
        recipientSelection.remaining +
        (recipientSelection.batch.length - processedRecipients);
      if (remainingUsers > 0) {
        await checkpointJob({
          job,
          claimMessage: claim.claimMessage,
          attempt: claim.attempt,
          completedRecipients: recipientSelection.completed + processedRecipients,
          totalRecipients: impactedUsers.length,
          auditTenantId,
          actorId: options?.executionActorId,
          trigger,
        });
        results.push({
          jobId: job.id,
          status: UnenrollJobStatus.PENDING,
          impactedUsers: processedRecipients,
          continuing: true,
          remainingUsers,
        });
        continue;
      }

      await finalizeJob({
        job,
        claimMessage: claim.claimMessage,
        impactedUsers: impactedUsers.length,
        now,
        auditTenantId,
        actorId: options?.executionActorId,
        trigger,
      });

      results.push({
        jobId: job.id,
        status: UnenrollJobStatus.COMPLETED,
        impactedUsers: processedRecipients,
      });
    } catch (error) {
      if (error instanceof UnenrollJobSupersededError) {
        await cancelSupersededJob({
          job,
          claimMessage: claim.claimMessage,
          supersededByJobId: error.supersededByJobId,
          auditTenantId,
          actorId: options?.executionActorId,
          trigger,
        });
        results.push({
          jobId: job.id,
          status: UnenrollJobStatus.CANCELLED,
          impactedUsers: processedRecipients,
        });
        continue;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      await failJob({
        job,
        claimMessage: claim.claimMessage,
        attempt: claim.attempt,
        message,
        auditTenantId,
        actorId: options?.executionActorId,
        trigger,
      });
      results.push({
        jobId: job.id,
        status: UnenrollJobStatus.FAILED,
        impactedUsers: processedRecipients,
        error: message,
      });
    }
  }

  return {
    processed: results.length,
    hasContinuations: results.some((result) => result.continuing),
    results,
  };
}

export async function drainDueUnenrollJobs(options?: {
  now?: Date;
  batchSize?: number;
  maxBatches?: number;
  maxDurationMs?: number;
  recipientBatchSize?: number;
  executionActorId?: string | null;
  trigger?: "cron" | "internal";
}) {
  const startedAt = Date.now();
  const batchSize = Math.min(
    Math.max(options?.batchSize || DEFAULT_JOB_BATCH_SIZE, 1),
    MAX_JOB_BATCH_SIZE,
  );
  const maxBatches = Math.min(Math.max(options?.maxBatches || 8, 1), 20);
  const maxDurationMs = Math.min(
    Math.max(options?.maxDurationMs || 40_000, 1_000),
    45_000,
  );
  const deadlineAtMs = startedAt + maxDurationMs;
  const results: Awaited<ReturnType<typeof runDueUnenrollJobs>>["results"] = [];
  let batches = 0;

  while (
    batches < maxBatches &&
    !shouldStopUnenrollWork({ nowMs: Date.now(), deadlineAtMs })
  ) {
    const batch = await runDueUnenrollJobs({
      now: options?.now,
      limit: batchSize,
      recipientBatchSize: options?.recipientBatchSize,
      deadlineAtMs,
      executionActorId: options?.executionActorId,
      trigger: options?.trigger || "cron",
    });
    batches += 1;
    results.push(...batch.results);
    if (batch.processed < batchSize && !batch.hasContinuations) break;
  }

  return {
    processed: results.length,
    batches,
    durationMs: Date.now() - startedAt,
    results,
  };
}
