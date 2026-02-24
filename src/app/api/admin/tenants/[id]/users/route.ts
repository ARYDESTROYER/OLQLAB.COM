import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: tenantId } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim();

  let tenant: {
    id: string;
    name: string;
    type: string;
    seatLimit: number;
    isArchived: boolean;
  } | null = null;
  try {
    tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        seatLimit: true,
        isArchived: true,
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    const legacyTenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        seatLimit: true,
      },
    });
    tenant = legacyTenant
      ? {
          ...legacyTenant,
          type: "ORGANIZATION",
          isArchived: false,
        }
      : null;
  }

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const users = await db.user.findMany({
    where: {
      tenantId,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      manager: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({
    tenant,
    users,
  });
}
