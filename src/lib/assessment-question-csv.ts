import { parse } from "csv-parse/sync";
import { normalizeQuestionImageUrl } from "@/lib/question-image-policy";

export const ASSESSMENT_CSV_HEADERS = [
  "section_title",
  "section_kind",
  "question_code",
  "prompt",
  "image_url",
  "image_alt",
  "image_caption",
  "question_type",
  "category",
  "trait",
  "reverse",
  "scale_min",
  "scale_max",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "option_e",
  "impacts_a",
  "impacts_b",
  "impacts_c",
  "impacts_d",
  "impacts_e",
] as const;

const validQuestionTypes = new Set(["LIKERT_TRAIT", "SJT_SINGLE", "FREE_TEXT"] as const);
const validSectionKinds = new Set(["PERSONALITY", "SCENARIO"] as const);

type QuestionType = "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";
type SectionKind = "PERSONALITY" | "SCENARIO";

export type CsvIssue = {
  row: number;
  column?: string;
  code:
    | "MISSING_HEADER"
    | "INVALID_VALUE"
    | "DUPLICATE_CODE"
    | "MISSING_REQUIRED"
    | "FILE_LIMIT"
    | "PARSE_ERROR";
  message: string;
};

export type ImportedOptionImpact = {
  competencyCode: string;
  delta: number;
};

export type ImportedOption = {
  code: string;
  text: string;
  impacts: ImportedOptionImpact[];
};

export type ImportedQuestionRow = {
  rowNumber: number;
  sectionTitle: string;
  sectionKind: SectionKind;
  questionCode: string;
  prompt: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageCaption: string | null;
  questionType: QuestionType;
  category: string | null;
  trait: string | null;
  reverse: boolean;
  scaleMin: number;
  scaleMax: number;
  options: ImportedOption[];
};

export type CsvParseResult = {
  rows: ImportedQuestionRow[];
  issues: CsvIssue[];
  summary: {
    sections: number;
    questions: number;
    questionTypes: {
      likert: number;
      sjt: number;
      freeText: number;
    };
    competencies: number;
    sectionTitles: string[];
  };
};

function normalizeCompetencyCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");
}

function toBoolean(raw: string, row: number, issues: CsvIssue[]) {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return false;
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  issues.push({
    row,
    column: "reverse",
    code: "INVALID_VALUE",
    message: `Invalid boolean value "${raw}" for reverse. Use true/false or 1/0.`,
  });
  return false;
}

function toNumber(
  raw: string,
  fallback: number,
  row: number,
  column: "scale_min" | "scale_max",
  issues: CsvIssue[],
) {
  const value = raw.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    issues.push({
      row,
      column,
      code: "INVALID_VALUE",
      message: `Invalid numeric value "${raw}" for ${column}.`,
    });
    return fallback;
  }
  return parsed;
}

export function buildAssessmentCsvTemplate() {
  const header = ASSESSMENT_CSV_HEADERS.join(",");
  const sampleLikert = [
    "Cognitive Orientation",
    "PERSONALITY",
    "Q1",
    "I plan my day before I start work.",
    "",
    "",
    "",
    "LIKERT_TRAIT",
    "Cognitive Orientation",
    "conscientiousness",
    "false",
    "1",
    "5",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ].join(",");
  const sampleSjt = [
    "Response Orientation",
    "SCENARIO",
    "Q31",
    "A teammate misses a deadline. What do you do first?",
    "/question-images/q31-missed-deadline.png",
    "Illustration of a teammate missing a deadline on a project board",
    "Use the situation shown in the image to guide your response.",
    "SJT_SINGLE",
    "Response Orientation",
    "",
    "false",
    "1",
    "1",
    "Ask for blockers",
    "Escalate immediately",
    "Ignore it",
    "",
    "",
    "problem_solving:2|collaboration:1",
    "assertiveness:1",
    "",
    "",
    "",
  ].join(",");
  const sampleFreeText = [
    "Word Association",
    "PERSONALITY",
    "Q56",
    "Write the first word that comes to mind when you read 'Leadership'.",
    "/question-images/q56-leadership-cue.png",
    "Leadership-themed visual prompt",
    "Respond to both the word and the image.",
    "FREE_TEXT",
    "Word Association",
    "",
    "false",
    "1",
    "1",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ].join(",");

  return [header, sampleLikert, sampleSjt, sampleFreeText].join("\n");
}

