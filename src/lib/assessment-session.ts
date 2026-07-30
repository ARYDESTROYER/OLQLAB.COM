import { normalizeQuestionImageUrl } from "@/lib/question-image-policy";

export type ParticipantQuestionType = "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";

export type ParticipantQuestionSource = {
  id: string;
  code?: string | null;
  sectionId?: string | null;
  prompt: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
  questionType: ParticipantQuestionType;
  scaleMin: number;
  scaleMax: number;
  options: Array<{ id: string; text: string }>;
};

export type ParticipantQuestionDto = ParticipantQuestionSource;

export type ParticipantAnswerInput = {
  questionId?: unknown;
  value?: unknown;
  optionId?: unknown;
  textValue?: unknown;
};

export type ValidatedParticipantAnswer =
  | { questionId: string; kind: "LIKERT_TRAIT"; value: number }
  | { questionId: string; kind: "SJT_SINGLE"; optionId: string }
  | { questionId: string; kind: "FREE_TEXT"; textValue: string; clear: boolean };

export type ParticipantAnswerValidation =
  | { ok: true; answer: ValidatedParticipantAnswer }
  | { ok: false; error: string };

export const MAX_FREE_TEXT_LENGTH = 10_000;

export function serializeAnswerSnapshot(
  answers: Array<{
    questionId: string;
    value?: number | null;
    optionId?: string | null;
    textValue?: string | null;
  }>,
) {
  return JSON.stringify(
    answers
      .map((answer) => ({
        questionId: answer.questionId,
        value: answer.value ?? null,
        optionId: answer.optionId ?? null,
        textValue: answer.textValue ?? null,
      }))
      .sort((a, b) => a.questionId.localeCompare(b.questionId)),
  );
}

/**
 * Build the only question shape that may cross the participant boundary.
 * Scoring traits, reverse flags, categories, option codes, and impacts are
 * intentionally not part of either the input contract or the returned DTO.
 */
export function toParticipantQuestionDto(
  question: ParticipantQuestionSource,
): ParticipantQuestionDto {
  const imageUrl = normalizeQuestionImageUrl(question.imageUrl);
  return {
    id: question.id,
    code: question.code || null,
    sectionId: question.sectionId || null,
    prompt: question.prompt,
    imageUrl,
    imageAlt: imageUrl ? question.imageAlt || null : null,
    imageCaption: imageUrl ? question.imageCaption || null : null,
    questionType: question.questionType,
    scaleMin: question.scaleMin,
    scaleMax: question.scaleMax,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
  };
}

export function validateParticipantAnswer(
  question: ParticipantQuestionSource,
  input: ParticipantAnswerInput,
): ParticipantAnswerValidation {
  if (input.questionId !== question.id) {
    return { ok: false, error: "Question does not match this answer." };
  }

  if (question.questionType === "LIKERT_TRAIT") {
    if (
      typeof input.value !== "number" ||
      !Number.isInteger(input.value) ||
      input.value < question.scaleMin ||
      input.value > question.scaleMax
    ) {
      return {
        ok: false,
        error: `Choose a whole number from ${question.scaleMin} to ${question.scaleMax}.`,
      };
    }

    return {
      ok: true,
      answer: {
        questionId: question.id,
        kind: "LIKERT_TRAIT",
        value: input.value,
      },
    };
  }

  if (question.questionType === "SJT_SINGLE") {
    if (
      typeof input.optionId !== "string" ||
      !question.options.some((option) => option.id === input.optionId)
    ) {
      return { ok: false, error: "Choose one of the available options." };
    }

    return {
      ok: true,
      answer: {
        questionId: question.id,
        kind: "SJT_SINGLE",
        optionId: input.optionId,
      },
    };
  }

  if (typeof input.textValue !== "string") {
    return { ok: false, error: "Enter a text response." };
  }

  const textValue = input.textValue.trim();
  if (textValue.length > MAX_FREE_TEXT_LENGTH) {
    return {
      ok: false,
      error: `Keep the response under ${MAX_FREE_TEXT_LENGTH.toLocaleString("en")} characters.`,
    };
  }

  return {
    ok: true,
    answer: {
      questionId: question.id,
      kind: "FREE_TEXT",
      textValue,
      clear: textValue.length === 0,
    },
  };
}

export function normalizePreviewReturnTo(value: string | null | undefined, assessmentId?: string) {
  const fallback = assessmentId
    ? `/admin/assessments/${encodeURIComponent(assessmentId)}`
    : "/admin/assessments";
  if (!value) return fallback;

  try {
    const parsed = new URL(value, "https://olqlab.invalid");
    if (parsed.origin !== "https://olqlab.invalid") return fallback;
    if (!/^\/admin\/assessments(?:\/[A-Za-z0-9_-]+)?$/.test(parsed.pathname)) {
      return fallback;
    }
    if (parsed.search || parsed.hash) return fallback;
    return parsed.pathname;
  } catch {
    return fallback;
  }
}
