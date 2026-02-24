import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/api-auth";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

function hasSecret(req: NextRequest) {
  const secret = getEnv().INTERNAL_JOB_SECRET;
  if (!secret) return false;
  return req.headers.get("x-job-secret") === secret;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const secretAuth = hasSecret(req);
  if (!secretAuth) {
    const check = await requireAdmin();
    if ("error" in check) return check.error;
  }

  const { id } = await params;
  const execution = await runDueUnenrollJobs({ forceJobId: id });
  return NextResponse.json({
    ok: true,
    ...execution,
  });
}
