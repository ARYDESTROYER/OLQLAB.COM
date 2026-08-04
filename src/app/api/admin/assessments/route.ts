import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import { buildCsv } from "@/lib/csv";
import {
  AssessmentCountSchemaCompatibilityError,
  countResolvedAssessmentListStats,
} from "@/lib/assessment-access";
import { buildAssessmentParticipantStats } from "@/lib/assessment-list-stats";
import {
  ASSESSMENT_DEFINITION_LIMITS,
  validateAssessmentDefinition,
} from "@/lib/assessment-definition";
import { normalizeQuestionImageUrl } from "@/lib/question-image-policy";
import {
  DEFAULT_ASSESSMENT_INTRO_BULLETS,
  DEFAULT_ASSESSMENT_INTRO_DESCRIPTION,
} from "@/lib/assessment-intro";
import {
  buildAdminListWindowMeta,
  getAdminCsvWindowError,
} from "@/lib/admin-list-window";

const MAX_CSV_BYTES = 4 * 1024 * 1024;

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
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
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

function normalizeOptionalText(input?: string | null) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed ? trimmed : null;
}

function normalizeQuestionImage(input: {
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
}) {
  const imageUrlInput = normalizeOptionalText(input.imageUrl);
  const imageUrl = normalizeQuestionImageUrl(imageUrlInput);
  if (!imageUrlInput) {
    return {
      imageUrl: null,
      imageAlt: null,
      imageCaption: null,
    };
  }

  return {
    imageUrl,
    imageAlt: normalizeOptionalText(input.imageAlt),
    imageCaption: normalizeOptionalText(input.imageCaption),
  };
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

async function createAssessmentLegacy(tx: Prisma.TransactionClient, input: {
  title: string;
  tenantId: string;
  policy?: {
    showResultsToEmployee?: boolean;
    resultReleaseDelayHours?: number;
    introDescription?: string;
    introBullets?: string[];
    postSubmitMessage?: string;
    leaderCanViewFullReport?: boolean;
    reportWorkflow?: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
    questionPresentationMode?: "ALL_AT_ONCE" | "ONE_AT_A_TIME";
    randomizeQuestionOrder?: boolean;
    submissionAlertAdminIds?: string[];
  };
  competencies?: CompetencyInput[];
  sections?: SectionInput[];
  questions?: Array<{ prompt: string; trait: string; reverse?: boolean }>;
}) {
  const assessment = await tx.assessment.create({
    data: {
      title: input.title,
      tenantId: input.tenantId,
      policy: {
        create: {
          showResultsToEmployee: input.policy?.showResultsToEmployee ?? true,
          resultReleaseDelayHours: input.policy?.resultReleaseDelayHours ?? 0,
          introDescription:
            input.policy?.introDescription || DEFAULT_ASSESSMENT_INTRO_DESCRIPTION,
          introBullets: input.policy?.introBullets ?? DEFAULT_ASSESSMENT_INTRO_BULLETS,
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

    const saved = await tx.competency.upsert({
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
    const savedSection = await tx.assessmentSection.create({
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
      const questionImage = normalizeQuestionImage(question);
      const savedQuestion = await tx.question.create({
        data: {
          assessmentId: assessment.id,
          sectionId: savedSection.id,
          code: question.code?.trim() || null,
          prompt: question.prompt,
          imageUrl: questionImage.imageUrl,
          imageAlt: questionImage.imageAlt,
          imageCaption: questionImage.imageCaption,
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
        const savedOption = await tx.questionOption.create({
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
            const competency = await tx.competency.upsert({
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

          await tx.optionImpact.create({
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

  return tx.assessment.findUnique({
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
  const take = parseLimit(params.get("limit"), isCsv ? 5000 : 100, isCsv ? 5000 : 500);
  const isPublishedFilter =
    statusParam === "PUBLISHED"
      ? true
      : statusParam === "DRAFT"
        ? false
        : undefined;
  const usesDerivedWindow =
    typeof minCompletionRate === "number" ||
    typeof maxCompletionRate === "number" ||
    sortBy === "completionRate" ||
    sortBy === "participants";
  const fetchLimit = isCsv
    ? take
    : usesDerivedWindow
      ? Math.max(take, 300)
      : take;
  const databaseOrderBy: Prisma.AssessmentOrderByWithRelationInput =
    sortBy === "title"
      ? { title: sortOrder }
      : sortBy === "updatedAt"
        ? { updatedAt: sortOrder }
        : { createdAt: sortOrder };

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

  const currentWhere: Prisma.AssessmentWhereInput = {
    ...(ownerTenantId ? { ownerTenantId } : {}),
    ...(q
      ? {
          title: {
            contains: q,
            mode: "insensitive",
          },
        }
      : {}),
    ...(typeof isPublishedFilter === "boolean"
      ? { isPublished: isPublishedFilter }
      : {}),
  };

  let withStats: AssessmentListRow[] = [];
  let totalCandidates = 0;
  let processedCandidates = 0;
  try {
    const [assessments, candidateCount] = await Promise.all([
      db.assessment.findMany({
        where: currentWhere,
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
        orderBy: usesDerivedWindow ? { createdAt: "desc" } : databaseOrderBy,
        take: fetchLimit,
      }),
      db.assessment.count({ where: currentWhere }),
    ]);
    totalCandidates = candidateCount;
    processedCandidates = assessments.length;

    const assessmentIds = assessments.map((assessment) => assessment.id);
    const { eligibleByAssessmentId, sessionCounts } =
      await countResolvedAssessmentListStats(assessmentIds);
    const statsByAssessmentId = buildAssessmentParticipantStats(
      assessmentIds,
      eligibleByAssessmentId,
      sessionCounts,
    );
    withStats = assessments.map((assessment) => {
      const stats = statsByAssessmentId.get(assessment.id)!;
      return {
        ...assessment,
        participantCounts: {
          total: stats.total,
          completed: stats.completed,
          inProgress: stats.inProgress,
          notStarted: stats.notStarted,
        },
        completionRate: stats.completionRate,
      };
    });
  } catch (error) {
    if (
      !isSchemaCompatibilityError(error) &&
      !(error instanceof AssessmentCountSchemaCompatibilityError)
    ) {
      throw error;
    }

    const legacyWhere: Prisma.AssessmentWhereInput = {
      ...(ownerTenantId ? { tenantId: ownerTenantId } : {}),
      ...(q
        ? {
            title: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
      ...(typeof isPublishedFilter === "boolean"
        ? { isPublished: isPublishedFilter }
        : {}),
    };
    const [assessments, candidateCount] = await Promise.all([
      db.assessment.findMany({
        where: legacyWhere,
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
        orderBy: usesDerivedWindow ? { createdAt: "desc" } : databaseOrderBy,
        take: fetchLimit,
      }),
      db.assessment.count({ where: legacyWhere }),
    ]);
    totalCandidates = candidateCount;
    processedCandidates = assessments.length;

    const assessmentIds = assessments.map((assessment) => assessment.id);
    const tenantIds = Array.from(
      new Set(
        assessments
          .map((assessment) => assessment.tenantId)
          .filter((tenantId): tenantId is string => Boolean(tenantId)),
      ),
    );
    const [tenantUserCounts, sessionCounts] = await Promise.all([
      tenantIds.length
        ? db.user.groupBy({
            by: ["tenantId"],
            where: {
              tenantId: { in: tenantIds },
              role: { in: ["EMPLOYEE", "LEADER"] },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      db.quizSession.groupBy({
        by: ["assessmentId", "status"],
        where: { assessmentId: { in: assessmentIds } },
        _count: { _all: true },
      }),
    ]);
    const usersByTenantId = new Map(
      tenantUserCounts.map((row) => [row.tenantId, row._count._all]),
    );
    const eligibleByAssessmentId = new Map(
      assessments.map((assessment) => [
        assessment.id,
        assessment.tenantId ? usersByTenantId.get(assessment.tenantId) || 0 : 0,
      ]),
    );
    const statsByAssessmentId = buildAssessmentParticipantStats(
      assessmentIds,
      eligibleByAssessmentId,
      sessionCounts,
    );
    withStats = assessments.map((assessment) => {
      const stats = statsByAssessmentId.get(assessment.id)!;
      return {
        ...assessment,
        ownerTenant: assessment.tenant || null,
        _count: {
          ...assessment._count,
          userEnrollments: 0,
          tenantEnrollments: 0,
        },
        participantCounts: {
          total: stats.total,
          completed: stats.completed,
          inProgress: stats.inProgress,
          notStarted: stats.notStarted,
        },
        completionRate: stats.completionRate,
      };
    });
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
    const csvWindowError = getAdminCsvWindowError({
      totalCandidates,
      limit: take,
      recordLabel: "assessments",
      derivedFilterApplied:
        typeof minCompletionRate === "number" ||
        typeof maxCompletionRate === "number",
    });
    if (csvWindowError) {
      return NextResponse.json(
        { error: csvWindowError },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }

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

    if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: "CSV export is too large. Narrow the filters and try again." },
        { status: 413 },
      );
    }

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

  return NextResponse.json({
    assessments: sliced,
    meta: buildAdminListWindowMeta({
      returned: sliced.length,
      limit: take,
      totalCandidates,
      processedCandidates,
      matchingWithinWindow: filtered.length,
      derivedFilterApplied:
        typeof minCompletionRate === "number" ||
        typeof maxCompletionRate === "number",
    }),
  });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const contentLength = Number(req.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > ASSESSMENT_DEFINITION_LIMITS.requestBytes
  ) {
    return NextResponse.json(
      { error: "Assessment definition exceeds the 2 MB request limit." },
      { status: 413 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    ownerTenantId?: string;
    tenantId?: string;
    title?: string;
    policy?: {
      showResultsToEmployee?: boolean;
      resultReleaseDelayHours?: number;
      introDescription?: string;
      introBullets?: string[];
      postSubmitMessage?: string;
      leaderCanViewFullReport?: boolean;
      reportWorkflow?: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
      questionPresentationMode?: "ALL_AT_ONCE" | "ONE_AT_A_TIME";
      randomizeQuestionOrder?: boolean;
      submissionAlertAdminIds?: string[];
    };
    competencies?: CompetencyInput[];
    sections?: SectionInput[];
    questions?: Array<{ prompt: string; trait: string; reverse?: boolean }>;
  } | null;

  if (!body || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const definitionError = validateAssessmentDefinition(body);
  if (definitionError) {
    return NextResponse.json({ error: definitionError }, { status: 422 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const ownerTenantId =
    (typeof body.ownerTenantId === "string" ? body.ownerTenantId.trim() : "") ||
    (typeof body.tenantId === "string" ? body.tenantId.trim() : "") ||
    null;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (ownerTenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: ownerTenantId } });
    if (!tenant) {
      return NextResponse.json(
        { error: "ownerTenantId references an unknown organisation." },
        { status: 404 },
      );
    }
  }

  try {
    const fullAssessment = await db.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        title,
        ownerTenantId,
        // Preserve legacy linkage for transition compatibility.
        tenantId: ownerTenantId,
        policy: {
          create: {
            showResultsToEmployee: body.policy?.showResultsToEmployee ?? true,
            resultReleaseDelayHours: body.policy?.resultReleaseDelayHours ?? 0,
            introDescription:
              body.policy?.introDescription || DEFAULT_ASSESSMENT_INTRO_DESCRIPTION,
            introBullets: body.policy?.introBullets ?? DEFAULT_ASSESSMENT_INTRO_BULLETS,
            postSubmitMessage:
              body.policy?.postSubmitMessage || "Thanks for completing your assessment.",
            leaderCanViewFullReport: body.policy?.leaderCanViewFullReport ?? true,
            reportWorkflow: body.policy?.reportWorkflow ?? "AI_STANDARD",
            questionPresentationMode: body.policy?.questionPresentationMode ?? "ALL_AT_ONCE",
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

    const saved = await tx.assessmentCompetency.upsert({
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
      await tx.competency.upsert({
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
    const savedSection = await tx.assessmentSection.create({
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
      const questionImage = normalizeQuestionImage(question);
      const savedQuestion = await tx.question.create({
        data: {
          assessmentId: assessment.id,
          sectionId: savedSection.id,
          code: question.code?.trim() || null,
          prompt: question.prompt,
          imageUrl: questionImage.imageUrl,
          imageAlt: questionImage.imageAlt,
          imageCaption: questionImage.imageCaption,
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
        const savedOption = await tx.questionOption.create({
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
            const autoCompetency = await tx.assessmentCompetency.upsert({
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

          await tx.optionImpact.create({
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

    const createdAssessment = await tx.assessment.findUnique({
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

    await recordAuditLog(
      {
        tenantId: check.liveUser.tenantId,
        actorId: check.liveUser.id,
        action: "ASSESSMENT_CREATED",
        metadata: {
          assessmentId: assessment.id,
          ownerTenantId,
          questionCount: questionOrder,
        },
      },
      tx,
    );

    return createdAssessment;
    }, { timeout: 30_000 });

    return NextResponse.json(fullAssessment, { status: 201 });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    if (!ownerTenantId) {
      return NextResponse.json(
        {
          error:
            "Database migration pending. In compatibility mode, please select an owner organisation when creating assessments.",
        },
        { status: 409 },
      );
    }

    const fullAssessment = await db.$transaction(async (tx) => {
      const createdAssessment = await createAssessmentLegacy(tx, {
        title,
        tenantId: ownerTenantId,
        policy: body.policy,
        competencies: body.competencies,
        sections: body.sections,
        questions: body.questions,
      });

      if (createdAssessment) {
        await recordAuditLog(
          {
            tenantId: check.liveUser.tenantId,
            actorId: check.liveUser.id,
            action: "ASSESSMENT_CREATED",
            metadata: {
              assessmentId: createdAssessment.id,
              ownerTenantId,
              compatibilityMode: true,
            },
          },
          tx,
        );
      }
      return createdAssessment;
    }, { timeout: 30_000 });

    return NextResponse.json(fullAssessment, { status: 201 });
  }
}
