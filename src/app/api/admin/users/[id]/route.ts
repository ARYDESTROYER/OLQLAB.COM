import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Admin users cannot be deleted from this action." },
      { status: 400 },
    );
  }

  await db.$transaction([
    db.seat.deleteMany({
      where: {
        tenantId: user.tenantId,
        userEmail: normalizeEmail(user.email),
      },
    }),
    db.user.delete({
      where: { id: user.id },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    deletedUserId: user.id,
    deletedUserName: `${user.firstName} ${user.lastName}`.trim(),
  });
}
