import { normalizeQuestionImageUrl } from "@/lib/question-image-policy";

export type AssessmentQuestionType =
  | "LIKERT_TRAIT"
  | "SJT_SINGLE"
  | "FREE_TEXT";

type QuestionScaleInput = {
  questionType: AssessmentQuestionType;
  scaleMin?: unknown;
  scaleMax?: unknown;
};

type QuestionScaleFallback = {
  scaleMin: number;
  scaleMax: number;
};

export type QuestionScaleResult =
  | { ok: true; scaleMin: number; scaleMax: number }
  | { ok: false; error: string };

export const ASSESSMENT_DEFINITION_LIMITS = {
  requestBytes: 2 * 1024 * 1024,
  competencies: 200,
  sections: 100,
  questions: 1_000,
  optionsPerQuestion: 20,
  impactsPerOption: 50,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Canonical response-scale resolver used by every JSON authoring path.
 * A fallback preserves stored values for partial PATCH requests; creation and
 * import validation use the response-type defaults.
 */
export function resolveQuestionScale(
  input: QuestionScaleInput,
  fallback?: QuestionScaleFallback,
): QuestionScaleResult {
  const defaultMin = fallback?.scaleMin ?? 1;
  const defaultMax =
    fallback?.scaleMax ?? (input.questionType === "FREE_TEXT" ? 1 : 5);
  const scaleMin = input.scaleMin === undefined ? defaultMin : input.scaleMin;
  const scaleMax = input.scaleMax === undefined ? defaultMax : input.scaleMax;

  if (
    typeof scaleMin !== "number" ||
    typeof scaleMax !== "number" ||
    !Number.isInteger(scaleMin) ||
    !Number.isInteger(scaleMax) ||
    scaleMin < 0 ||
    scaleMax > 100 ||
    scaleMax < scaleMin ||
    scaleMax - scaleMin > 20
  ) {
    return { ok: false, error: "Question has an invalid response scale." };
  }

  return { ok: true, scaleMin, scaleMax };
}

function validateQuestion(question: unknown, label: string) {
  if (!isRecord(question)) return `${label} must be an object.`;
  if (typeof question.prompt !== "string" || !question.prompt.trim()) {
    return `${label} requires a prompt.`;
  }
  if (question.prompt.length > 10_000) return `${label} prompt is too long.`;

  if (question.imageUrl !== undefined && typeof question.imageUrl !== "string") {
    return `${label} image URL must be a string.`;
  }
  if (
    typeof question.imageUrl === "string" &&
    question.imageUrl.trim() &&
    !normalizeQuestionImageUrl(question.imageUrl)
  ) {
    return `${label} image URL must use /question-images/ or an OLQ Lab managed Vercel Blob URL.`;
  }

  const questionType =
    question.questionType === undefined ? "LIKERT_TRAIT" : question.questionType;
  if (!['LIKERT_TRAIT', 'SJT_SINGLE', 'FREE_TEXT'].includes(String(questionType))) {
    return `${label} has an invalid question type.`;
  }

  const scale = resolveQuestionScale({
    questionType: questionType as AssessmentQuestionType,
    scaleMin: question.scaleMin,
    scaleMax: question.scaleMax,
  });
  if (!scale.ok) {
    return `${label} has an invalid response scale.`;
  }

  if (question.options !== undefined && !Array.isArray(question.options)) {
    return `${label} options must be an array.`;
  }
  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length > ASSESSMENT_DEFINITION_LIMITS.optionsPerQuestion) {
    return `${label} has too many options.`;
  }
  const usableOptions = options.filter(
    (option) => isRecord(option) && typeof option.text === "string" && option.text.trim(),
  );
  if (questionType === "SJT_SINGLE" && usableOptions.length < 2) {
    return `${label} requires at least two non-empty options.`;
  }
  if (questionType !== "SJT_SINGLE" && options.length > 0) {
    return `${label} may only include options when its type is SJT_SINGLE.`;
  }

  for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
    const option = options[optionIndex];
    if (!isRecord(option) || typeof option.text !== "string" || !option.text.trim()) {
      return `${label} option ${optionIndex + 1} requires text.`;
    }
    if (option.impacts !== undefined && !Array.isArray(option.impacts)) {
      return `${label} option ${optionIndex + 1} impacts must be an array.`;
    }
    const impacts = Array.isArray(option.impacts) ? option.impacts : [];
    if (impacts.length > ASSESSMENT_DEFINITION_LIMITS.impactsPerOption) {
      return `${label} option ${optionIndex + 1} has too many impacts.`;
    }
    for (const impact of impacts) {
      if (
        !isRecord(impact) ||
        typeof impact.competencyCode !== "string" ||
        !impact.competencyCode.trim() ||
        typeof impact.delta !== "number" ||
        !Number.isFinite(impact.delta)
      ) {
        return `${label} option ${optionIndex + 1} has an invalid competency impact.`;
      }
    }
  }

  return null;
}

