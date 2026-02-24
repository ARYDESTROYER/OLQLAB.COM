import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1";

  const tenants = await db.tenant.findMany({
    where: {
      ...(q
        ? {
            name: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
      ...(includeArchived ? {} : { isArchived: false }),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ tenants });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = await req.json();
  const { name, seatLimit, type } = body as {
    name?: string;
    seatLimit?: number;
    type?: "ORGANIZATION" | "SOLO";
  };

  const tenantName = name?.trim();
  if (!tenantName) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const tenant = await db.tenant.create({
    data: {
      name: tenantName,
      type: type === "SOLO" ? "SOLO" : "ORGANIZATION",
      seatLimit: seatLimit && seatLimit > 0 ? seatLimit : 50,
    },
  });

  return NextResponse.json(tenant, { status: 201 });
}
