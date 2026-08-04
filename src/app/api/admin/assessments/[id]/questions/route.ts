import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { normalizeQuestionImageUrl } from "@/lib/question-image-policy";
import { resolveQuestionScale } from "@/lib/assessment-definition";
import {
  ASSESSMENT_CONTENT_HISTORY_ERROR,
  assessmentHasAttemptHistory,
  lockAssessmentContent,
} from "@/lib/assessment-content-lock";

type OptionImpactInput = {
  competencyCode?: string;
  delta?: number;
};

type OptionInput = {
  code?: string;
  text?: string;
  impacts?: OptionImpactInput[];
};

const questionDetailInclude = {
  section: {
    select: {
      id: true,
      title: true,
    },
  },
  options: {
    orderBy: { displayOrder: "asc" as const },
    include: {
      impacts: {
        orderBy: { id: "asc" as const },
        include: {
          competency: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          assessmentCompetency: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  },
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
  if (input === "FREE_TEXT") return "FREE_TEXT" as const;
  return input === "SJT_SINGLE" ? ("SJT_SINGLE" as const) : ("LIKERT_TRAIT" as const);
}

function normalizeOptionalText(input?: string | null) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed ? trimmed : null;
}

function normalizeQuestionOptions(options: OptionInput[] | undefined, questionType: string) {
  if (questionType !== "SJT_SINGLE") return [];

  return (options || [])
    .map((option, optionIndex) => {
      const text = normalizeOptionalText(option.text);
      if (!text) return null;

      return {
        code: normalizeOptionalText(option.code) || `option_${optionIndex + 1}`,
        text,
        impacts: (option.impacts || [])
          .map((impact) => {
            const competencyCode = normalizeOptionalText(impact.competencyCode);
            if (!competencyCode) return null;
            return {
              competencyCode: toCode(competencyCode),
              delta:
                typeof impact.delta === "number" && Number.isFinite(impact.delta)
                  ? impact.delta
                  : 0,
            };
          })
          .filter((impact): impact is { competencyCode: string; delta: number } => Boolean(impact)),
      };
    })
    .filter((option): option is { code: string; text: string; impacts: Array<{ competencyCode: string; delta: number }> } => Boolean(option));
}

function normalizeQuestionImage(input: {
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
}) {
  const imageUrlInput = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
  const imageUrl = normalizeQuestionImageUrl(imageUrlInput);
  if (!imageUrlInput) {
    return {
      imageUrl: null,
      imageAlt: null,
      imageCaption: null,
      invalidImageUrl: false,
    };
  }

  return {
    imageUrl,
    imageAlt: input.imageAlt?.trim() || null,
    imageCaption: input.imageCaption?.trim() || null,
    invalidImageUrl: !imageUrl,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;

  const questions = await db.question.findMany({
    where: { assessmentId: id },
    include: questionDetailInclude,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const sections = await db.assessmentSection.findMany({
    where: { assessmentId: id },
    select: {
      id: true,
      title: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    questions,
    sections,
  });
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
        code?: string;
        prompt?: string;
        imageUrl?: string;
        imageAlt?: string;
        imageCaption?: string;
        questionType?: "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";
        category?: string;
        trait?: string;
        reverse?: boolean;
        scaleMin?: number;
        scaleMax?: number;
        sectionId?: string;
        options?: OptionInput[];
      }
    | null;

  const prompt = normalizeOptionalText(body?.prompt);
  if (!prompt) {
    return NextResponse.json({ error: "Question prompt is required." }, { status: 400 });
  }

  const payload = body ?? {};

  const questionType = pickQuestionType(payload.questionType);
  const scale = resolveQuestionScale({
    questionType,
    scaleMin: payload.scaleMin,
    scaleMax: payload.scaleMax,
  });
  if (!scale.ok) {
    return NextResponse.json(
      { error: scale.error },
      { status: 422 },
    );
  }
  const { scaleMin, scaleMax } = scale;

  const section = payload.sectionId
    ? await db.assessmentSection.findFirst({
        where: {
          id: payload.sectionId,
          assessmentId: id,
        },
        select: { id: true },
      })
    : await db.assessmentSection.findFirst({
        where: { assessmentId: id },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

  if (!section) {
    return NextResponse.json(
      { error: "No section found for this assessment. Add a section first." },
      { status: 400 },
    );
  }

  const questionImage = normalizeQuestionImage(payload);
  if (questionImage.invalidImageUrl) {
    return NextResponse.json(
      {
        error:
          "Image URL must use /question-images/ or an OLQ Lab managed Vercel Blob URL.",
      },
      { status: 422 },
    );
  }
  const normalizedOptions = normalizeQuestionOptions(payload.options, questionType);
  if (questionType === "SJT_SINGLE" && normalizedOptions.length < 2) {
    return NextResponse.json(
      { error: "Single-choice scenario questions require at least two options." },
      { status: 400 },
    );
  }

  const outcome = await db.$transaction(async (tx) => {
    await lockAssessmentContent(tx, id);
    if (await assessmentHasAttemptHistory(tx, id)) {
      return { conflict: true as const };
    }

    const maxSort = await tx.question.aggregate({
      where: { assessmentId: id },
      _max: { sortOrder: true },
    });
    const createdQuestion = await tx.question.create({
      data: {
        assessmentId: id,
        sectionId: section.id,
        code: normalizeOptionalText(payload.code),
        prompt,
        imageUrl: questionImage.imageUrl,
        imageAlt: questionImage.imageAlt,
        imageCaption: questionImage.imageCaption,
        questionType,
        category: normalizeOptionalText(payload.category),
        trait: normalizeOptionalText(payload.trait)?.toLowerCase() || null,
        reverse: Boolean(payload.reverse),
        scaleMin,
        scaleMax,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });

    for (let optionIndex = 0; optionIndex < normalizedOptions.length; optionIndex += 1) {
      const option = normalizedOptions[optionIndex];
      const createdOption = await tx.questionOption.create({
        data: {
          questionId: createdQuestion.id,
          code: option.code,
          text: option.text,
          displayOrder: optionIndex,
        },
        select: { id: true },
      });

      for (const impact of option.impacts) {
        const competency = await tx.assessmentCompetency.upsert({
          where: {
            assessmentId_code: {
              assessmentId: id,
              code: impact.competencyCode,
            },
          },
          create: {
            assessmentId: id,
            code: impact.competencyCode,
            name: titleizeCode(impact.competencyCode),
          },
          update: {},
          select: { id: true },
        });

        await tx.optionImpact.create({
          data: {
            optionId: createdOption.id,
            assessmentCompetencyId: competency.id,
            delta: impact.delta,
          },
        });
      }
    }

    const savedQuestion = await tx.question.findUnique({
      where: { id: createdQuestion.id },
      include: questionDetailInclude,
    });
    await recordAuditLog(
      {
        tenantId: check.liveUser.tenantId,
        actorId: check.liveUser.id,
        action: "ASSESSMENT_QUESTION_CREATED",
        metadata: {
          assessmentId: id,
          questionId: createdQuestion.id,
          questionType,
          optionCount: normalizedOptions.length,
        },
      },
      tx,
    );
    return { conflict: false as const, question: savedQuestion };
  });

  if (outcome.conflict) {
    return NextResponse.json(
      { error: ASSESSMENT_CONTENT_HISTORY_ERROR },
      { status: 409 },
    );
  }

  return NextResponse.json({ question: outcome.question }, { status: 201 });
}
