import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

const validWorkflows = new Set(["AI_STANDARD", "MANUAL_PDF_UPLOAD"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const requestedWorkflow =
    typeof body.reportWorkflow === "string" && validWorkflows.has(body.reportWorkflow)
      ? body.reportWorkflow
      : "AI_STANDARD";

  const requestedAlertAdminIds = Array.isArray(body.submissionAlertAdminIds)
    ? body.submissionAlertAdminIds
        .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  const validAlertAdminIds = requestedAlertAdminIds.length
    ? (
        await db.user.findMany({
          where: {
            id: { in: requestedAlertAdminIds },
            role: "ADMIN",
          },
          select: { id: true },
        })
      ).map((row) => row.id)
    : [];

  const updated = await db.assessment.update({
    where: { id },
    data: {
      isPublished: Boolean(body.isPublished),
      policy: {
        upsert: {
          create: {
            showResultsToEmployee: Boolean(body.showResultsToEmployee),
            resultReleaseDelayHours: Number(body.resultReleaseDelayHours || 0),
            postSubmitMessage: body.postSubmitMessage || "Submitted successfully.",
            leaderCanViewFullReport: Boolean(body.leaderCanViewFullReport),
            reportWorkflow: requestedWorkflow,
            randomizeQuestionOrder: Boolean(body.randomizeQuestionOrder),
            submissionAlertAdminIds: validAlertAdminIds,
          },
          update: {
            showResultsToEmployee: Boolean(body.showResultsToEmployee),
            resultReleaseDelayHours: Number(body.resultReleaseDelayHours || 0),
            postSubmitMessage: body.postSubmitMessage || "Submitted successfully.",
            leaderCanViewFullReport: Boolean(body.leaderCanViewFullReport),
            reportWorkflow: requestedWorkflow,
            randomizeQuestionOrder: Boolean(body.randomizeQuestionOrder),
            submissionAlertAdminIds: validAlertAdminIds,
          },
        },
      },
    },
    include: { policy: true },
  });

  return NextResponse.json(updated);
}
