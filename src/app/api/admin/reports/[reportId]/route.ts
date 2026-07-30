import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  canonicalizeReportNarrative,
  isReportNarrativeSizeAllowed,
  MAX_REPORT_NARRATIVE_REQUEST_BYTES,
  parseReportNarrative,
} from "@/lib/report-content";
import { recordAuditLog } from "@/lib/audit-log";
import { evaluateReportPublicationReadiness } from "@/lib/report-release";
import { lockManualReportMutation } from "@/lib/manual-report-lock";
import { preflightReportPublicationPdf } from "@/lib/report-publication-preflight";

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export async function PATCH(
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
      { error: "Report update exceeds the 256 KiB narrative limit." },
      { status: 413 },
    );
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updateData: Prisma.ReportUpdateInput = {};
  let canonicalNarrative: string | undefined;
  if (hasOwn(body, "narrativeJson")) {
    if (
      typeof body.narrativeJson !== "string" ||
      !isReportNarrativeSizeAllowed(body.narrativeJson)
    ) {
      return NextResponse.json(
        { error: "narrativeJson must be valid report JSON under 256 KiB." },
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
    updateData.narrativeJson = canonicalNarrative;
  }

  if (hasOwn(body, "status")) {
    if (body.status !== "DRAFT" && body.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Invalid report status." }, { status: 422 });
    }
    updateData.status = body.status;
  }
  if (hasOwn(body, "availableAt")) {
    if (body.availableAt === null) {
      updateData.availableAt = null;
    } else if (typeof body.availableAt === "string") {
      const availableAt = new Date(body.availableAt);
      if (Number.isNaN(availableAt.getTime())) {
        return NextResponse.json({ error: "Invalid availableAt value." }, { status: 422 });
      }
      updateData.availableAt = availableAt;
    } else {
      return NextResponse.json({ error: "Invalid availableAt value." }, { status: 422 });
    }
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No report changes were supplied." }, { status: 422 });
  }

  let publicationPreflight: {
    workflow: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
    narrativeJson: string;
    assessmentTitle: string;
    participantName: string;
  } | null = null;
  if (updateData.status === "PUBLISHED") {
    const snapshot = await db.report.findUnique({
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
    if (!snapshot) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }
    const snapshotParticipant = await db.user.findUnique({
      where: { id: snapshot.userId },
      select: { firstName: true, lastName: true },
    });
    if (!snapshotParticipant) {
      return NextResponse.json(
        { error: "Report participant not found." },
        { status: 404 },
      );
    }
    publicationPreflight = {
      workflow: snapshot.assessment.policy?.reportWorkflow || "AI_STANDARD",
      narrativeJson: canonicalNarrative || snapshot.narrativeJson,
      assessmentTitle: snapshot.assessment.title,
      participantName:
        `${snapshotParticipant.firstName} ${snapshotParticipant.lastName}`.trim() ||
        "Participant",
    };
    const pdfPreflight = await preflightReportPublicationPdf({
      reportWorkflow: publicationPreflight.workflow,
      narrativeJson: publicationPreflight.narrativeJson,
      assessmentTitle: publicationPreflight.assessmentTitle,
      participantName: publicationPreflight.participantName,
    });
    if (!pdfPreflight.ready) {
      return NextResponse.json(
        { error: pdfPreflight.message, code: pdfPreflight.code },
        { status: pdfPreflight.status },
      );
    }
  }

  const result = await db.$transaction(async (tx) => {
    await lockManualReportMutation(tx, reportId);
    const existing = await tx.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        userId: true,
        assessmentId: true,
        narrativeJson: true,
        availableAt: true,
        assessment: {
          select: {
            title: true,
            policy: { select: { reportWorkflow: true } },
          },
        },
        pdfAsset: { select: { id: true } },
      },
    });
    if (!existing) {
      return { ok: false as const, status: 404, error: "Report not found." };
    }

    const contentChanged =
      canonicalNarrative !== undefined &&
      canonicalNarrative !== existing.narrativeJson;
    const unpublishedForContentChange =
      contentChanged &&
      existing.status === "PUBLISHED" &&
      !hasOwn(body, "status");
    if (unpublishedForContentChange || body.status === "DRAFT") {
      updateData.status = "DRAFT";
      updateData.availableAt = null;
      updateData.deliveryMethod = null;
    }

    if (updateData.status === "PUBLISHED") {
      const submittedSession = await tx.quizSession.findUnique({
        where: {
          assessmentId_userId: {
            assessmentId: existing.assessmentId,
            userId: existing.userId,
          },
        },
        select: { status: true },
      });
      const publicationDecision = evaluateReportPublicationReadiness({
        reportWorkflow:
          existing.assessment.policy?.reportWorkflow || "AI_STANDARD",
        hasSubmittedSession: submittedSession?.status === "SUBMITTED",
        hasValidNarrative: Boolean(
          parseReportNarrative(canonicalNarrative || existing.narrativeJson),
        ),
        hasManualPdf: Boolean(existing.pdfAsset),
      });
      if (!publicationDecision.ready) {
        return {
          ok: false as const,
          status: 422,
          error: publicationDecision.message,
          code: publicationDecision.code,
        };
      }
      if (!hasOwn(body, "availableAt")) {
        updateData.availableAt = existing.availableAt || new Date();
      }
      if (existing.status !== "PUBLISHED" || contentChanged) {
        updateData.publicationGeneration = { increment: 1 };
      }
    }

    const participant = await tx.user.findUnique({
      where: { id: existing.userId },
      select: { tenantId: true, firstName: true, lastName: true },
    });
    if (!participant) {
      return {
        ok: false as const,
        status: 404,
        error: "Report participant not found.",
      };
    }
    if (publicationPreflight) {
      const currentWorkflow =
        existing.assessment.policy?.reportWorkflow || "AI_STANDARD";
      const currentParticipantName =
        `${participant.firstName} ${participant.lastName}`.trim() ||
        "Participant";
      if (
        currentWorkflow !== publicationPreflight.workflow ||
        existing.assessment.title !== publicationPreflight.assessmentTitle ||
        currentParticipantName !== publicationPreflight.participantName ||
        (canonicalNarrative === undefined &&
          existing.narrativeJson !== publicationPreflight.narrativeJson)
      ) {
        return {
          ok: false as const,
          status: 409,
          error:
            "The report changed while its PDF was being validated. Review and publish again.",
          code: "REPORT_CHANGED",
        };
      }
    }

    if (contentChanged || updateData.status === "DRAFT") {
      await tx.assessmentReportShareToken.updateMany({
        where: { reportId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    const updated = await tx.report.update({
      where: { id: reportId },
      data: updateData,
    });
    await recordAuditLog(
      {
        tenantId: participant.tenantId,
        actorId: check.session.user.id,
        action:
          existing.status !== updated.status
            ? updated.status === "PUBLISHED"
              ? "REPORT_PUBLISHED"
              : "REPORT_UNPUBLISHED"
            : "REPORT_CONTENT_UPDATED",
        metadata: {
          reportId,
          statusBefore: existing.status,
          statusAfter: updated.status,
          contentChanged,
          changedFields: Object.keys(body).sort(),
        },
      },
      tx,
    );
    return { ok: true as const, report: updated, unpublishedForContentChange };
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json({
    ok: true,
    report: result.report,
    unpublishedForContentChange: result.unpublishedForContentChange,
  });
}
