import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { EmailDeliveryError, sendEmailOrThrow } from "@/lib/resend";
import {
  issueReportShareToken,
  revokeReportShareToken,
} from "@/lib/unenroll-jobs";
import { buildScannerResistantReportLinkHtml } from "@/lib/report-share-grant";
import {
  buildPublishedReportDeliveryIdempotencyKey,
  buildPublishedReportRedeliveryIdempotencyKey,
} from "@/lib/report-delivery-idempotency";

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveBaseUrl() {
  const env = getEnv();
  return env.REPORT_SHARE_BASE_URL || env.NEXTAUTH_URL || "http://localhost:3000";
}

function formatDurationMs(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "Not available";
  const totalMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} hr ${minutes} min`;
}

export function isDefinitiveReportEmailRejection(error: unknown) {
  return (
    error instanceof EmailDeliveryError &&
    error.providerCode !== "missing_delivery_id"
  );
}

export async function sendPublishedReportEmail(input: {
  assessmentId: string;
  userId: string;
  ttlHours?: number;
  redeliveryKey?: string;
}) {
  const [user, report] = await Promise.all([
    db.user.findUnique({
      where: { id: input.userId },
      select: {
        firstName: true,
        email: true,
      },
    }),
    db.report.findUnique({
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
        pdfAsset: {
          select: {
            id: true,
            pdfBytes: true,
          },
        },
        assessment: {
          select: {
            title: true,
            policy: { select: { reportWorkflow: true } },
          },
        },
      },
    }),
  ]);

  if (!user || !report) return false;

  const publicationKey = buildPublishedReportDeliveryIdempotencyKey({
    reportId: report.id,
    publicationGeneration: report.publicationGeneration,
    reportWorkflow: report.assessment.policy?.reportWorkflow || "AI_STANDARD",
    narrativeJson: report.narrativeJson,
    manualPdf: report.pdfAsset,
  });
  const deliveryKey = input.redeliveryKey
    ? buildPublishedReportRedeliveryIdempotencyKey({
        publicationVersionKey: publicationKey,
        redeliveryKey: input.redeliveryKey,
      })
    : publicationKey;

  const tokenData = await issueReportShareToken({
    assessmentId: input.assessmentId,
    userId: input.userId,
    ttlHours: input.ttlHours ?? 168,
    idempotencyKey: deliveryKey,
    expectedPublicationVersionKey: publicationKey,
  });
  if (!tokenData) return false;

  const env = getEnv();
  const baseUrl = resolveBaseUrl();
  const reportLink = buildScannerResistantReportLinkHtml({
    baseUrl,
    token: tokenData.token,
  });

  try {
    await sendEmailOrThrow(
      {
        from: env.EMAIL_FROM,
        to: user.email,
        subject: `Your assessment report is ready: ${report.assessment.title}`,
        html: `<p>Hi ${escapeHtml(user.firstName)},</p>
<p>Your report for <strong>${escapeHtml(report.assessment.title)}</strong> has been published and is now available.</p>
${reportLink}
<p>This secure link expires on ${escapeHtml(tokenData.expiresAt.toLocaleString())}. No sign-in is required to view your report.</p>`,
      },
      {
        idempotencyKey: deliveryKey,
      },
    );
  } catch (error) {
    if (isDefinitiveReportEmailRejection(error)) {
      await revokeReportShareToken(tokenData.token).catch((revokeError) => {
        console.error("Failed to revoke a rejected report link.", revokeError);
      });
    }
    throw error;
  }

  return true;
}

export async function sendManualSubmissionAlertEmails(input: {
  assessmentId: string;
  userId: string;
  startedAt: Date | null;
  submittedAt: Date;
}) {
  const assessment = await db.assessment.findUnique({
    where: { id: input.assessmentId },
    select: {
      id: true,
      title: true,
      policy: {
        select: {
          submissionAlertAdminIds: true,
          reportWorkflow: true,
        },
      },
    },
  });

  if (
    !assessment ||
    assessment.policy?.reportWorkflow !== "MANUAL_PDF_UPLOAD" ||
    !assessment.policy.submissionAlertAdminIds.length
  ) {
    return;
  }

  const participant = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      tenant: {
        select: {
          name: true,
          type: true,
        },
      },
    },
  });
  if (!participant) return;

  const adminRecipients = await db.user.findMany({
    where: {
      id: { in: assessment.policy.submissionAlertAdminIds },
      role: "ADMIN",
    },
    select: {
      id: true,
      firstName: true,
      email: true,
    },
  });
  if (!adminRecipients.length) return;

  const orgLabel =
    participant.tenant?.type === "ORGANIZATION" && participant.tenant?.name
      ? ` from ${participant.tenant.name}`
      : "";
  const participantName =
    `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || "Participant";
  const durationMs =
    input.startedAt && input.submittedAt
      ? input.submittedAt.getTime() - input.startedAt.getTime()
      : NaN;
  const duration = formatDurationMs(durationMs);
  const completedAt = input.submittedAt.toLocaleString();
  const baseUrl = resolveBaseUrl();
  const reviewUrl = `${baseUrl}/admin/assessments/${assessment.id}/participants/${participant.id}/responses`;

  const env = getEnv();

  await Promise.all(
    adminRecipients.map((admin) =>
      sendEmailOrThrow({
        from: env.EMAIL_FROM,
        to: admin.email,
        subject: `${participantName} completed ${assessment.title}`,
        html: `<p>Hey ${escapeHtml(admin.firstName || "Admin")},</p>
<p>${escapeHtml(participantName)}${escapeHtml(orgLabel)} has completed <strong>${escapeHtml(assessment.title)}</strong> on <strong>${escapeHtml(completedAt)}</strong> within <strong>${escapeHtml(duration)}</strong>.</p>
<p>Kindly review their inputs and upload the report in the admin center.</p>
<p><a href="${reviewUrl}">Review participant inputs</a></p>`,
      }, {
        idempotencyKey: `manual-submission:${input.assessmentId}:${input.userId}:${input.submittedAt.toISOString()}:${admin.id}`,
      }),
    ),
  );
}
