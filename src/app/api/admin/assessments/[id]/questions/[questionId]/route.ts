import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

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

function parseScaleValue(input: unknown, fallback: number) {
  if (typeof input !== "number" || !Number.isFinite(input)) return fallback;
  return Math.round(input);
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
  if (typeof input.imageUrl !== "string") {
    return {
      imageUrl: undefined,
      imageAlt: undefined,
      imageCaption: undefined,
    };
  }

  const imageUrl = input.imageUrl.trim() || null;
  if (!imageUrl) {
    return {
      imageUrl: null,
      imageAlt: null,
      imageCaption: null,
    };
  }

  return {
    imageUrl,
    imageAlt: typeof input.imageAlt === "string" ? input.imageAlt.trim() || null : undefined,
    imageCaption:
      typeof input.imageCaption === "string" ? input.imageCaption.trim() || null : undefined,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id, questionId } = await params;
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

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const existing = await db.question.findFirst({
    where: {
      id: questionId,
      assessmentId: id,
    },
    select: {
      id: true,
      sectionId: true,
      questionType: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  let sectionId = existing.sectionId;
  if (body.sectionId && body.sectionId !== existing.sectionId) {
    const section = await db.assessmentSection.findFirst({
      where: {
        id: body.sectionId,
        assessmentId: id,
      },
      select: { id: true },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found." }, { status: 404 });
    }
    sectionId = section.id;
  }

  const questionImage = normalizeQuestionImage(body);
  const nextQuestionType =
    typeof body.questionType === "string"
      ? pickQuestionType(body.questionType)
      : existing.questionType;
  const scaleMin = parseScaleValue(body.scaleMin, 1);
  const scaleMax = parseScaleValue(body.scaleMax, nextQuestionType === "FREE_TEXT" ? 1 : 5);
  if (typeof body.scaleMin === "number" || typeof body.scaleMax === "number") {
    if (scaleMax < scaleMin) {
      return NextResponse.json(
        { error: "Scale max must be greater than or equal to scale min." },
        { status: 400 },
      );
    }
  }

  const shouldRewriteOptions = Array.isArray(body.options) || nextQuestionType !== "SJT_SINGLE";
  const normalizedOptions = Array.isArray(body.options)
    ? normalizeQuestionOptions(body.options, nextQuestionType)
    : [];

  const question = await db.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: questionId },
      data: {
        code: typeof body.code === "string" ? normalizeOptionalText(body.code) : undefined,
        prompt: typeof body.prompt === "string" ? body.prompt.trim() : undefined,
        imageUrl: questionImage.imageUrl,
        imageAlt: questionImage.imageAlt,
        imageCaption: questionImage.imageCaption,
        questionType: typeof body.questionType === "string" ? nextQuestionType : undefined,
        category: typeof body.category === "string" ? normalizeOptionalText(body.category) : undefined,
        trait: typeof body.trait === "string" ? normalizeOptionalText(body.trait)?.toLowerCase() || null : undefined,
        reverse: typeof body.reverse === "boolean" ? body.reverse : undefined,
        scaleMin: typeof body.scaleMin === "number" ? scaleMin : undefined,
        scaleMax: typeof body.scaleMax === "number" ? scaleMax : undefined,
        sectionId,
      },
    });

    if (shouldRewriteOptions) {
      await tx.questionOption.deleteMany({ where: { questionId } });

      if (nextQuestionType === "SJT_SINGLE") {
        for (let optionIndex = 0; optionIndex < normalizedOptions.length; optionIndex += 1) {
          const option = normalizedOptions[optionIndex];
          const createdOption = await tx.questionOption.create({
            data: {
              questionId,
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
      }
    }

    return tx.question.findUnique({
      where: { id: questionId },
      include: questionDetailInclude,
    });
  });

  return NextResponse.json({ question });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id, questionId } = await params;

  const question = await db.question.findFirst({
    where: {
      id: questionId,
      assessmentId: id,
    },
    select: {
      id: true,
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  await db.question.delete({ where: { id: questionId } });

  return NextResponse.json({ ok: true, deletedQuestionId: questionId });
}
