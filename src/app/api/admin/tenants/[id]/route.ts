import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

type TenantPatch = {
  name?: string;
  seatLimit?: number;
  isArchived?: boolean;
  type?: "ORGANIZATION" | "SOLO";
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as TenantPatch | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let updated;
  try {
    updated = await db.tenant.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        seatLimit: body.seatLimit && body.seatLimit > 0 ? body.seatLimit : undefined,
        isArchived: typeof body.isArchived === "boolean" ? body.isArchived : undefined,
        type: body.type,
      },
      include: {
        _count: {
          select: {
            users: true,
            seats: true,
            tenantEnrollments: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    updated = await db.tenant.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        seatLimit: body.seatLimit && body.seatLimit > 0 ? body.seatLimit : undefined,
      },
      include: {
        _count: {
          select: {
            users: true,
            seats: true,
          },
        },
      },
    });
  }

  return NextResponse.json(updated);
}
