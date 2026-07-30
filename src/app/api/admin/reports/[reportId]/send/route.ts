import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { sendPublishedReportEmail } from "@/lib/report-delivery";
import {
  canonicalizeReportNarrative,
  isReportNarrativeSizeAllowed,
  MAX_REPORT_NARRATIVE_REQUEST_BYTES,
  parseReportNarrative,
} from "@/lib/report-content";
import { recordAuditLog } from "@/lib/audit-log";
import { lockManualReportMutation } from "@/lib/manual-report-lock";
import { preflightReportPublicationPdf } from "@/lib/report-publication-preflight";
import {
  evaluateReportPublicationReadiness,
  evaluateReportRelease,
} from "@/lib/report-release";

const REDELIVERY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;
  const { reportId } = await params;

  const contentLength = Number(req.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REPORT_NARRATIVE_REQUEST_BYTES
  ) {
    return NextResponse.json(
      { error: "Report publication exceeds the 256 KiB narrative limit." },
      { status: 413 },
    );
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (
    !body ||
    (body.deliveryMethod !== "EMAIL_LINK" &&
      body.deliveryMethod !== "DASHBOARD_ONLY")
  ) {
    return NextResponse.json(
      { error: "deliveryMethod must be EMAIL_LINK or DASHBOARD_ONLY." },
      { status: 422 },
    );
  }
  const deliveryMethod = body.deliveryMethod;
  const redeliveryKey =
    typeof body.redeliveryKey === "string" ? body.redeliveryKey : undefined;
  if (redeliveryKey && !REDELIVERY_KEY_PATTERN.test(redeliveryKey)) {
    return NextResponse.json(
      { error: "redeliveryKey must be a UUID." },
      { status: 422 },
    );
  }

  let canonicalNarrative: string | undefined;
  if (body.narrativeJson !== undefined) {
    if (
      typeof body.narrativeJson !== "string" ||
      !isReportNarrativeSizeAllowed(body.narrativeJson)
    ) {
      return NextResponse.json(
        { error: "narrativeJson exceeds the 256 KiB limit." },
        { status: 413 },
      );
    }
    const parsed = parseReportNarrative(body.narrativeJson);
    if (!parsed) {
      return NextResponse.json(
        { error: "narrativeJson must contain a JSON object." },
        { status: 422 },
      );
    }
    canonicalNarrative = JSON.stringify(canonicalizeReportNarrative(parsed));
    if (!isReportNarrativeSizeAllowed(canonicalNarrative)) {
      return NextResponse.json(
        { error: "Canonical report content exceeds the 256 KiB limit." },
        { status: 413 },
      );
    }
  }

  const preflightReport = await db.report.findUnique({
    where: { id: reportId },
    select: {
      userId: true,
      narrativeJson: true,
      assessment: {
        select: {
          title: true,
          policy: { select: { reportWorkflow: true } },
        },
      },
    },
  });
  if (!preflightReport) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  const preflightParticipant = await db.user.findUnique({
    where: { id: preflightReport.userId },
    select: { firstName: true, lastName: true },
  });
  if (!preflightParticipant) {
    return NextResponse.json(
      { error: "Report participant not found." },
      { status: 404 },
    );
  }
  const preflightWorkflow =
    preflightReport.assessment.policy?.reportWorkflow || "AI_STANDARD";
  const preflightNarrative =
    canonicalNarrative || preflightReport.narrativeJson;
  const preflightParticipantName =
    `${preflightParticipant.firstName} ${preflightParticipant.lastName}`.trim() ||
    "Participant";
  const pdfPreflight = await preflightReportPublicationPdf({
    reportWorkflow: preflightWorkflow,
    narrativeJson: preflightNarrative,
    assessmentTitle: preflightReport.assessment.title,
    participantName: preflightParticipantName,
  });
  if (!pdfPreflight.ready) {
    return NextResponse.json(
      { error: pdfPreflight.message, code: pdfPreflight.code },
      { status: pdfPreflight.status },
    );
  }

  const mutation = await db.$transaction(
    async (tx) => {
      await lockManualReportMutation(tx, reportId);
      const report = await tx.report.findUnique({
        where: { id: reportId },
        include: {
          assessment: {
            select: {
              id: true,
              title: true,
              policy: {
                select: {
                  reportWorkflow: true,
                  showResultsToEmployee: true,
                  resultReleaseDelayHours: true,
                },
              },
            },
          },
          pdfAsset: { select: { id: true } },
        },
      });
      if (!report) {
        return { ok: false as const, status: 404, error: "Report not found." };
      }

      const [submittedSession, participant] = await Promise.all([
        tx.quizSession.findUnique({
          where: {
            assessmentId_userId: {
              assessmentId: report.assessmentId,
              userId: report.userId,
            },
          },
          select: { status: true, submittedAt: true },
        }),
        tx.user.findUnique({
          where: { id: report.userId },
          select: { tenantId: true, firstName: true, lastName: true },
        }),
      ]);
      if (!participant) {
        return {
          ok: false as const,
          status: 404,
          error: "Report participant not found.",
        };
      }

      const currentWorkflow =
        report.assessment.policy?.reportWorkflow || "AI_STANDARD";
      const currentParticipantName =
        `${participant.firstName} ${participant.lastName}`.trim() ||
        "Participant";
      if (
        currentWorkflow !== preflightWorkflow ||
        report.assessment.title !== preflightReport.assessment.title ||
        currentParticipantName !== preflightParticipantName ||
        (canonicalNarrative === undefined &&
          report.narrativeJson !== preflightNarrative)
      ) {
        return {
          ok: false as const,
          status: 409,
          error:
            "The report changed while its PDF was being validated. Review and publish again.",
          code: "REPORT_CHANGED",
        };
      }

      const reportWorkflow = currentWorkflow;
      const effectiveNarrative = canonicalNarrative || report.narrativeJson;
      const publicationDecision = evaluateReportPublicationReadiness({
        reportWorkflow,
        hasSubmittedSession: submittedSession?.status === "SUBMITTED",
        hasValidNarrative: Boolean(parseReportNarrative(effectiveNarrative)),
        hasManualPdf: Boolean(report.pdfAsset),
      });
      if (!publicationDecision.ready) {
        return {
          ok: false as const,
          status: 422,
          error: publicationDecision.message,
          code: publicationDecision.code,
        };
      }

      const contentChanged =
        canonicalNarrative !== undefined &&
        canonicalNarrative !== report.narrativeJson;
      const startsNewPublication =
        report.status !== "PUBLISHED" || contentChanged;
      const availableAt = startsNewPublication
        ? new Date()
        : report.availableAt || new Date();

      if (deliveryMethod === "EMAIL_LINK") {
        const releaseDecision = evaluateReportRelease({
          audience: "SHARED",
          report: {
            status: "PUBLISHED",
            availableAt,
            hasManualPdf: Boolean(report.pdfAsset),
          },
          policy: {
            reportWorkflow,
            showResultsToEmployee:
              report.assessment.policy?.showResultsToEmployee ?? true,
            resultReleaseDelayHours:
              report.assessment.policy?.resultReleaseDelayHours || 0,
          },
          submittedAt: submittedSession?.submittedAt || null,
        });
        if (!releaseDecision.ready) {
          return {
            ok: false as const,
            status: 409,
            error: `The secure report link cannot be emailed yet. ${releaseDecision.message}`,
            code: releaseDecision.code,
          };
        }
      }

      if (startsNewPublication) {
        await tx.assessmentReportShareToken.updateMany({
          where: { reportId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      const published = await tx.report.update({
        where: { id: reportId },
        data: {
          status: "PUBLISHED",
          availableAt,
          deliveryMethod,
          ...(canonicalNarrative !== undefined
            ? { narrativeJson: canonicalNarrative }
            : {}),
          ...(startsNewPublication
            ? { publicationGeneration: { increment: 1 } }
            : {}),
        },
      });
      await recordAuditLog(
        {
          tenantId: participant.tenantId,
          actorId: check.session.user.id,
          action: "REPORT_PUBLISHED",
          metadata: {
            reportId,
            assessmentId: report.assessmentId,
            userId: report.userId,
            deliveryMethod,
            contentUpdated: contentChanged,
            startsNewPublication,
            explicitRedelivery: Boolean(redeliveryKey),
          },
        },
        tx,
      );
      return {
        ok: true as const,
        report: published,
        assessmentId: report.assessmentId,
        userId: report.userId,
      };
    },
    { maxWait: 5_000, timeout: 15_000 },
  );

  if (!mutation.ok) {
    return NextResponse.json(
      {
        error: mutation.error,
        ...("code" in mutation ? { code: mutation.code } : {}),
        published: false,
      },
      {
        status: mutation.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (deliveryMethod === "EMAIL_LINK") {
    try {
      const delivered = await sendPublishedReportEmail({
        assessmentId: mutation.assessmentId,
        userId: mutation.userId,
        redeliveryKey,
      });
      if (!delivered) {
        return NextResponse.json(
          {
            error:
              "The report was published, but its secure link was no longer releasable when delivery was attempted. Review the release policy and retry notification.",
            published: true,
            report: mutation.report,
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
    } catch (error) {
      console.error("Failed to send report email:", error);
      return NextResponse.json(
        {
          error:
            "The report was published, but the email could not be delivered. Retry notification after checking email configuration.",
          published: true,
          report: mutation.report,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    { ok: true, report: mutation.report },
    { headers: { "Cache-Control": "no-store" } },
  );
}
