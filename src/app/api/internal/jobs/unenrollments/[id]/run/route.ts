import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/api-auth";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";
import { constantTimeSecretMatches } from "@/lib/internal-job-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function hasSecret(req: NextRequest) {
  const secret = getEnv().INTERNAL_JOB_SECRET;
  const provided = req.headers.get("x-job-secret") || "";
  return constantTimeSecretMatches(provided, secret);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const secretAuth = hasSecret(req);
  let actorId: string | null = null;
  if (!secretAuth) {
    const check = await requireAdmin();
    if ("error" in check) return check.error;
    actorId = check.session.user.id;
  }

  const { id } = await params;
  const deadlineAtMs = Date.now() + 40_000;
  const execution = await runDueUnenrollJobs({
    forceJobId: id,
    executionActorId: actorId,
    trigger: secretAuth ? "internal" : "admin",
    deadlineAtMs,
  });
  const failed = execution.results.filter((result) => result.status === "FAILED");
  return NextResponse.json({
    ok: failed.length === 0,
    failedJobs: failed.length,
    ...execution,
  }, {
    status: failed.length > 0 ? 502 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
