import { QuestionType } from "@prisma/client";

export type TraitScores = {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
};

export type CompetencyScore = {
  code: string;
  name: string;
  score: number;
};

type ScoringQuestion = {
  id: string;
  questionType: QuestionType;
  trait: string | null;
  reverse: boolean;
  scaleMin: number;
  scaleMax: number;
  options: Array<{
    id: string;
    impacts: Array<{
      delta: number;
      competency: {
        code: string;
        name: string;
      };
    }>;
  }>;
};

type ScoringAnswer = {
  questionId: string;
  value: number | null;
  optionId: string | null;
};

const traitKeys = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
] as const;

function normalizeTrait(value: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  return traitKeys.includes(normalized as (typeof traitKeys)[number])
    ? (normalized as (typeof traitKeys)[number])
    : null;
}

export function computeScores(
  questions: ScoringQuestion[],
  answers: ScoringAnswer[],
): {
  traits: TraitScores;
  competencies: CompetencyScore[];
} {
  const traitTotals: Record<string, { sum: number; count: number }> = {};
  for (const key of traitKeys) traitTotals[key] = { sum: 0, count: 0 };

  const competencyMap = new Map<string, { code: string; name: string; score: number }>();
  const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

  for (const question of questions) {
    const answer = answersByQuestion.get(question.id);
    if (!answer) continue;

    if (question.questionType === "LIKERT_TRAIT") {
      if (typeof answer.value !== "number") continue;
      const trait = normalizeTrait(question.trait);
      if (!trait) continue;

      const min = question.scaleMin ?? 1;
      const max = question.scaleMax ?? 5;
      if (max <= min) continue;

      const clamped = Math.max(min, Math.min(max, answer.value));
      const adjusted = question.reverse ? max - (clamped - min) : clamped;
      const normalized = (adjusted - min) / (max - min);

      traitTotals[trait].sum += normalized;
      traitTotals[trait].count += 1;
      continue;
    }

    if (question.questionType === "SJT_SINGLE") {
      if (!answer.optionId) continue;
      const option = question.options.find((item) => item.id === answer.optionId);
      if (!option) continue;

      for (const impact of option.impacts) {
        const existing = competencyMap.get(impact.competency.code) || {
          code: impact.competency.code,
          name: impact.competency.name,
          score: 0,
        };
        existing.score += impact.delta;
        competencyMap.set(impact.competency.code, existing);
      }
    }
  }

  const toPct = (sum: number, count: number) =>
    count === 0 ? 0 : Math.round((sum / count) * 100);

  const traits: TraitScores = {
    openness: toPct(traitTotals.openness.sum, traitTotals.openness.count),
    conscientiousness: toPct(
      traitTotals.conscientiousness.sum,
      traitTotals.conscientiousness.count,
    ),
    extraversion: toPct(traitTotals.extraversion.sum, traitTotals.extraversion.count),
    agreeableness: toPct(traitTotals.agreeableness.sum, traitTotals.agreeableness.count),
    neuroticism: toPct(traitTotals.neuroticism.sum, traitTotals.neuroticism.count),
  };

  const competencies = [...competencyMap.values()].sort((a, b) => b.score - a.score);

  return { traits, competencies };
}

export function generateNarrative(
  traits: TraitScores,
  competencies: CompetencyScore[],
) {
  const toBand = (value: number) => {
    if (value < 35) return "low";
    if (value < 70) return "moderate";
    return "high";
  };

  const strengths = [
    `Openness is ${toBand(traits.openness)} (${traits.openness}/100).`,
    `Conscientiousness is ${toBand(traits.conscientiousness)} (${traits.conscientiousness}/100).`,
    `Extraversion is ${toBand(traits.extraversion)} (${traits.extraversion}/100).`,
  ];

  const competencyStrengths = competencies
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item) => `${item.name}: ${item.score > 0 ? "+" : ""}${item.score}`);

  const competencyGrowth = [...competencies]
    .reverse()
    .filter((item) => item.score < 0)
    .slice(0, 3)
    .map((item) => `${item.name}: ${item.score}`);

  return {
    summary:
      "Your profile combines trait tendencies with situational behavior choices. Use both to guide development goals.",
    strengths: [...strengths, ...competencyStrengths],
    growthAreas: [
      `Agreeableness is ${toBand(traits.agreeableness)} (${traits.agreeableness}/100).`,
      `Neuroticism is ${toBand(traits.neuroticism)} (${traits.neuroticism}/100).`,
      ...competencyGrowth,
    ],
    actions: [
      "Choose one strength to leverage intentionally in your next cross-team project.",
      "Pick one growth area and define a weekly behavior target for 4 weeks.",
      "Ask your leader for feedback on one competency in real scenarios.",
    ],
    competencyBreakdown: competencies,
  };
}
