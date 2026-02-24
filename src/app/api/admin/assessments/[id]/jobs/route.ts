import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isMissingTableError } from "@/lib/prisma-errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;

  let jobs: Array<Record<string, unknown>> = [];
  try {
    jobs = await db.assessmentUnenrollJob.findMany({
      where: {
        assessmentId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });
  } catch (error) {
    if (!isMissingTableError(error, "assessmentunenrolljob")) throw error;
    jobs = [];
  }

  return NextResponse.json({ jobs });
}
