import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  return NextResponse.json({ status: "ok" }, { headers: noStoreHeaders });
}
