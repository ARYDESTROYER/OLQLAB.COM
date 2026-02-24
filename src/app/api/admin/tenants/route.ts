import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1";

  let tenants: Array<{
    id: string;
    name: string;
    seatLimit: number;
    createdAt: Date;
    updatedAt: Date;
    type: "ORGANIZATION" | "SOLO";
    isArchived: boolean;
  }> = [];

  try {
    tenants = await db.tenant.findMany({
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
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const legacyTenants = await db.tenant.findMany({
      where: {
        ...(q
          ? {
              name: {
                contains: q,
                mode: "insensitive",
              },
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        seatLimit: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    tenants = legacyTenants.map((tenant) => ({
      ...tenant,
      type: "ORGANIZATION",
      isArchived: false,
    }));
  }

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

  let tenant;
  try {
    tenant = await db.tenant.create({
      data: {
        name: tenantName,
        type: type === "SOLO" ? "SOLO" : "ORGANIZATION",
        seatLimit: seatLimit && seatLimit > 0 ? seatLimit : 50,
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    tenant = await db.tenant.create({
      data: {
        name: tenantName,
        seatLimit: seatLimit && seatLimit > 0 ? seatLimit : 50,
      },
    });
  }

  return NextResponse.json(tenant, { status: 201 });
}
