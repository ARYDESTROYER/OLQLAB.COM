import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { recommendedTemplate40 } from "../../src/lib/recommended-template";

type SectionPayload = {
  title: string;
  kind: "PERSONALITY" | "SCENARIO";
  questions: Array<{
    code: string;
    prompt: string;
    category: string;
    questionType: "LIKERT_TRAIT" | "SJT_SINGLE";
    trait?: string;
    reverse: boolean;
    scaleMin: number;
    scaleMax: number;
    options?: Array<{
      text: string;
      impacts?: Array<{ competencyCode: string; delta: number }>;
    }>;
  }>;
};

function normalizeCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");
}

function parseImpacts(raw: string) {
  return raw
    .split(/[|,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((token) => {
      const [code, delta] = token.split(":");
      return {
        competencyCode: normalizeCode(code || ""),
        delta: Number(delta),
      };
    })
    .filter((item) => item.competencyCode && Number.isFinite(item.delta));
}

const sectionMap = new Map<string, SectionPayload>();

for (const question of recommendedTemplate40.questions) {
  const key = `${question.sectionKind}::${question.sectionTitle}`;
  const existing = sectionMap.get(key);

  const payloadQuestion = {
    code: question.code,
    prompt: question.prompt,
    category: question.category,
    questionType: question.type,
    trait: question.trait || undefined,
    reverse: question.reverse,
    scaleMin: question.scaleMin,
    scaleMax: question.scaleMax,
    options:
      question.type === "SJT_SINGLE"
        ? question.options.map((option) => ({
            text: option.text,
            impacts: parseImpacts(option.impacts),
          }))
        : undefined,
  };

  if (!existing) {
    sectionMap.set(key, {
      title: question.sectionTitle,
      kind: question.sectionKind,
      questions: [payloadQuestion],
    });
    continue;
  }

  existing.questions.push(payloadQuestion);
}

const payload = {
  title: "Wisses Leadership Assessment",
  competencies: recommendedTemplate40.competencies.map((item) => ({
    code: item.code,
    name: item.name,
    description: item.description,
  })),
  sections: Array.from(sectionMap.values()),
  policy: {
    showResultsToEmployee: true,
    resultReleaseDelayHours: 0,
    postSubmitMessage: "Thanks for completing your assessment.",
    leaderCanViewFullReport: true,
  },
};

const outPath = resolve(process.cwd(), "already", "wisses-leadership-assessment-upload.json");
writeFileSync(outPath, JSON.stringify(payload, null, 2));

console.log(`Wrote upload payload to ${outPath}`);
