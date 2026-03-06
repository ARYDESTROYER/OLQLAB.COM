import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { sendPublishedReportEmail } from "@/lib/report-delivery";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { reportId } = await params;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const notifyNow = String(formData.get("notifyNow") || "false") === "true";
  const deliveryMethodRaw = String(formData.get("deliveryMethod") || "DASHBOARD_ONLY");
  const deliveryMethod =
    deliveryMethodRaw === "EMAIL_LINK" ? "EMAIL_LINK" : "DASHBOARD_ONLY";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
  }

  const fileName = file.name || "report.pdf";
  const mimeType = file.type || "application/pdf";
  if (mimeType !== "application/pdf" && !fileName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "PDF exceeds the 10 MB limit." },
      { status: 400 },
    );
  }

  const report = await db.report.findUnique({
    where: { id: reportId },
    include: {
      assessment: {
        select: {
          id: true,
          policy: {
            select: {
              reportWorkflow: true,
            },
          },
        },
      },
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  if (report.assessment.policy?.reportWorkflow !== "MANUAL_PDF_UPLOAD") {
    return NextResponse.json(
      { error: "PDF upload is only available for manual report workflow assessments." },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = Buffer.from(arrayBuffer);

  await db.reportPdfAsset.upsert({
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

  let updatedReport = report;
  if (notifyNow) {
    updatedReport = await db.report.update({
      where: { id: report.id },
      data: {
        status: "PUBLISHED",
        availableAt: new Date(),
        deliveryMethod,
      },
      include: {
        assessment: {
          select: {
            id: true,
            policy: {
              select: {
                reportWorkflow: true,
              },
            },
          },
        },
      },
    });

    if (deliveryMethod === "EMAIL_LINK") {
      try {
        await sendPublishedReportEmail({
          assessmentId: report.assessmentId,
          userId: report.userId,
        });
      } catch (error) {
        console.error("Failed to send manual report email:", error);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    notifyNow,
    report: {
      id: updatedReport.id,
      status: updatedReport.status,
      availableAt: updatedReport.availableAt,
      deliveryMethod: updatedReport.deliveryMethod,
    },
  });
}
