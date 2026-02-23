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

export type TraitKey =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

export type TraitNarrative = {
  key: TraitKey;
  name: string;
  band: "high" | "moderate" | "emerging";
  summary: string;
  leverage: string;
  developmentFocus: string;
};

export type CompetencyTheme = {
  code: string;
  name: string;
  category: "strength" | "focus";
  insight: string;
};

export type GeneratedNarrative = {
  reportVersion: "v2";
  profileHeadline: string;
  summary: string;
  strengths: string[];
  growthAreas: string[];
  actions: string[];
  workplaceSignals: string[];
  reflectionPrompts: string[];
  managerDiscussionGuide: string[];
  traitNarratives: TraitNarrative[];
  competencyThemes: CompetencyTheme[];
  competencyBreakdown: CompetencyScore[];
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

const traitLabelByKey: Record<TraitKey, string> = {
  openness: "Openness",
  conscientiousness: "Conscientiousness",
  extraversion: "Extraversion",
  agreeableness: "Agreeableness",
  neuroticism: "Emotional Reactivity",
};

function toBand(value: number): "high" | "moderate" | "emerging" {
  if (value < 35) return "emerging";
  if (value < 70) return "moderate";
  return "high";
}

function buildTraitNarrative(key: TraitKey, value: number): TraitNarrative {
  const band = toBand(value);
  const name = traitLabelByKey[key];

  if (key === "openness") {
    if (band === "high") {
      return {
        key,
        name,
        band,
        summary:
          "Openness is high. You naturally explore unfamiliar ideas, challenge default assumptions, and connect patterns across domains.",
        leverage:
          "You create the most value in early-stage planning, innovation projects, and ambiguous problem framing where original thinking is required.",
        developmentFocus:
          "Protect execution quality by setting decision deadlines and converting exploratory thinking into clear implementation choices.",
      };
    }
    if (band === "moderate") {
      return {
        key,
        name,
        band,
        summary:
          "Openness is moderate. You balance curiosity with practicality and can evaluate new ideas without losing sight of proven methods.",
        leverage:
          "This profile is useful in cross-functional roles that require both experimentation and disciplined delivery.",
        developmentFocus:
          "Increase strategic range by intentionally testing one unfamiliar approach each cycle and documenting what worked.",
      };
    }
    return {
      key,
      name,
      band,
      summary:
        "Openness is emerging. You tend to trust known approaches and can provide stability when teams are tempted to change too quickly.",
      leverage:
        "This tendency works well in operational environments that require reliability, consistency, and risk control.",
      developmentFocus:
        "Build adaptability by running low-risk pilots and inviting one dissenting perspective before finalizing major decisions.",
    };
  }

  if (key === "conscientiousness") {
    if (band === "high") {
      return {
        key,
        name,
        band,
        summary:
          "Conscientiousness is high. You are likely to prioritize structure, follow-through, and quality standards even under pressure.",
        leverage:
          "You are strongest in roles where reliability, sequencing, and accountability are key to team confidence and delivery outcomes.",
        developmentFocus:
          "Guard against over-control by distinguishing critical standards from areas where faster iteration is acceptable.",
      };
    }
    if (band === "moderate") {
      return {
        key,
        name,
        band,
        summary:
          "Conscientiousness is moderate. You can plan effectively while still adapting to changing context when needed.",
        leverage:
          "This balance supports execution across dynamic projects where both structure and flexibility are required.",
        developmentFocus:
          "Create clearer weekly completion rituals to improve consistency on tasks that are important but not urgent.",
      };
    }
    return {
      key,
      name,
      band,
      summary:
        "Conscientiousness is emerging. You may move quickly but could lose momentum on detail tracking, sequencing, or closure.",
      leverage:
        "Speed and responsiveness can be an advantage in fast-moving environments where experimentation matters.",
      developmentFocus:
        "Reduce avoidable friction by using explicit milestone checkpoints, accountability partners, and pre-commitment deadlines.",
    };
  }

  if (key === "extraversion") {
    if (band === "high") {
      return {
        key,
        name,
        band,
        summary:
          "Extraversion is high. You are likely to engage quickly, energize group discussions, and influence through visible presence.",
        leverage:
          "You perform best in collaboration-heavy settings that require stakeholder alignment, facilitation, and momentum building.",
        developmentFocus:
          "Preserve listening depth by intentionally creating pauses for quieter contributors before final decisions are made.",
      };
    }
    if (band === "moderate") {
      return {
        key,
        name,
        band,
        summary:
          "Extraversion is moderate. You can engage confidently when needed while also operating independently and with focus.",
        leverage:
          "This range supports roles requiring both collaboration and individual execution, especially in mixed team settings.",
        developmentFocus:
          "Increase strategic visibility by selecting key moments to speak early and clarify priorities for the group.",
      };
    }
    return {
      key,
      name,
      band,
      summary:
        "Extraversion is emerging. You may prefer reflection before contribution and can bring depth to analysis and one-to-one work.",
      leverage:
        "This style is valuable in specialist roles that demand concentration, precision, and thoughtful preparation.",
      developmentFocus:
        "Strengthen influence by preparing concise talking points and participating earlier in high-impact meetings.",
    };
  }

  if (key === "agreeableness") {
    if (band === "high") {
      return {
        key,
        name,
        band,
        summary:
          "Agreeableness is high. You are likely to prioritize trust, cooperation, and relationship continuity during collaboration.",
        leverage:
          "This supports healthy team culture, conflict de-escalation, and strong peer partnerships across functions.",
        developmentFocus:
          "Avoid over-accommodation by pairing empathy with clear boundaries and explicit standards for accountability.",
      };
    }
    if (band === "moderate") {
      return {
        key,
        name,
        band,
        summary:
          "Agreeableness is moderate. You can collaborate constructively while still holding your point of view when necessary.",
        leverage:
          "This balance helps in decision environments that need both alignment and healthy challenge.",
        developmentFocus:
          "Strengthen influence by clarifying non-negotiables early and framing disagreement as a shared problem-solving effort.",
      };
    }
    return {
      key,
      name,
      band,
      summary:
        "Agreeableness is emerging. You may default to direct challenge, which can accelerate decisions but increase interpersonal friction.",
      leverage:
        "This tendency can be useful when difficult trade-offs or hard calls must be addressed quickly.",
      developmentFocus:
        "Increase long-term impact by calibrating tone, signaling intent, and checking understanding before pushing conclusions.",
    };
  }

  if (band === "high") {
    return {
      key,
      name,
      band,
      summary:
        "Emotional reactivity is elevated. Under uncertainty, your internal stress signal can activate quickly and shape decision quality.",
      leverage:
        "You are often sensitive to early risk indicators and can identify hidden concerns before they become visible to others.",
      developmentFocus:
        "Use short reset rituals, clearer prioritization, and explicit escalation paths to keep responses proportionate under pressure.",
    };
  }
  if (band === "moderate") {
    return {
      key,
      name,
      band,
      summary:
        "Emotional reactivity is moderate. Your pressure response is generally manageable, though consistency may vary by context.",
      leverage:
        "You can relate to stressed teammates while still maintaining a practical level of task orientation.",
      developmentFocus:
        "Improve consistency by identifying trigger patterns and agreeing on recovery routines before high-stress events.",
    };
  }
  return {
    key,
    name,
    band,
    summary:
      "Emotional steadiness is strong. You are likely to remain composed in turbulence and support clear thinking during disruption.",
    leverage:
      "This is especially valuable in crisis handling, complex stakeholder situations, and sustained execution under ambiguity.",
    developmentFocus:
      "Ensure urgency is visible to others so calm communication is not misread as low intensity or low commitment.",
  };
}

function deriveProfileHeadline(traits: TraitScores) {
  if (traits.openness >= 70 && traits.conscientiousness >= 70) {
    return "Strategic Innovator";
  }
  if (traits.conscientiousness >= 70 && traits.agreeableness >= 60) {
    return "Trusted Execution Partner";
  }
  if (traits.extraversion >= 70 && traits.openness >= 60) {
    return "Catalyst Communicator";
  }
  if (traits.agreeableness >= 70 && traits.neuroticism <= 40) {
    return "Stability Builder";
  }
  if (traits.neuroticism >= 70) {
    return "High-Alert Problem Solver";
  }
  return "Adaptive Contributor";
}

function buildCompetencyThemes(competencies: CompetencyScore[]): CompetencyTheme[] {
  const strengthThemes = competencies
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item) => ({
      code: item.code,
      name: item.name,
      category: "strength" as const,
      insight: `${item.name} emerged as a repeated strength pattern in situational choices. This typically shows up when trade-offs are ambiguous and collaborative judgment is required.`,
    }));

  const focusThemes = [...competencies]
    .reverse()
    .filter((item) => item.score < 0)
    .slice(0, 3)
    .map((item) => ({
      code: item.code,
      name: item.name,
      category: "focus" as const,
      insight: `${item.name} appears as a high-leverage development theme. Under pressure, decisions in this area may default to short-term resolution instead of durable outcomes.`,
    }));

  const themes = [...strengthThemes, ...focusThemes];
  if (themes.length > 0) return themes;

  return [
    {
      code: "collaboration",
      name: "Collaboration",
      category: "strength",
      insight:
        "Scenario choices indicate a generally balanced collaboration style that can be strengthened further through deliberate feedback loops.",
    },
    {
      code: "accountability",
      name: "Accountability",
      category: "focus",
      insight:
        "A practical growth focus is increasing consistency in follow-through when priorities compete or timelines shift.",
    },
  ];
}

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
): GeneratedNarrative {
  const traitNarratives = traitKeys.map((key) => buildTraitNarrative(key, traits[key]));
  const competencyThemes = buildCompetencyThemes(competencies);

  const strengthRank = (trait: TraitNarrative) =>
    trait.key === "neuroticism" ? 100 - traits.neuroticism : traits[trait.key];
  const growthRank = (trait: TraitNarrative) =>
    trait.key === "neuroticism" ? traits.neuroticism : 100 - traits[trait.key];

  const topTraitStrengths = [...traitNarratives]
    .sort((a, b) => strengthRank(b) - strengthRank(a))
    .slice(0, 2);

  const topTraitGrowth = [...traitNarratives]
    .sort((a, b) => growthRank(b) - growthRank(a))
    .slice(0, 2);

  const strengthThemes = competencyThemes.filter((theme) => theme.category === "strength");
  const focusThemes = competencyThemes.filter((theme) => theme.category === "focus");

  const primaryStrength = topTraitStrengths[0]?.name || "your strongest traits";
  const secondaryStrength = topTraitStrengths[1]?.name || "your supporting tendencies";
  const mainGrowth = topTraitGrowth[0]?.name || "your highest leverage growth area";
  const secondaryGrowth = topTraitGrowth[1]?.name || "your secondary growth area";

  return {
    reportVersion: "v2",
    profileHeadline: deriveProfileHeadline(traits),
    summary:
      "This report translates your responses into a practical workstyle map. It combines stable personality tendencies with scenario decisions to clarify where you are likely to create value quickly, where friction may appear, and which habits can increase your consistency over the next quarter.",
    strengths: [
      ...topTraitStrengths.map(
        (trait) => `${trait.name}: ${trait.summary} ${trait.leverage}`,
      ),
      ...strengthThemes.slice(0, 2).map((theme) => `${theme.name}: ${theme.insight}`),
      `Integrated advantage: ${primaryStrength} and ${secondaryStrength} together can help you balance strategic intent with day-to-day execution across cross-team work.`,
    ],
    growthAreas: [
      ...topTraitGrowth.map(
        (trait) => `${trait.name}: ${trait.summary} ${trait.developmentFocus}`,
      ),
      ...focusThemes.slice(0, 2).map((theme) => `${theme.name}: ${theme.insight}`),
      `Growth priority: improve ${mainGrowth} first, then reinforce ${secondaryGrowth} so development gains translate into predictable team outcomes.`,
    ],
    actions: [
      "Select one high-impact project and define two observable behaviors that will demonstrate your strongest patterns in visible ways.",
      "Identify one recurring trigger that affects your weakest pattern and write a simple response protocol for in-the-moment use.",
      "Request short feedback check-ins from colleagues who regularly see your work under pressure.",
      "Convert feedback into one measurable weekly commitment tied to response quality, decision clarity, or follow-through reliability.",
      "Practice one stretch behavior in real meetings and track what changed in team response and outcome quality.",
      "Add a post-project reflection routine: what created momentum, what introduced friction, and what to repeat next cycle.",
      "Recalibrate with your manager on role expectations and align upcoming goals to your strongest value-creation patterns.",
      "Review progress against behavior commitments and carry forward the two habits with the highest observed impact.",
    ],
    workplaceSignals: [
      `Decision pattern: You are likely to make stronger decisions when curiosity and structure are both active, with explicit trade-offs and clear ownership.`,
      `Collaboration pattern: You create momentum when you balance directness with empathy, especially in cross-functional conversations.`,
      `Pressure pattern: Your consistency improves when expectations, escalation paths, and recovery routines are agreed before high-stakes work begins.`,
      `Leadership pattern: Influence increases when your strongest trait signals are intentional and visible in day-to-day execution.`,
    ],
    reflectionPrompts: [
      "Which part of your current role most rewards your strongest traits, and which part consistently exposes your growth edges?",
      "In the last month, where did your default style help outcomes, and where did it create avoidable friction?",
      "What one behavior change would make your strengths more visible to stakeholders who matter most?",
      "What support, boundary, or routine would make your development goal easier to sustain for a full quarter?",
    ],
    managerDiscussionGuide: [
      "Clarify what excellent performance looks like in this role and map it to two behaviors this report highlights.",
      "Agree on one strength behavior to amplify and one growth behavior to monitor every week.",
      "Use specific project examples during check-ins instead of general feedback so improvement can be measured.",
      "Reassess after one quarter and decide whether goals should deepen, broaden, or shift based on observed evidence.",
    ],
    traitNarratives,
    competencyThemes,
    competencyBreakdown: competencies,
  };
}
