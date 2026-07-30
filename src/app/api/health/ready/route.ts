import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    await withTimeout(db.$queryRaw`SELECT 1`, 3_000);
    return NextResponse.json(
      { status: "ready", checks: { database: "ok" } },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Readiness database check failed.", error);
    return NextResponse.json(
      { status: "not_ready", checks: { database: "failed" } },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
