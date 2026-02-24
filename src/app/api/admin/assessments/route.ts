import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

type CompetencyInput = {
  code: string;
  name: string;
  description?: string;
};

type OptionImpactInput = {
  competencyCode: string;
  delta: number;
};

type OptionInput = {
  code?: string;
  text: string;
  impacts?: OptionImpactInput[];
};

type QuestionInput = {
  code?: string;
  prompt: string;
  category?: string;
  questionType?: "LIKERT_TRAIT" | "SJT_SINGLE";
  trait?: string;
  reverse?: boolean;
  scaleMin?: number;
  scaleMax?: number;
  options?: OptionInput[];
};

type SectionInput = {
  title: string;
  description?: string;
  kind?: "PERSONALITY" | "SCENARIO";
  questions: QuestionInput[];
};

function toCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");
}

function titleizeCode(input: string) {
  return input
    .split("_")
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function pickQuestionType(input?: string) {
  return input === "SJT_SINGLE" ? "SJT_SINGLE" : "LIKERT_TRAIT";
}

function pickSectionKind(input?: string) {
  return input === "SCENARIO" ? "SCENARIO" : "PERSONALITY";
}

async function countEligibleUsersForAssessment(assessmentId: string) {
  const [directEnrollments, tenantEnrollments] = await Promise.all([
    db.assessmentUserEnrollment.findMany({
      where: {
        assessmentId,
        active: true,
      },
      select: {
        userId: true,
      },
    }),
    db.assessmentTenantEnrollment.findMany({
      where: {
        assessmentId,
        active: true,
      },
      select: {
        tenantId: true,
        includeFutureUsers: true,
        createdAt: true,
      },
    }),
  ]);

  const directUserIds = new Set(directEnrollments.map((enrollment) => enrollment.userId));
  const tenantUserIds = new Set<string>();

  for (const enrollment of tenantEnrollments) {
    const tenantUsers = await db.user.findMany({
      where: {
        tenantId: enrollment.tenantId,
        role: { in: ["EMPLOYEE", "LEADER"] },
        ...(enrollment.includeFutureUsers
          ? {}
          : {
              createdAt: {
                lte: enrollment.createdAt,
              },
            }),
      },
      select: {
        id: true,
      },
    });

    for (const user of tenantUsers) {
      tenantUserIds.add(user.id);
    }
  }

  for (const userId of directUserIds) {
    tenantUserIds.add(userId);
  }

  return tenantUserIds.size;
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const ownerTenantId =
    req.nextUrl.searchParams.get("ownerTenantId")?.trim() ||
    req.nextUrl.searchParams.get("tenantId")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const assessments = await db.assessment.findMany({
    where: {
      ...(ownerTenantId
        ? {
            ownerTenantId,
          }
        : {}),
      ...(q
        ? {
            title: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
    },
    include: {
      policy: true,
      ownerTenant: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          questions: true,
          sessions: true,
          userEnrollments: true,
          tenantEnrollments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const withStats = await Promise.all(
    assessments.map(async (assessment) => {
      const [eligibleUsers, completed, inProgress] = await Promise.all([
        countEligibleUsersForAssessment(assessment.id),
        db.quizSession.count({
          where: { assessmentId: assessment.id, status: "SUBMITTED" },
        }),
        db.quizSession.count({
          where: { assessmentId: assessment.id, status: "IN_PROGRESS" },
        }),
      ]);

      const notStarted = Math.max(eligibleUsers - completed - inProgress, 0);
      const completionRate =
        eligibleUsers === 0 ? 0 : Math.round((completed / eligibleUsers) * 100);

      return {
        ...assessment,
        participantCounts: {
          total: eligibleUsers,
          completed,
          inProgress,
          notStarted,
        },
        completionRate,
      };
    }),
  );

  return NextResponse.json({ assessments: withStats });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = (await req.json()) as {
    ownerTenantId?: string;
    tenantId?: string;
    title?: string;
    policy?: {
      showResultsToEmployee?: boolean;
      resultReleaseDelayHours?: number;
      postSubmitMessage?: string;
      leaderCanViewFullReport?: boolean;
    };
    competencies?: CompetencyInput[];
    sections?: SectionInput[];
    questions?: Array<{ prompt: string; trait: string; reverse?: boolean }>;
  };

  const title = body.title?.trim();
  const ownerTenantId = body.ownerTenantId?.trim() || body.tenantId?.trim() || null;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (ownerTenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: ownerTenantId } });
    if (!tenant) {
      return NextResponse.json(
        { error: "ownerTenantId references an unknown tenant" },
        { status: 404 },
      );
    }
  }

  const assessment = await db.assessment.create({
    data: {
      title,
      ownerTenantId,
      // Preserve legacy linkage for transition compatibility.
      tenantId: ownerTenantId,
      policy: {
        create: {
          showResultsToEmployee: body.policy?.showResultsToEmployee ?? true,
          resultReleaseDelayHours: body.policy?.resultReleaseDelayHours ?? 0,
          postSubmitMessage:
            body.policy?.postSubmitMessage || "Thanks for completing your assessment.",
          leaderCanViewFullReport: body.policy?.leaderCanViewFullReport ?? true,
        },
      },
    },
  });

  const competencyMap = new Map<string, string>();

  for (const competency of body.competencies || []) {
    const code = toCode(competency.code);
    if (!code) continue;

    const saved = await db.assessmentCompetency.upsert({
      where: {
        assessmentId_code: {
          assessmentId: assessment.id,
          code,
        },
      },
      create: {
        assessmentId: assessment.id,
        code,
        name: competency.name?.trim() || titleizeCode(code),
        description: competency.description?.trim() || undefined,
      },
      update: {
        name: competency.name?.trim() || titleizeCode(code),
        description: competency.description?.trim() || undefined,
      },
    });

    competencyMap.set(code, saved.id);

    // Keep legacy tenant competency records when owner tenant exists.
    if (ownerTenantId) {
      await db.competency.upsert({
        where: {
          tenantId_code: {
            tenantId: ownerTenantId,
            code,
          },
        },
        create: {
          tenantId: ownerTenantId,
          code,
          name: competency.name?.trim() || titleizeCode(code),
          description: competency.description?.trim() || undefined,
        },
        update: {
          name: competency.name?.trim() || titleizeCode(code),
          description: competency.description?.trim() || undefined,
        },
      });
    }
  }

  const sectionsToPersist: SectionInput[] =
    body.sections && body.sections.length > 0
      ? body.sections
      : [
          {
            title: "Personality Profile",
            kind: "PERSONALITY",
            questions: (body.questions || []).map((question) => ({
              prompt: question.prompt,
              trait: question.trait,
              reverse: question.reverse,
              questionType: "LIKERT_TRAIT",
            })),
          },
        ];

  let questionOrder = 0;

  for (let sectionIndex = 0; sectionIndex < sectionsToPersist.length; sectionIndex += 1) {
    const section = sectionsToPersist[sectionIndex];
    const savedSection = await db.assessmentSection.create({
      data: {
        assessmentId: assessment.id,
        title: section.title,
        description: section.description,
        kind: pickSectionKind(section.kind),
        sortOrder: sectionIndex,
      },
    });

    for (const question of section.questions) {
      const questionType = pickQuestionType(question.questionType);
      const savedQuestion = await db.question.create({
        data: {
          assessmentId: assessment.id,
          sectionId: savedSection.id,
          code: question.code?.trim() || null,
          prompt: question.prompt,
          questionType,
          category: question.category?.trim() || null,
          trait: question.trait?.trim().toLowerCase() || null,
          reverse: Boolean(question.reverse),
          scaleMin: question.scaleMin ?? 1,
          scaleMax: question.scaleMax ?? 5,
          sortOrder: questionOrder,
        },
      });

      questionOrder += 1;

      if (questionType !== "SJT_SINGLE") continue;

      const options = question.options || [];
      for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
        const option = options[optionIndex];
        const savedOption = await db.questionOption.create({
          data: {
            questionId: savedQuestion.id,
            code: option.code?.trim() || `option_${optionIndex + 1}`,
            text: option.text,
            displayOrder: optionIndex,
          },
        });

        for (const impact of option.impacts || []) {
          const impactCode = toCode(impact.competencyCode);
          if (!impactCode) continue;

          let assessmentCompetencyId = competencyMap.get(impactCode);
          if (!assessmentCompetencyId) {
            const autoCompetency = await db.assessmentCompetency.upsert({
              where: {
                assessmentId_code: {
                  assessmentId: assessment.id,
                  code: impactCode,
                },
              },
              create: {
                assessmentId: assessment.id,
                code: impactCode,
                name: titleizeCode(impactCode),
              },
              update: {},
            });
            assessmentCompetencyId = autoCompetency.id;
            competencyMap.set(impactCode, assessmentCompetencyId);
          }

          await db.optionImpact.create({
            data: {
              optionId: savedOption.id,
              assessmentCompetencyId,
              delta: Number(impact.delta) || 0,
            },
          });
        }
      }
    }
  }

  const fullAssessment = await db.assessment.findUnique({
    where: { id: assessment.id },
    include: {
      policy: true,
      ownerTenant: {
        select: {
          id: true,
          name: true,
        },
      },
      assessmentCompetencies: true,
      sections: {
        orderBy: { sortOrder: "asc" },
      },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          options: {
            orderBy: { displayOrder: "asc" },
            include: {
              impacts: {
                include: {
                  competency: true,
                  assessmentCompetency: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(fullAssessment, { status: 201 });
}
