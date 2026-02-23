import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = await req.json();

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
          },
          update: {
            showResultsToEmployee: Boolean(body.showResultsToEmployee),
            resultReleaseDelayHours: Number(body.resultReleaseDelayHours || 0),
            postSubmitMessage: body.postSubmitMessage || "Submitted successfully.",
            leaderCanViewFullReport: Boolean(body.leaderCanViewFullReport),
          },
        },
      },
    },
    include: { policy: true },
  });

  return NextResponse.json(updated);
}
