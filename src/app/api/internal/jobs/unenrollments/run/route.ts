import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  bearerAuthorizationMatches,
  constantTimeSecretMatches,
} from "@/lib/internal-job-auth";
import { drainDueUnenrollJobs } from "@/lib/unenroll-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function hasCronAuthorization(req: Pick<NextRequest, "headers">) {
  return bearerAuthorizationMatches(
    req.headers.get("authorization"),
    getEnv().CRON_SECRET,
  );
}

function hasLegacyInternalAuthorization(req: Pick<NextRequest, "headers">) {
  return constantTimeSecretMatches(
    req.headers.get("x-job-secret") || "",
    getEnv().INTERNAL_JOB_SECRET,
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function execute(trigger: "cron" | "internal") {
  // Keep a 20-second platform margin for response serialization and transient
  // provider latency. The worker checkpoints between recipients.
  const execution = await drainDueUnenrollJobs({
    trigger,
    maxDurationMs: 40_000,
  });
  const failed = execution.results.filter((result) => result.status === "FAILED");
  return json(
    { ok: failed.length === 0, failedJobs: failed.length, ...execution },
    failed.length > 0 ? 502 : 200,
  );
}

export async function GET(req: NextRequest) {
  if (!hasCronAuthorization(req)) return json({ error: "Forbidden" }, 403);
  return execute("cron");
}

export async function POST(req: NextRequest) {
  if (!hasCronAuthorization(req) && !hasLegacyInternalAuthorization(req)) {
    return json({ error: "Forbidden" }, 403);
  }
  return execute("internal");
}
