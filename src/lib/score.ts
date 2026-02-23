import { Question } from "@prisma/client";

type TraitScores = {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
};

const traits = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
] as const;

export function computeScores(
  questions: Question[],
  answers: Record<string, number>,
): TraitScores {
  const totals: Record<string, { sum: number; count: number }> = {};

  for (const trait of traits) {
    totals[trait] = { sum: 0, count: 0 };
  }

  for (const q of questions) {
    const answer = answers[q.id];
    if (!answer) continue;
    const value = q.reverse ? 6 - answer : answer;
    totals[q.trait].sum += value;
    totals[q.trait].count += 1;
  }

  const normalize = (sum: number, count: number) =>
    count === 0 ? 0 : Math.round((sum / (count * 5)) * 100);

  return {
    openness: normalize(totals.openness.sum, totals.openness.count),
    conscientiousness: normalize(
      totals.conscientiousness.sum,
      totals.conscientiousness.count,
    ),
    extraversion: normalize(totals.extraversion.sum, totals.extraversion.count),
    agreeableness: normalize(totals.agreeableness.sum, totals.agreeableness.count),
    neuroticism: normalize(totals.neuroticism.sum, totals.neuroticism.count),
  };
}

export function generateNarrative(scores: TraitScores) {
  const toBand = (value: number) => {
    if (value < 35) return "low";
    if (value < 70) return "moderate";
    return "high";
  };

  return {
    summary: "Your personality pattern reflects a blend of stable tendencies you can develop over time.",
    strengths: [
      `Openness is ${toBand(scores.openness)} (${scores.openness}/100).`,
      `Conscientiousness is ${toBand(scores.conscientiousness)} (${scores.conscientiousness}/100).`,
      `Extraversion is ${toBand(scores.extraversion)} (${scores.extraversion}/100).`,
    ],
    growthAreas: [
      `Agreeableness is ${toBand(scores.agreeableness)} (${scores.agreeableness}/100).`,
      `Neuroticism is ${toBand(scores.neuroticism)} (${scores.neuroticism}/100).`,
    ],
    actions: [
      "Pick one weekly behavior goal and track consistency for 4 weeks.",
      "Ask your manager for one concrete feedback point after major collaboration tasks.",
      "Re-take the assessment in 8-12 weeks to review change trends.",
    ],
  };
}
