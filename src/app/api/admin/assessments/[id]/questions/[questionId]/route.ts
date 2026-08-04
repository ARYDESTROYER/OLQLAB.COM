import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-log";
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
  if (typeof input.imageUrl !== "string") {
    return {
      imageUrl: undefined,
      imageAlt: undefined,
      imageCaption: undefined,
      invalidImageUrl: false,
    };
  }

  const imageUrlInput = input.imageUrl.trim();
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
    imageAlt: typeof input.imageAlt === "string" ? input.imageAlt.trim() || null : undefined,
    imageCaption:
      typeof input.imageCaption === "string" ? input.imageCaption.trim() || null : undefined,
    invalidImageUrl: !imageUrl,
  };
}

function comparableOptions(
  options: Array<{
    code: string;
    text: string;
    impacts: Array<{
      delta: number;
      competency: { code: string } | null;
      assessmentCompetency: { code: string } | null;
    }>;
  }>,
) {
  return options.map((option) => ({
    code: option.code,
    text: option.text,
    impacts: option.impacts
      .map((impact) => ({
        competencyCode: impact.assessmentCompetency?.code || impact.competency?.code || "",
        delta: impact.delta,
      }))
      .sort((a, b) => a.competencyCode.localeCompare(b.competencyCode)),
  }));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id, questionId } = await params;
  const admin = await db.user.findUnique({
    where: { id: check.session.user.id },
    select: { id: true, tenantId: true },
  });
  if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 404 });
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

  const questionImage = normalizeQuestionImage(body);
  if (questionImage.invalidImageUrl) {
    return NextResponse.json(
      {
        error:
          "Image URL must use /question-images/ or an OLQ Lab managed Vercel Blob URL.",
      },
      { status: 422 },
    );
  }
  const outcome = await db.$transaction(async (tx) => {
    await lockAssessmentContent(tx, id);
    const existing = await tx.question.findFirst({
      where: { id: questionId, assessmentId: id },
      include: questionDetailInclude,
    });
    if (!existing) return { status: "NOT_FOUND" as const };

    let sectionId = existing.sectionId;
    if (body.sectionId && body.sectionId !== existing.sectionId) {
      const section = await tx.assessmentSection.findFirst({
        where: { id: body.sectionId, assessmentId: id },
        select: { id: true },
      });
      if (!section) return { status: "SECTION_NOT_FOUND" as const };
      sectionId = section.id;
    }

    const nextQuestionType =
      typeof body.questionType === "string"
        ? pickQuestionType(body.questionType)
        : existing.questionType;
    const scale = resolveQuestionScale(
      {
        questionType: nextQuestionType,
        scaleMin: body.scaleMin,
        scaleMax: body.scaleMax,
      },
      { scaleMin: existing.scaleMin, scaleMax: existing.scaleMax },
    );
    if (!scale.ok) {
      return { status: "INVALID_SCALE" as const, error: scale.error };
    }
    const { scaleMin, scaleMax } = scale;

    const shouldRewriteOptions =
      Array.isArray(body.options) || nextQuestionType !== "SJT_SINGLE";
    const normalizedOptions = Array.isArray(body.options)
      ? normalizeQuestionOptions(body.options, nextQuestionType)
      : [];
    if (
      nextQuestionType === "SJT_SINGLE" &&
      Array.isArray(body.options) &&
      normalizedOptions.length < 2
    ) {
      return { status: "INVALID_OPTIONS" as const };
    }

    const optionsChanged = Array.isArray(body.options)
      ? JSON.stringify(normalizedOptions) !==
        JSON.stringify(comparableOptions(existing.options))
      : nextQuestionType !== "SJT_SINGLE" && existing.options.length > 0;
    const substantiveChange =
      (typeof body.code === "string" &&
        normalizeOptionalText(body.code) !== existing.code) ||
      (typeof body.prompt === "string" &&
        body.prompt.trim() !== existing.prompt) ||
      (questionImage.imageUrl !== undefined &&
        questionImage.imageUrl !== existing.imageUrl) ||
      (typeof body.questionType === "string" &&
        nextQuestionType !== existing.questionType) ||
      (typeof body.category === "string" &&
        normalizeOptionalText(body.category) !== existing.category) ||
      (typeof body.trait === "string" &&
        (normalizeOptionalText(body.trait)?.toLowerCase() || null) !==
          existing.trait) ||
      (typeof body.reverse === "boolean" &&
        body.reverse !== existing.reverse) ||
      (typeof body.scaleMin === "number" &&
        scaleMin !== existing.scaleMin) ||
      (typeof body.scaleMax === "number" &&
        scaleMax !== existing.scaleMax) ||
      sectionId !== existing.sectionId ||
      optionsChanged;

    if (substantiveChange && (await assessmentHasAttemptHistory(tx, id))) {
      return { status: "HAS_HISTORY" as const };
    }

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

    if (shouldRewriteOptions && optionsChanged) {
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

    const updated = await tx.question.findUnique({
      where: { id: questionId },
      include: questionDetailInclude,
    });
    await recordAuditLog(
      {
        tenantId: admin.tenantId,
        actorId: admin.id,
        action: "ASSESSMENT_QUESTION_UPDATED",
        metadata: {
          assessmentId: id,
          questionId,
          substantiveChange,
          optionsReplaced: shouldRewriteOptions && optionsChanged,
        },
      },
      tx,
    );
    return { status: "UPDATED" as const, question: updated };
  });

  if (outcome.status === "NOT_FOUND") {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  if (outcome.status === "SECTION_NOT_FOUND") {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }
  if (outcome.status === "INVALID_SCALE") {
    return NextResponse.json({ error: outcome.error }, { status: 422 });
  }
  if (outcome.status === "INVALID_OPTIONS") {
    return NextResponse.json(
      { error: "Scenario questions require at least two non-empty options." },
      { status: 422 },
    );
  }
  if (outcome.status === "HAS_HISTORY") {
    return NextResponse.json(
      { error: ASSESSMENT_CONTENT_HISTORY_ERROR },
      { status: 409 },
    );
  }

  return NextResponse.json({ question: outcome.question });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id, questionId } = await params;
  const admin = await db.user.findUnique({
    where: { id: check.session.user.id },
    select: { id: true, tenantId: true },
  });
  if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 404 });

  const outcome = await db.$transaction(async (tx) => {
    await lockAssessmentContent(tx, id);
    const question = await tx.question.findFirst({
      where: {
        id: questionId,
        assessmentId: id,
      },
      select: { id: true },
    });
    if (!question) return { status: "NOT_FOUND" as const };
    if (await assessmentHasAttemptHistory(tx, id)) {
      return { status: "HAS_HISTORY" as const };
    }

    await tx.question.delete({ where: { id: questionId } });
    await recordAuditLog(
      {
        tenantId: admin.tenantId,
        actorId: admin.id,
        action: "ASSESSMENT_QUESTION_DELETED",
        metadata: { assessmentId: id, questionId },
      },
      tx,
    );
    return { status: "DELETED" as const };
  });

  if (outcome.status === "NOT_FOUND") {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  if (outcome.status === "HAS_HISTORY") {
    return NextResponse.json(
      { error: ASSESSMENT_CONTENT_HISTORY_ERROR },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, deletedQuestionId: questionId });
}
