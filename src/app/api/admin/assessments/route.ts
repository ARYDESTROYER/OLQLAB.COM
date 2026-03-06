import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { buildCsv } from "@/lib/csv";

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
  questionType?: "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";
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
  if (input === "FREE_TEXT") return "FREE_TEXT";
  return input === "SJT_SINGLE" ? "SJT_SINGLE" : "LIKERT_TRAIT";
}

function pickSectionKind(input?: string) {
  return input === "SCENARIO" ? "SCENARIO" : "PERSONALITY";
}

function parseLimit(raw: string | null, fallback: number, max: number) {
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return 1;
  return Math.min(rounded, max);
}

function parsePercent(raw: string | null) {
  if (raw === null || raw.trim() === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(100, parsed));
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

async function countEligibleUsersForLegacyAssessment(assessmentId: string) {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      tenantId: true,
    },
  });

  if (!assessment?.tenantId) return 0;

  return db.user.count({
    where: {
      tenantId: assessment.tenantId,
      role: { in: ["EMPLOYEE", "LEADER"] },
    },
  });
}

async function createAssessmentLegacy(input: {
  title: string;
  tenantId: string;
  policy?: {
    showResultsToEmployee?: boolean;
    resultReleaseDelayHours?: number;
    postSubmitMessage?: string;
    leaderCanViewFullReport?: boolean;
    reportWorkflow?: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
    randomizeQuestionOrder?: boolean;
    submissionAlertAdminIds?: string[];
  };
  competencies?: CompetencyInput[];
  sections?: SectionInput[];
  questions?: Array<{ prompt: string; trait: string; reverse?: boolean }>;
}) {
  const assessment = await db.assessment.create({
    data: {
      title: input.title,
      tenantId: input.tenantId,
      policy: {
        create: {
          showResultsToEmployee: input.policy?.showResultsToEmployee ?? true,
          resultReleaseDelayHours: input.policy?.resultReleaseDelayHours ?? 0,
          postSubmitMessage:
            input.policy?.postSubmitMessage || "Thanks for completing your assessment.",
          leaderCanViewFullReport: input.policy?.leaderCanViewFullReport ?? true,
        },
      },
    },
  });

  const competencyMap = new Map<string, string>();
  for (const competency of input.competencies || []) {
    const code = toCode(competency.code);
    if (!code) continue;

    const saved = await db.competency.upsert({
      where: {
        tenantId_code: {
          tenantId: input.tenantId,
          code,
        },
      },
      create: {
        tenantId: input.tenantId,
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
  }

  const sectionsToPersist: SectionInput[] =
    input.sections && input.sections.length > 0
      ? input.sections
      : [
          {
            title: "Personality Profile",
            kind: "PERSONALITY",
            questions: (input.questions || []).map((question) => ({
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
            const competency = await db.competency.upsert({
              where: {
                tenantId_code: {
                  tenantId: input.tenantId,
                  code: impactCode,
                },
              },
              create: {
                tenantId: input.tenantId,
                code: impactCode,
                name: titleizeCode(impactCode),
              },
              update: {},
            });
            competencyId = competency.id;
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

  return db.assessment.findUnique({
    where: { id: assessment.id },
    include: {
      policy: true,
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
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
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const params = req.nextUrl.searchParams;
  const ownerTenantId =
    params.get("ownerTenantId")?.trim() || params.get("tenantId")?.trim();
  const q = params.get("q")?.trim();
  const statusParam = params.get("status")?.trim().toUpperCase();
  const minCompletionRate = parsePercent(params.get("minCompletionRate"));
  const maxCompletionRate = parsePercent(params.get("maxCompletionRate"));
  const sortBy = params.get("sortBy")?.trim() || "createdAt";
  const sortOrder = params.get("sortOrder")?.trim().toLowerCase() === "asc" ? "asc" : "desc";
  const format = params.get("format")?.trim().toLowerCase();
  const isCsv = format === "csv";
  const take = parseLimit(params.get("limit"), isCsv ? 2000 : 100, isCsv ? 5000 : 500);
  const fetchLimit = Math.max(take, isCsv ? take : 300);
  const isPublishedFilter =
    statusParam === "PUBLISHED"
      ? true
      : statusParam === "DRAFT"
        ? false
        : undefined;

  type AssessmentListRow = {
    id: string;
    title: string;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    ownerTenant: {
      id: string;
      name: string;
    } | null;
    _count: {
      questions: number;
      sessions: number;
      userEnrollments: number;
      tenantEnrollments: number;
    };
    participantCounts: {
      total: number;
      completed: number;
      inProgress: number;
      notStarted: number;
    };
    completionRate: number;
    policy: {
      showResultsToEmployee: boolean;
      resultReleaseDelayHours: number;
      postSubmitMessage: string;
      leaderCanViewFullReport: boolean;
    } | null;
  };

  let withStats: AssessmentListRow[] = [];
  try {
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
        ...(typeof isPublishedFilter === "boolean"
          ? {
              isPublished: isPublishedFilter,
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
      take: fetchLimit,
    });

    withStats = await Promise.all(
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
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const assessments = await db.assessment.findMany({
      where: {
        ...(ownerTenantId
          ? {
              tenantId: ownerTenantId,
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
        ...(typeof isPublishedFilter === "boolean"
          ? {
              isPublished: isPublishedFilter,
            }
          : {}),
      },
      include: {
        policy: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            questions: true,
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: fetchLimit,
    });

    withStats = await Promise.all(
      assessments.map(async (assessment) => {
        const [eligibleUsers, completed, inProgress] = await Promise.all([
          countEligibleUsersForLegacyAssessment(assessment.id),
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
          ownerTenant: assessment.tenant || null,
          _count: {
            ...assessment._count,
            userEnrollments: 0,
            tenantEnrollments: 0,
          },
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
  }

  let filtered = withStats;
  if (typeof minCompletionRate === "number") {
    filtered = filtered.filter(
      (assessment) => assessment.completionRate >= minCompletionRate,
    );
  }
  if (typeof maxCompletionRate === "number") {
    filtered = filtered.filter(
      (assessment) => assessment.completionRate <= maxCompletionRate,
    );
  }

  filtered.sort((a, b) => {
    const direction = sortOrder === "asc" ? 1 : -1;
    if (sortBy === "title") return a.title.localeCompare(b.title) * direction;
    if (sortBy === "completionRate") {
      return (a.completionRate - b.completionRate) * direction;
    }
    if (sortBy === "participants") {
      return (a.participantCounts.total - b.participantCounts.total) * direction;
    }
    if (sortBy === "updatedAt") {
      return (a.updatedAt.getTime() - b.updatedAt.getTime()) * direction;
    }
    return (a.createdAt.getTime() - b.createdAt.getTime()) * direction;
  });

  const sliced = filtered.slice(0, take);

  if (isCsv) {
    const csv = buildCsv(
      [
        "id",
        "title",
        "status",
        "ownerTenantId",
        "ownerTenantName",
        "questions",
        "sessions",
        "userEnrollments",
        "tenantEnrollments",
        "participantsTotal",
        "participantsCompleted",
        "participantsInProgress",
        "participantsNotStarted",
        "completionRate",
        "createdAt",
        "updatedAt",
      ],
      sliced.map((assessment) => [
        assessment.id,
        assessment.title,
        assessment.isPublished ? "PUBLISHED" : "DRAFT",
        assessment.ownerTenant?.id ?? "",
        assessment.ownerTenant?.name ?? "",
        assessment._count.questions,
        assessment._count.sessions,
        assessment._count.userEnrollments,
        assessment._count.tenantEnrollments,
        assessment.participantCounts.total,
        assessment.participantCounts.completed,
        assessment.participantCounts.inProgress,
        assessment.participantCounts.notStarted,
        assessment.completionRate,
        assessment.createdAt,
        assessment.updatedAt,
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="admin-assessments-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ assessments: sliced });
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
      reportWorkflow?: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
      randomizeQuestionOrder?: boolean;
      submissionAlertAdminIds?: string[];
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

  try {
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
            reportWorkflow: body.policy?.reportWorkflow ?? "AI_STANDARD",
            randomizeQuestionOrder: body.policy?.randomizeQuestionOrder ?? false,
            submissionAlertAdminIds: body.policy?.submissionAlertAdminIds ?? [],
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
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    if (!ownerTenantId) {
      return NextResponse.json(
        {
          error:
            "Database migration pending. In compatibility mode, please select an owner tenant when creating assessments.",
        },
        { status: 409 },
      );
    }

    const fullAssessment = await createAssessmentLegacy({
      title,
      tenantId: ownerTenantId,
      policy: body.policy,
      competencies: body.competencies,
      sections: body.sections,
      questions: body.questions,
    });

    return NextResponse.json(fullAssessment, { status: 201 });
  }
}
