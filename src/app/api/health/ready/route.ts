import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { parseRuntimeEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Readiness check timed out.")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export async function GET() {
  try {
    parseRuntimeEnv(process.env);
  } catch (error) {
    const invalidKeys =
      error instanceof ZodError
        ? error.issues.map((issue) => issue.path.join(".") || "environment")
        : ["environment"];
    console.error("Readiness runtime configuration check failed.", { invalidKeys });
    return NextResponse.json(
      {
        status: "not_ready",
        checks: {
          runtimeConfiguration: "failed",
          database: "unknown",
          authRateLimitSchema: "unknown",
        },
      },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    await withTimeout(db.$queryRaw`SELECT 1`, 3_000);
  } catch (error) {
    console.error("Readiness database check failed.", error);
    return NextResponse.json(
      {
        status: "not_ready",
        checks: {
          runtimeConfiguration: "ok",
          database: "failed",
          authRateLimitSchema: "unknown",
        },
      },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    await withTimeout(
      db.$queryRaw`
        SELECT "key", "count", "resetAt", "updatedAt"
        FROM "AuthRateLimitBucket"
        LIMIT 0
      `,
      3_000,
    );
  } catch (error) {
    console.error("Readiness authentication schema check failed.", error);
    return NextResponse.json(
      {
        status: "not_ready",
        checks: {
          runtimeConfiguration: "ok",
          database: "ok",
          authRateLimitSchema: "failed",
        },
      },
      { status: 503, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(
    {
      status: "ready",
      checks: {
        runtimeConfiguration: "ok",
        database: "ok",
        authRateLimitSchema: "ok",
      },
    },
    { headers: noStoreHeaders },
  );
}
