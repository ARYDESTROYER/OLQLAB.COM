import crypto from "node:crypto";
import { ReportAccessMode, UnenrollJobStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getResend } from "@/lib/resend";

export const BACKFILL_TAG = "backfill_20260224100000_global_assessment_enrollments";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createPlainToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function shareBaseUrl() {
  const env = getEnv();
  return env.REPORT_SHARE_BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000";
}

export async function issueReportShareToken(input: {
  assessmentId: string;
  userId: string;
  sourceJobId?: string;
  ttlHours?: number;
  maxDownloads?: number;
}) {
  const plainToken = createPlainToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * (input.ttlHours && input.ttlHours > 0 ? input.ttlHours : 168),
  );

  await db.assessmentReportShareToken.create({
    data: {
      tokenHash,
      assessmentId: input.assessmentId,
      userId: input.userId,
      expiresAt,
      maxDownloads: input.maxDownloads && input.maxDownloads > 0 ? input.maxDownloads : 5,
      sourceJobId: input.sourceJobId,
    },
  });

  return {
    token: plainToken,
    expiresAt,
  };
}

export async function lookupReportShareToken(token: string) {
  const row = await db.assessmentReportShareToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      assessment: {
        include: {
          policy: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt < new Date()) return null;
  if (row.downloadsUsed >= row.maxDownloads) return null;

  return row;
}

export async function consumeReportShareToken(token: string) {
  const row = await lookupReportShareToken(token);
  if (!row) return null;

  await db.assessmentReportShareToken.update({
    where: {
      id: row.id,
    },
    data: {
      downloadsUsed: { increment: 1 },
    },
  });

  return row;
}

export async function runDueUnenrollJobs(options?: {
  assessmentId?: string;
  userId?: string;
  forceJobId?: string;
  now?: Date;
}) {
  const now = options?.now || new Date();

  const jobs = await db.assessmentUnenrollJob.findMany({
    where: {
      ...(options?.forceJobId
        ? {
            id: options.forceJobId,
          }
        : {
            status: UnenrollJobStatus.PENDING,
            effectiveAt: { lte: now },
          }),
      ...(options?.assessmentId
        ? {
            assessmentId: options.assessmentId,
          }
        : {}),
    },
    include: {
      assessment: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: {
      effectiveAt: "asc",
    },
    take: options?.forceJobId ? 1 : 25,
  });

  const results: Array<{
    jobId: string;
    status: UnenrollJobStatus;
    impactedUsers: number;
    error?: string;
  }> = [];

  for (const job of jobs) {
    try {
      const impactedUsers =
        job.targetScope === "USER"
          ? await db.user.findMany({
              where: {
                id: job.targetId,
              },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            })
          : await db.user.findMany({
              where: {
                tenantId: job.targetId,
                role: { in: ["EMPLOYEE", "LEADER"] },
              },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            });

      if (options?.userId) {
        const filtered = impactedUsers.filter((user) => user.id === options.userId);
        if (filtered.length === 0) {
          continue;
        }
      }

      const tokensForEmail: Array<{
        token: string;
        email: string;
        firstName: string;
      }> = [];

      await db.$transaction(async (tx) => {
        if (job.targetScope === "USER") {
          await tx.assessmentUserEnrollment.updateMany({
            where: {
              assessmentId: job.assessmentId,
              userId: job.targetId,
            },
            data: {
              active: false,
            },
          });
        }

        if (job.targetScope === "TENANT") {
          await tx.assessmentTenantEnrollment.updateMany({
            where: {
              assessmentId: job.assessmentId,
              tenantId: job.targetId,
            },
            data: {
              active: false,
            },
          });
        }

        for (const user of impactedUsers) {
          await tx.assessmentReportAccessOverride.upsert({
            where: {
              assessmentId_userId: {
                assessmentId: job.assessmentId,
                userId: user.id,
              },
            },
            create: {
              assessmentId: job.assessmentId,
              userId: user.id,
              mode: job.reportMode,
              sourceJobId: job.id,
              createdByAdminId: job.createdByAdminId,
            },
            update: {
              mode: job.reportMode,
              sourceJobId: job.id,
              createdByAdminId: job.createdByAdminId,
            },
          });

          if (job.reportMode === ReportAccessMode.LINK_ONLY) {
            const plainToken = createPlainToken();
            await tx.assessmentReportShareToken.create({
              data: {
                tokenHash: hashToken(plainToken),
                assessmentId: job.assessmentId,
                userId: user.id,
                expiresAt: new Date(
                  now.getTime() +
                    1000 *
                      60 *
                      60 *
                      (job.linkTtlHours && job.linkTtlHours > 0 ? job.linkTtlHours : 168),
                ),
                sourceJobId: job.id,
              },
            });

            tokensForEmail.push({
              token: plainToken,
              email: user.email,
              firstName: user.firstName,
            });
          }
        }

        await tx.assessmentUnenrollJob.update({
          where: {
            id: job.id,
          },
          data: {
            status: UnenrollJobStatus.COMPLETED,
            executedAt: now,
            errorMessage: null,
          },
        });
      });

      if (job.notifyByEmail) {
        const resend = getResend();
        const baseUrl = shareBaseUrl();

        for (const item of tokensForEmail) {
          const reportUrl = `${baseUrl}/api/reports/shared/${encodeURIComponent(item.token)}`;
          const pdfUrl = `${baseUrl}/api/reports/shared/${encodeURIComponent(item.token)}/pdf`;

          await resend.emails.send({
            from: getEnv().EMAIL_FROM,
            to: item.email,
            subject: `Your assessment report access link: ${job.assessment.title}`,
            html: `<p>Hi ${item.firstName},</p>
<p>Your access to <strong>${job.assessment.title}</strong> has changed. You can still access your report with a temporary secure link.</p>
<p><a href="${reportUrl}">Open report</a></p>
<p><a href="${pdfUrl}">Download PDF</a></p>
<p>This link expires automatically.</p>`,
          });
        }
      }

      results.push({
        jobId: job.id,
        status: UnenrollJobStatus.COMPLETED,
        impactedUsers: impactedUsers.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.assessmentUnenrollJob.update({
        where: { id: job.id },
        data: {
          status: UnenrollJobStatus.FAILED,
          errorMessage: message,
        },
      });

      results.push({
        jobId: job.id,
        status: UnenrollJobStatus.FAILED,
        impactedUsers: 0,
        error: message,
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
}
