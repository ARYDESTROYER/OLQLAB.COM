import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getResend } from "@/lib/resend";
import { issueReportShareToken } from "@/lib/unenroll-jobs";

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

export async function sendPublishedReportEmail(input: {
  assessmentId: string;
  userId: string;
  ttlHours?: number;
}) {
  const [user, assessment] = await Promise.all([
    db.user.findUnique({
      where: { id: input.userId },
      select: {
        firstName: true,
        email: true,
      },
    }),
    db.assessment.findUnique({
      where: { id: input.assessmentId },
      select: {
        title: true,
      },
    }),
  ]);

  if (!user || !assessment) return false;

  const tokenData = await issueReportShareToken({
    assessmentId: input.assessmentId,
    userId: input.userId,
    ttlHours: input.ttlHours ?? 168,
  });
  if (!tokenData) return false;

  const env = getEnv();
  const baseUrl = resolveBaseUrl();
  const reportUrl = `${baseUrl}/reports/shared/${encodeURIComponent(tokenData.token)}`;
  const pdfUrl = `${baseUrl}/api/reports/shared/${encodeURIComponent(tokenData.token)}/pdf`;

  const resend = getResend();
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: user.email,
    subject: `Your assessment report is ready: ${assessment.title}`,
    html: `<p>Hi ${user.firstName},</p>
<p>Your report for <strong>${assessment.title}</strong> has been published and is now available.</p>
<p><a href="${reportUrl}">View your report online</a></p>
<p><a href="${pdfUrl}">Download PDF version</a></p>
<p>This secure link will expire in 7 days. No sign-in is required to view your report.</p>`,
  });

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

  const resend = getResend();
  const env = getEnv();

  await Promise.all(
    adminRecipients.map((admin) =>
      resend.emails.send({
        from: env.EMAIL_FROM,
        to: admin.email,
        subject: `${participantName} completed ${assessment.title}`,
        html: `<p>Hey ${admin.firstName || "Admin"},</p>
<p>${participantName}${orgLabel} has completed <strong>${assessment.title}</strong> on <strong>${completedAt}</strong> within <strong>${duration}</strong>.</p>
<p>Kindly review their inputs and upload the report in the admin center.</p>
<p><a href="${reviewUrl}">Review participant inputs</a></p>`,
      }),
    ),
  );
}