export function validateAssessmentDefinition(input: unknown) {
  if (!isRecord(input)) return "Invalid assessment definition.";

  if (input.competencies !== undefined && !Array.isArray(input.competencies)) {
    return "competencies must be an array.";
  }
  if (
    Array.isArray(input.competencies) &&
    input.competencies.length > ASSESSMENT_DEFINITION_LIMITS.competencies
  ) {
    return `Use no more than ${ASSESSMENT_DEFINITION_LIMITS.competencies} competencies.`;
  }
  if (Array.isArray(input.competencies)) {
    for (let index = 0; index < input.competencies.length; index += 1) {
      const competency = input.competencies[index];
      if (
        !isRecord(competency) ||
        typeof competency.code !== "string" ||
        !competency.code.trim() ||
        typeof competency.name !== "string" ||
        !competency.name.trim()
      ) {
        return `Competency ${index + 1} requires a code and name.`;
      }
    }
  }

  if (input.sections !== undefined && !Array.isArray(input.sections)) {
    return "sections must be an array.";
  }
  if (input.questions !== undefined && !Array.isArray(input.questions)) {
    return "questions must be an array.";
  }

  const sections = Array.isArray(input.sections) ? input.sections : [];
  if (sections.length > ASSESSMENT_DEFINITION_LIMITS.sections) {
    return `Use no more than ${ASSESSMENT_DEFINITION_LIMITS.sections} sections.`;
  }

  let questionCount = 0;
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    if (!isRecord(section) || typeof section.title !== "string" || !section.title.trim()) {
      return `Section ${sectionIndex + 1} requires a title.`;
    }
    if (!Array.isArray(section.questions)) {
      return `Section ${sectionIndex + 1} questions must be an array.`;
    }
    questionCount += section.questions.length;
    if (questionCount > ASSESSMENT_DEFINITION_LIMITS.questions) {
      return `Use no more than ${ASSESSMENT_DEFINITION_LIMITS.questions.toLocaleString("en-US")} questions.`;
    }
    for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex += 1) {
      const error = validateQuestion(
        section.questions[questionIndex],
        `Section ${sectionIndex + 1}, question ${questionIndex + 1}`,
      );
      if (error) return error;
    }
  }

  const legacyQuestions = Array.isArray(input.questions) ? input.questions : [];
  questionCount += sections.length > 0 ? 0 : legacyQuestions.length;
  if (questionCount > ASSESSMENT_DEFINITION_LIMITS.questions) {
    return `Use no more than ${ASSESSMENT_DEFINITION_LIMITS.questions.toLocaleString("en-US")} questions.`;
  }
  if (sections.length === 0) {
    for (let index = 0; index < legacyQuestions.length; index += 1) {
      const error = validateQuestion(
        { ...(isRecord(legacyQuestions[index]) ? legacyQuestions[index] : {}), questionType: "LIKERT_TRAIT" },
        `Question ${index + 1}`,
      );
      if (error) return error;
    }
  }

  return null;
}