export function parseAssessmentQuestionCsv(
  csvText: string,
  options?: {
    maxRows?: number;
  },
): CsvParseResult {
  const maxRows = options?.maxRows ?? 1000;
  const issues: CsvIssue[] = [];

  if (!csvText.trim()) {
    return {
      rows: [],
      issues: [
        {
          row: 1,
          code: "PARSE_ERROR",
          message: "CSV is empty.",
        },
      ],
      summary: {
        sections: 0,
        questions: 0,
        questionTypes: { likert: 0, sjt: 0, freeText: 0 },
        competencies: 0,
        sectionTitles: [],
      },
    };
  }

  let records: Array<Record<string, string>> = [];
  let normalizedHeaders: string[] = [];
  try {
    const headerRows = parse(csvText, {
      to_line: 1,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];
    normalizedHeaders = (headerRows[0] || []).map((column) => column.trim().toLowerCase());

    records = parse(csvText, {
      columns: (header: string[]) => header.map((column) => column.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;
  } catch (error) {
    return {
      rows: [],
      issues: [
        {
          row: 1,
          code: "PARSE_ERROR",
          message:
            error instanceof Error
              ? `Unable to parse CSV: ${error.message}`
              : "Unable to parse CSV.",
        },
      ],
      summary: {
        sections: 0,
        questions: 0,
        questionTypes: { likert: 0, sjt: 0, freeText: 0 },
        competencies: 0,
        sectionTitles: [],
      },
    };
  }

  if (records.length > maxRows) {
    issues.push({
      row: 1,
      code: "FILE_LIMIT",
      message: `CSV has ${records.length} rows. Maximum supported rows: ${maxRows}.`,
    });
  }

  const headerSet = new Set(normalizedHeaders);
  for (const requiredHeader of ASSESSMENT_CSV_HEADERS) {
    if (!headerSet.has(requiredHeader)) {
      issues.push({
        row: 1,
        column: requiredHeader,
        code: "MISSING_HEADER",
        message: `Missing required header: ${requiredHeader}.`,
      });
    }
  }

  const rows: ImportedQuestionRow[] = [];
  const seenQuestionCodes = new Map<string, number>();
  const sectionOrder: string[] = [];
  const sectionSeen = new Set<string>();
  const competencies = new Set<string>();

  records.forEach((record, index) => {
    const rowNumber = index + 2;

    const sectionTitle = (record.section_title || "").trim();
    const sectionKindRaw = (record.section_kind || "PERSONALITY").trim().toUpperCase();
    const questionCode = (record.question_code || "").trim();
    const prompt = (record.prompt || "").trim();
    const imageUrlInput = (record.image_url || "").trim();
    const imageUrl = normalizeQuestionImageUrl(imageUrlInput);
    const imageAlt = (record.image_alt || "").trim();
    const imageCaption = (record.image_caption || "").trim();
    const questionTypeRaw = (record.question_type || "LIKERT_TRAIT").trim().toUpperCase();
    const category = (record.category || "").trim();
    const trait = (record.trait || "").trim().toLowerCase();

    if (!sectionTitle) {
      issues.push({
        row: rowNumber,
        column: "section_title",
        code: "MISSING_REQUIRED",
        message: "section_title is required.",
      });
    }

    const sectionKind: SectionKind = validSectionKinds.has(sectionKindRaw as SectionKind)
      ? (sectionKindRaw as SectionKind)
      : "PERSONALITY";
    if (!validSectionKinds.has(sectionKindRaw as SectionKind)) {
      issues.push({
        row: rowNumber,
        column: "section_kind",
        code: "INVALID_VALUE",
        message: `Invalid section_kind "${record.section_kind}". Use PERSONALITY or SCENARIO.`,
      });
    }

    if (!questionCode) {
      issues.push({
        row: rowNumber,
        column: "question_code",
        code: "MISSING_REQUIRED",
        message: "question_code is required.",
      });
    } else {
      const normalizedCode = questionCode.toLowerCase();
      const firstRow = seenQuestionCodes.get(normalizedCode);
      if (typeof firstRow === "number") {
        issues.push({
          row: rowNumber,
          column: "question_code",
          code: "DUPLICATE_CODE",
          message: `question_code "${questionCode}" duplicates row ${firstRow}.`,
        });
      } else {
        seenQuestionCodes.set(normalizedCode, rowNumber);
      }
    }

    if (!prompt) {
      issues.push({
        row: rowNumber,
        column: "prompt",
        code: "MISSING_REQUIRED",
        message: "prompt is required.",
      });
    }

    if (!imageUrl && (imageAlt || imageCaption)) {
      issues.push({
        row: rowNumber,
        column: imageAlt ? "image_alt" : "image_caption",
        code: "INVALID_VALUE",
        message: "image_alt and image_caption require image_url.",
      });
    }

    if (imageUrlInput && !imageUrl) {
      issues.push({
        row: rowNumber,
        column: "image_url",
        code: "INVALID_VALUE",
        message:
          "image_url must use /question-images/ or an OLQ Lab managed Vercel Blob URL.",
      });
    }

    const questionType: QuestionType = validQuestionTypes.has(questionTypeRaw as QuestionType)
      ? (questionTypeRaw as QuestionType)
      : "LIKERT_TRAIT";
    if (!validQuestionTypes.has(questionTypeRaw as QuestionType)) {
      issues.push({
        row: rowNumber,
        column: "question_type",
        code: "INVALID_VALUE",
        message: `Invalid question_type "${record.question_type}". Use LIKERT_TRAIT, SJT_SINGLE, or FREE_TEXT.`,
      });
    }

    const reverse = toBoolean(record.reverse || "", rowNumber, issues);

    const defaultScaleMin = questionType === "LIKERT_TRAIT" ? 1 : 1;
    const defaultScaleMax = questionType === "LIKERT_TRAIT" ? 5 : 1;
    const scaleMin = toNumber(record.scale_min || "", defaultScaleMin, rowNumber, "scale_min", issues);
    const scaleMax = toNumber(record.scale_max || "", defaultScaleMax, rowNumber, "scale_max", issues);

    if (scaleMin > scaleMax) {
      issues.push({
        row: rowNumber,
        column: "scale_min",
        code: "INVALID_VALUE",
        message: "scale_min cannot be greater than scale_max.",
      });
    }

    const optionsForQuestion: ImportedOption[] = [];
    ["a", "b", "c", "d", "e"].forEach((letter, optionIndex) => {
      const optionText = (record[`option_${letter}`] || "").trim();
      const impactsRaw = (record[`impacts_${letter}`] || "").trim();

      if (!optionText && impactsRaw) {
        issues.push({
          row: rowNumber,
          column: `impacts_${letter}`,
          code: "INVALID_VALUE",
          message: `impacts_${letter} provided without option_${letter}.`,
        });
        return;
      }

      if (!optionText) return;

      const impacts: ImportedOptionImpact[] = [];
      if (impactsRaw) {
        impactsRaw
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((token) => {
            const [rawCode, rawDelta] = token.split(":");
            const competencyCode = normalizeCompetencyCode(rawCode || "");
            const delta = Number(rawDelta);

            if (!competencyCode || !Number.isFinite(delta)) {
              issues.push({
                row: rowNumber,
                column: `impacts_${letter}`,
                code: "INVALID_VALUE",
                message: `Invalid impact token "${token}". Use competency_code:delta (example: collaboration:1).`,
              });
              return;
            }

            competencies.add(competencyCode);
            impacts.push({ competencyCode, delta });
          });
      }

      optionsForQuestion.push({
        code: String.fromCharCode(65 + optionIndex),
        text: optionText,
        impacts,
      });
    });

    if (questionType === "SJT_SINGLE" && optionsForQuestion.length < 2) {
      issues.push({
        row: rowNumber,
        column: "option_a",
        code: "INVALID_VALUE",
        message: "SJT_SINGLE questions require at least two options.",
      });
    }

    if (questionType === "FREE_TEXT" && optionsForQuestion.length > 0) {
      issues.push({
        row: rowNumber,
        column: "option_a",
        code: "INVALID_VALUE",
        message: "FREE_TEXT questions cannot include options.",
      });
    }

    if (questionType === "LIKERT_TRAIT" && optionsForQuestion.length > 0) {
      issues.push({
        row: rowNumber,
        column: "option_a",
        code: "INVALID_VALUE",
        message: "LIKERT_TRAIT questions cannot include options in CSV import.",
      });
    }

    rows.push({
      rowNumber,
      sectionTitle,
      sectionKind,
      questionCode,
      prompt,
      imageUrl,
      imageAlt: imageAlt || null,
      imageCaption: imageCaption || null,
      questionType,
      category: category || null,
      trait: trait || null,
      reverse,
      scaleMin,
      scaleMax,
      options: optionsForQuestion,
    });

    const sectionKey = `${sectionKind}::${sectionTitle}`;
    if (sectionTitle && !sectionSeen.has(sectionKey)) {
      sectionSeen.add(sectionKey);
      sectionOrder.push(sectionTitle);
    }
  });

  return {
    rows,
    issues,
    summary: {
      sections: sectionOrder.length,
      questions: rows.length,
      questionTypes: {
        likert: rows.filter((row) => row.questionType === "LIKERT_TRAIT").length,
        sjt: rows.filter((row) => row.questionType === "SJT_SINGLE").length,
        freeText: rows.filter((row) => row.questionType === "FREE_TEXT").length,
      },
      competencies: competencies.size,
      sectionTitles: sectionOrder,
    },
  };
}
