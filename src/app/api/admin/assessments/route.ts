import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { tenantId, title, questions } = (await req.json()) as {
    tenantId: string;
    title: string;
    questions: Array<{ prompt: string; trait: string; reverse?: boolean }>;
  };

  const assessment = await db.assessment.create({
    data: {
      tenantId,
      title,
      policy: {
        create: {
          showResultsToEmployee: true,
          resultReleaseDelayHours: 0,
          postSubmitMessage: "Thanks for completing your assessment.",
          leaderCanViewFullReport: true,
        },
      },
      questions: {
        create: questions.map((q, idx) => ({
          prompt: q.prompt,
          trait: q.trait,
          reverse: Boolean(q.reverse),
          sortOrder: idx,
        })),
      },
    },
    include: { questions: true, policy: true },
  });

  return NextResponse.json(assessment);
}
