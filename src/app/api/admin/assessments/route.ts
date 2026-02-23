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

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const tenantId = req.nextUrl.searchParams.get("tenantId")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const assessments = await db.assessment.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
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
      _count: {
        select: {
          questions: true,
          sessions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const tenantParticipantCount = new Map<string, number>();
  const withStats = await Promise.all(
    assessments.map(async (assessment) => {
      if (!tenantParticipantCount.has(assessment.tenantId)) {
        const total = await db.user.count({
          where: {
            tenantId: assessment.tenantId,
            role: { in: ["EMPLOYEE", "LEADER"] },
          },
        });
        tenantParticipantCount.set(assessment.tenantId, total);
      }

      const totalParticipants = tenantParticipantCount.get(assessment.tenantId) || 0;
      const [completed, inProgress] = await Promise.all([
        db.quizSession.count({
          where: { assessmentId: assessment.id, status: "SUBMITTED" },
        }),
        db.quizSession.count({
          where: { assessmentId: assessment.id, status: "IN_PROGRESS" },
        }),
      ]);

      const notStarted = Math.max(totalParticipants - completed - inProgress, 0);
      const completionRate =
        totalParticipants === 0 ? 0 : Math.round((completed / totalParticipants) * 100);

      return {
        ...assessment,
        participantCounts: {
          total: totalParticipants,
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
    tenantId: string;
    title: string;
    policy?: {
      showResultsToEmployee?: boolean;
      resultReleaseDelayHours?: number;
      postSubmitMessage?: string;
      leaderCanViewFullReport?: boolean;
    };
    competencies?: CompetencyInput[];
    sections?: SectionInput[];
    // Backward compatibility with initial MVP payload.
    questions?: Array<{ prompt: string; trait: string; reverse?: boolean }>;
  };

  if (!body.tenantId || !body.title) {
    return NextResponse.json(
      { error: "tenantId and title are required" },
      { status: 400 },
    );
  }

  const tenant = await db.tenant.findUnique({ where: { id: body.tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const competencyMap = new Map<string, string>();

  for (const competency of body.competencies || []) {
    const code = toCode(competency.code);
    if (!code) continue;

    const saved = await db.competency.upsert({
      where: {
        tenantId_code: {
          tenantId: body.tenantId,
          code,
        },
      },
      create: {
        tenantId: body.tenantId,
        code,
        name: competency.name?.trim() || titleizeCode(code),
        description: competency.description,
      },
      update: {
        name: competency.name?.trim() || titleizeCode(code),
        description: competency.description,
      },
    });

    competencyMap.set(code, saved.id);
  }

  const assessment = await db.assessment.create({
    data: {
      tenantId: body.tenantId,
      title: body.title,
      policy: {
        create: {
          showResultsToEmployee: body.policy?.showResultsToEmployee ?? true,
          resultReleaseDelayHours: body.policy?.resultReleaseDelayHours ?? 0,
          postSubmitMessage:
            body.policy?.postSubmitMessage ||
            "Thanks for completing your assessment.",
          leaderCanViewFullReport: body.policy?.leaderCanViewFullReport ?? true,
        },
      },
    },
  });

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

          let competencyId = competencyMap.get(impactCode);
          if (!competencyId) {
            const autoCompetency = await db.competency.upsert({
              where: {
                tenantId_code: {
                  tenantId: body.tenantId,
                  code: impactCode,
                },
              },
              create: {
                tenantId: body.tenantId,
                code: impactCode,
                name: titleizeCode(impactCode),
              },
              update: {},
            });
            competencyId = autoCompetency.id;
            competencyMap.set(impactCode, competencyId);
          }

          await db.optionImpact.create({
            data: {
              optionId: savedOption.id,
              competencyId,
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
                include: { competency: true },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(fullAssessment);
}
