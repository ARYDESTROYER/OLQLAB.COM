import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getAssessmentScope(id: string) {
  return db.assessment.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
          seatLimit: true,
        },
      },
    },
  });
}

async function listParticipants(assessmentId: string, tenantId: string, q?: string) {
  const users = await db.user.findMany({
    where: {
      tenantId,
      role: { in: ["EMPLOYEE", "LEADER"] },
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      manager: {
        select: {
          email: true,
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const userIds = users.map((user) => user.id);
  const [sessions, retestEligibility] = await Promise.all([
    userIds.length
      ? db.quizSession.findMany({
          where: {
            assessmentId,
            userId: { in: userIds },
          },
          select: {
            userId: true,
            status: true,
            startedAt: true,
            submittedAt: true,
          },
        })
      : [],
    userIds.length
      ? db.retestEligibility.findMany({
          where: {
            assessmentId,
            userId: { in: userIds },
          },
          select: {
            userId: true,
            eligibleAt: true,
          },
        })
      : [],
  ]);

  const sessionByUser = new Map(sessions.map((session) => [session.userId, session]));
  const retestByUser = new Map(
    retestEligibility.map((item) => [item.userId, item.eligibleAt]),
  );
  const now = new Date();

  return users.map((user) => {
    const userSession = sessionByUser.get(user.id);
    const retestEligibleAt = retestByUser.get(user.id) || null;
    const canRetestNow = retestEligibleAt ? now >= retestEligibleAt : false;
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      managerEmail: user.manager?.email || null,
      status: userSession?.status || "NOT_STARTED",
      startedAt: userSession?.startedAt || null,
      submittedAt: userSession?.submittedAt || null,
      retestEligibleAt,
      canRetestNow,
    };
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const assessment = await getAssessmentScope(id);
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const participants = await listParticipants(id, assessment.tenantId, q);
  return NextResponse.json({ participants });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: "EMPLOYEE" | "LEADER";
        managerEmail?: string;
      }
    | null;

  const normalizedEmail = body?.email ? normalizeEmail(body.email) : "";
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "A valid participant email is required." }, { status: 400 });
  }

  const assessment = await getAssessmentScope(id);
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const existingUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (existingUser && existingUser.tenantId !== assessment.tenantId) {
    return NextResponse.json(
      {
        error:
          "This email belongs to a different client. Cross-client reassignment is blocked.",
        existingTenantId: existingUser.tenant.id,
        existingTenantName: existingUser.tenant.name,
        assessmentTenantId: assessment.tenant.id,
        assessmentTenantName: assessment.tenant.name,
      },
      { status: 409 },
    );
  }

  const manager = body?.managerEmail
    ? await db.user.findFirst({
        where: {
          tenantId: assessment.tenantId,
          email: normalizeEmail(body.managerEmail),
        },
        select: {
          id: true,
        },
      })
    : null;

  const role = body?.role === "LEADER" ? "LEADER" : "EMPLOYEE";
  const firstName = body?.firstName?.trim() || "Participant";
  const lastName = body?.lastName?.trim() || "User";

  let result:
    | {
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          role: "ADMIN" | "EMPLOYEE" | "LEADER";
          manager: { email: string } | null;
        };
        session: {
          status: "IN_PROGRESS" | "SUBMITTED";
          startedAt: Date;
          submittedAt: Date | null;
        } | null;
        retestEligibleAt: Date | null;
      }
    | null = null;

  try {
    result = await db.$transaction(async (tx) => {
      const seat = await tx.seat.findUnique({
        where: {
          tenantId_userEmail: {
            tenantId: assessment.tenantId,
            userEmail: normalizedEmail,
          },
        },
        select: {
          id: true,
        },
      });

      if (!seat) {
        const seatCount = await tx.seat.count({
          where: { tenantId: assessment.tenantId },
        });
        if (seatCount >= assessment.tenant.seatLimit) {
          throw new Error("SEAT_LIMIT_REACHED");
        }

        await tx.seat.create({
          data: {
            tenantId: assessment.tenantId,
            userEmail: normalizedEmail,
            assigned: false,
          },
        });
      }

      const user = await tx.user.upsert({
        where: { email: normalizedEmail },
        create: {
          email: normalizedEmail,
          firstName,
          lastName,
          role,
          tenantId: assessment.tenantId,
          managerId: manager?.id,
        },
        update: {
          firstName,
          lastName,
          role,
          tenantId: assessment.tenantId,
          managerId: manager?.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          manager: {
            select: {
              email: true,
            },
          },
        },
      });

      const [session, retestEligibility] = await Promise.all([
        tx.quizSession.findUnique({
          where: {
            assessmentId_userId: {
              assessmentId: assessment.id,
              userId: user.id,
            },
          },
          select: {
            status: true,
            startedAt: true,
            submittedAt: true,
          },
        }),
        tx.retestEligibility.findUnique({
          where: {
            assessmentId_userId: {
              assessmentId: assessment.id,
              userId: user.id,
            },
          },
          select: {
            eligibleAt: true,
          },
        }),
      ]);

      return {
        user,
        session,
        retestEligibleAt: retestEligibility?.eligibleAt || null,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SEAT_LIMIT_REACHED") {
      return NextResponse.json(
        {
          error: `Seat limit reached (${assessment.tenant.seatLimit}). Increase seats before adding more users.`,
        },
        { status: 400 },
      );
    }
    throw error;
  }

  if (!result) {
    return NextResponse.json({ error: "Unable to add participant." }, { status: 500 });
  }

  const canRetestNow = result.retestEligibleAt ? new Date() >= result.retestEligibleAt : false;
  return NextResponse.json({
    ok: true,
    assessmentId: assessment.id,
    participant: {
      userId: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
      managerEmail: result.user.manager?.email || null,
      status: result.session?.status || "NOT_STARTED",
      startedAt: result.session?.startedAt || null,
      submittedAt: result.session?.submittedAt || null,
      retestEligibleAt: result.retestEligibleAt,
      canRetestNow,
    },
  });
}
