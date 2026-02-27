import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const sessions = await db.quizSession.findMany({
    where: {
      userId,
    },
    include: {
      assessment: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  return NextResponse.json({
    user,
    testsTaken: sessions,
  });
}
