import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { sendPublishedReportEmail } from "@/lib/report-delivery";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { reportId } = await params;
  const body = await req.json().catch(() => null);

  if (!body || !body.deliveryMethod) {
    return NextResponse.json({ error: "Invalid body. deliveryMethod strictly required." }, { status: 400 });
  }

  const { narrativeJson, deliveryMethod } = body;
  const normalizedDeliveryMethod =
    deliveryMethod === "EMAIL_LINK" ? "EMAIL_LINK" : "DASHBOARD_ONLY";

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
      pdfAsset: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  if (
    report.assessment.policy?.reportWorkflow === "MANUAL_PDF_UPLOAD" &&
    !report.pdfAsset
  ) {
    return NextResponse.json(
      { error: "Please upload a PDF before publishing this manual report." },
      { status: 400 },
    );
  }

  const updateData: {
    status: "PUBLISHED";
    availableAt: Date;
    deliveryMethod: "DASHBOARD_ONLY" | "EMAIL_LINK";
    narrativeJson?: string;
  } = {
    status: "PUBLISHED",
    availableAt: new Date(),
    deliveryMethod: normalizedDeliveryMethod,
  };

  if (narrativeJson) {
    updateData.narrativeJson = narrativeJson;
  }

  const updated = await db.report.update({
    where: { id: reportId },
    data: updateData,
  });

  if (normalizedDeliveryMethod === "EMAIL_LINK") {
    try {
      await sendPublishedReportEmail({
        assessmentId: report.assessmentId,
        userId: report.userId,
      });
    } catch (error) {
      console.error("Failed to send report email:", error);
    }
  }

  return NextResponse.json({ ok: true, report: updated });
}
