import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { sendPublishedReportEmail } from "@/lib/report-delivery";
import { buildManualPdfDeliveryFailure } from "@/lib/manual-report-delivery";
import { lockManualReportMutation } from "@/lib/manual-report-lock";
import { archiveCurrentAttempt } from "@/lib/report-archive";
import { recordAuditLog } from "@/lib/audit-log";
import {
  isReportPdfSizeAllowed,
  isStructurallyValidPdf,
  MAX_REPORT_PDF_MULTIPART_BYTES,
  safeReportPdfFileName,
} from "@/lib/report-pdf-upload";

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
    contentLength > MAX_REPORT_PDF_MULTIPART_BYTES
  ) {
    return NextResponse.json(
      { error: "PDF upload request exceeds the 4 MB file limit." },
      { status: 413 },
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  const file = formData.get("file");
  const notifyNow = String(formData.get("notifyNow") || "false") === "true";
  const deliveryMethodRaw = String(formData.get("deliveryMethod") || "DASHBOARD_ONLY");
  if (deliveryMethodRaw !== "EMAIL_LINK" && deliveryMethodRaw !== "DASHBOARD_ONLY") {
    return NextResponse.json({ error: "Invalid delivery method." }, { status: 422 });
  }
  const deliveryMethod = deliveryMethodRaw;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Uploaded file is empty." }, { status: 422 });
  }
  if (!isReportPdfSizeAllowed(file.size)) {
    return NextResponse.json({ error: "PDF exceeds the 4 MB limit." }, { status: 413 });
  }
  const fileName = safeReportPdfFileName(file.name || "report.pdf");
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 422 });
  }

  const pdfBytes = Buffer.from(await file.arrayBuffer());
  if (!(await isStructurallyValidPdf(pdfBytes))) {
    return NextResponse.json(
      { error: "The uploaded file is not a valid, readable PDF." },
      { status: 422 },
    );
  }

  const mutation = await db.$transaction(
    async (tx) => {
      await lockManualReportMutation(tx, reportId);
      const report = await tx.report.findUnique({
        where: { id: reportId },
        include: {
          assessment: {
            select: { id: true, policy: { select: { reportWorkflow: true } } },
          },
          pdfAsset: { select: { id: true } },
        },
      });
      if (!report) {
        return { ok: false as const, status: 404 as const, error: "Report not found." };
      }
      if (report.assessment.policy?.reportWorkflow !== "MANUAL_PDF_UPLOAD") {
        return {
          ok: false as const,
          status: 422 as const,
          error: "PDF upload is only available for manual report workflow assessments.",
        };
      }
      const participant = await tx.user.findUnique({
        where: { id: report.userId },
        select: { tenantId: true },
      });
      if (!participant) {
        return {
          ok: false as const,
          status: 404 as const,
          error: "Report participant not found.",
        };
      }
      if (notifyNow) {
        const submittedSession = await tx.quizSession.findUnique({
          where: {
            assessmentId_userId: {
              assessmentId: report.assessmentId,
              userId: report.userId,
            },
          },
          select: { status: true },
        });
        if (submittedSession?.status !== "SUBMITTED") {
          return {
            ok: false as const,
            status: 422 as const,
            error: "Only reports for submitted assessments can be published.",
          };
        }
      }

      if (report.pdfAsset) {
        await archiveCurrentAttempt(tx, {
          assessmentId: report.assessmentId,
          userId: report.userId,
          archivedById: check.session.user.id,
          reason: "manual_pdf_replaced",
        });
      }
      await tx.reportPdfAsset.upsert({
        where: { reportId: report.id },
        create: {
          reportId: report.id,
          fileName,
          mimeType: "application/pdf",
          sizeBytes: file.size,
          pdfBytes,
          uploadedByAdminId: check.session.user.id,
        },
        update: {
          fileName,
          mimeType: "application/pdf",
          sizeBytes: file.size,
          pdfBytes,
          uploadedByAdminId: check.session.user.id,
        },
      });
      await tx.assessmentReportShareToken.updateMany({
        where: { reportId: report.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const updatedReport = await tx.report.update({
        where: { id: report.id },
        data: notifyNow
          ? {
              status: "PUBLISHED",
              publicationGeneration: { increment: 1 },
              availableAt: new Date(),
              deliveryMethod,
            }
          : { status: "DRAFT", availableAt: null, deliveryMethod: null },
      });
      await recordAuditLog(
        {
          tenantId: participant.tenantId,
          actorId: check.session.user.id,
          action: report.pdfAsset ? "REPORT_PDF_REPLACED" : "REPORT_PDF_UPLOADED",
          metadata: {
            reportId,
            assessmentId: report.assessmentId,
            userId: report.userId,
            fileName,
            sizeBytes: file.size,
            notifyNow,
            deliveryMethod: notifyNow ? deliveryMethod : null,
          },
        },
        tx,
      );
      return {
        ok: true as const,
        updatedReport,
        assessmentId: report.assessmentId,
        userId: report.userId,
      };
    },
    { maxWait: 5_000, timeout: 30_000 },
  );
  if (!mutation.ok) {
    return NextResponse.json(
      { error: mutation.error },
      { status: mutation.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { updatedReport } = mutation;
  const reportState = {
    id: updatedReport.id,
    status: updatedReport.status,
    availableAt: updatedReport.availableAt,
    deliveryMethod: updatedReport.deliveryMethod,
  };

  if (notifyNow && deliveryMethod === "EMAIL_LINK") {
    try {
      const delivered = await sendPublishedReportEmail({
        assessmentId: mutation.assessmentId,
        userId: mutation.userId,
      });
      if (!delivered) {
        const failure = buildManualPdfDeliveryFailure(
          "LINK_UNAVAILABLE",
          reportState,
        );
        return NextResponse.json(failure.body, {
          status: failure.status,
          headers: { "Cache-Control": "no-store" },
        });
      }
    } catch (error) {
      console.error("Failed to send manual report email:", error);
      const failure = buildManualPdfDeliveryFailure("EMAIL_FAILED", reportState);
      return NextResponse.json(failure.body, {
        status: failure.status,
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,
      notifyNow,
      report: reportState,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;
  const { reportId } = await params;

  const result = await db.$transaction(
    async (tx) => {
      await lockManualReportMutation(tx, reportId);
      const report = await tx.report.findUnique({
        where: { id: reportId },
        include: {
          assessment: {
            select: { id: true, policy: { select: { reportWorkflow: true } } },
          },
          pdfAsset: { select: { id: true } },
        },
      });
      if (!report) {
        return { ok: false as const, status: 404 as const, error: "Report not found." };
      }
      if (report.assessment.policy?.reportWorkflow !== "MANUAL_PDF_UPLOAD") {
        return {
          ok: false as const,
          status: 422 as const,
          error: "PDF removal is only available for manual report workflow assessments.",
        };
      }
      const participant = await tx.user.findUnique({
        where: { id: report.userId },
        select: { tenantId: true },
      });
      if (!participant) {
        return {
          ok: false as const,
          status: 404 as const,
          error: "Report participant not found.",
        };
      }

      if (report.pdfAsset) {
        await archiveCurrentAttempt(tx, {
          assessmentId: report.assessmentId,
          userId: report.userId,
          archivedById: check.session.user.id,
          reason: "manual_pdf_removed",
        });
      }
      const deleted = await tx.reportPdfAsset.deleteMany({ where: { reportId } });
      await tx.assessmentReportShareToken.updateMany({
        where: { reportId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const updated = await tx.report.update({
        where: { id: reportId },
        data: { status: "DRAFT", availableAt: null, deliveryMethod: null },
      });
      await recordAuditLog(
        {
          tenantId: participant.tenantId,
          actorId: check.session.user.id,
          action: "REPORT_PDF_REMOVED",
          metadata: {
            reportId,
            assessmentId: report.assessmentId,
            userId: report.userId,
            removed: deleted.count > 0,
          },
        },
        tx,
      );
      return { ok: true as const, deleted, updated };
    },
    { maxWait: 5_000, timeout: 30_000 },
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      deletedPdf: result.deleted.count > 0,
      report: {
        id: result.updated.id,
        status: result.updated.status,
        availableAt: result.updated.availableAt,
        deliveryMethod: result.updated.deliveryMethod,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
