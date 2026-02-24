import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

function authorized(req: NextRequest) {
  const secret = getEnv().INTERNAL_JOB_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-job-secret") || "";
  return header.length > 0 && header === secret;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const execution = await runDueUnenrollJobs();
  return NextResponse.json({ ok: true, ...execution });
}
