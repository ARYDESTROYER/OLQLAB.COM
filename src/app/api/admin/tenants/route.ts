import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = await req.json();
  const { name, seatLimit } = body as { name: string; seatLimit: number };

  const tenant = await db.tenant.create({
    data: { name, seatLimit },
  });

  return NextResponse.json(tenant);
}
