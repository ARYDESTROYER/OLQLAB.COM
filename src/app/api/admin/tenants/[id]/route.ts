import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-log";
import { Prisma } from "@prisma/client";

const MAX_ORGANISATION_NAME_LENGTH = 160;
const MAX_SEAT_LIMIT = 100_000;

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
  if (
    body.name !== undefined &&
    (!body.name.trim() || body.name.trim().length > MAX_ORGANISATION_NAME_LENGTH)
  ) {
    return NextResponse.json(
      { error: `name must be between 1 and ${MAX_ORGANISATION_NAME_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (
    body.seatLimit !== undefined &&
    (!Number.isInteger(body.seatLimit) ||
      body.seatLimit < 1 ||
      body.seatLimit > MAX_SEAT_LIMIT)
  ) {
    return NextResponse.json(
      { error: `seatLimit must be a whole number between 1 and ${MAX_SEAT_LIMIT}.` },
      { status: 400 },
    );
  }

  try {
    const updated = await db.$transaction(
      async (tx) => {
        const current = await tx.tenant.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          type: true,
          isArchived: true,
          seatLimit: true,
        },
      });
        if (!current) return null;

        if (body.type && body.type !== current.type) {
          throw new Error("TENANT_TYPE_IMMUTABLE");
        }
        if (body.isArchived === true && !current.isArchived) {
          const adminCount = await tx.user.count({
            where: { tenantId: current.id, role: "ADMIN" },
          });
          if (adminCount > 0) throw new Error("TENANT_HAS_ADMINS");
        }

        const changed = await tx.tenant.update({
        where: { id },
        data: {
          name: body.name?.trim() || undefined,
          seatLimit: body.seatLimit,
          isArchived: typeof body.isArchived === "boolean" ? body.isArchived : undefined,
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

        await recordAuditLog(
        {
          tenantId: current.id,
          actorId: check.session.user.id,
          action: "admin.organisation.updated",
          metadata: {
            previous: {
              name: current.name,
              seatLimit: current.seatLimit,
              isArchived: current.isArchived,
              type: current.type,
            },
            current: {
              name: changed.name,
              seatLimit: changed.seatLimit,
              isArchived: changed.isArchived,
              type: changed.type,
            },
          },
        },
        tx,
      );

        return changed;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!updated) {
      return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "TENANT_TYPE_IMMUTABLE") {
      return NextResponse.json(
        { error: "Organisation type cannot be changed directly." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "TENANT_HAS_ADMINS") {
      return NextResponse.json(
        { error: "Move or demote all admins before archiving this Organisation." },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The Organisation changed concurrently. Please try again." },
        { status: 409 },
      );
    }
    throw error;
  }
}
