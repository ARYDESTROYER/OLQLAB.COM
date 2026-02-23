import OpenAI from "openai";
import type { CompetencyScore, TraitScores } from "@/lib/score";

export type AiNarrative = {
  executiveSummary: string;
  strengthsNarrative: string;
  developmentNarrative: string;
  managerCoaching: string;
  improvementRoadmap: string[];
  cautionNotes: string[];
};

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function fallbackNarrative(traits: TraitScores, competencies: CompetencyScore[]): AiNarrative {
  const topCompetencies = competencies
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item) => item.name)
    .join(", ");
  const riskCompetencies = [...competencies]
    .reverse()
    .filter((item) => item.score < 0)
    .slice(0, 3)
    .map((item) => item.name)
    .join(", ");

  const opennessSignal = traits.openness >= 70 ? "high" : traits.openness >= 35 ? "moderate" : "emerging";
  const conscientiousSignal =
    traits.conscientiousness >= 70 ? "high" : traits.conscientiousness >= 35 ? "moderate" : "emerging";

  return {
    executiveSummary:
      "The profile shows a practical blend of personality tendencies and scenario behavior patterns, with clear opportunities to increase role impact through intentional habit design over the next quarter.",
    strengthsNarrative: `Openness appears ${opennessSignal} and conscientiousness appears ${conscientiousSignal}, suggesting strong potential to pair creative problem framing with disciplined execution. Scenario choices further indicate momentum in ${topCompetencies || "collaboration and adaptability"}, which can be amplified by assigning this person to cross-functional projects with visible ownership.`,
    developmentNarrative: `The primary growth edge is improving consistency under pressure while maintaining relationship quality in difficult trade-offs. Focus areas include ${riskCompetencies || "communication consistency and accountability follow-through"}, with best results likely from short behavior cycles, rapid feedback, and explicit pre-commitments before high-stakes moments.`,
    managerCoaching:
      "Use a weekly 15-minute coaching cadence focused on one observable strength behavior and one observable stretch behavior. Anchor discussions in recent project moments, name what changed, and agree the next experiment before closing the conversation.",
    improvementRoadmap: [
      "Define one measurable behavior target for weeks 1-2 and capture baseline examples.",
      "Run one stretch experiment in a live project each week for weeks 3-6.",
      "Collect concise manager and peer feedback after each key collaboration moment.",
      "Lock two repeatable habits by week 8 and review outcomes by week 12.",
    ],
    cautionNotes: [
      "Assessment output is developmental, not diagnostic.",
      "Interpret results alongside observed behavior and context.",
    ],
  };
}

export async function generateAiNarrative(
  traits: TraitScores,
  competencies: CompetencyScore[],
  context: {
    fullName: string;
    email: string;
    assessmentTitle: string;
  },
): Promise<AiNarrative | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.REPORT_LLM_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const inputPayload = {
    person: context,
    traitScores: traits,
    competencyScores: competencies,
    instruction:
      "Create a professional, development-focused workplace narrative. Avoid medical language and avoid reporting numeric scores in the narrative.",
  };

  try {
    const response = await client.responses.create({
      model,
      temperature: 0.3,
      max_output_tokens: 1700,
      input: [
        {
          role: "system",
          content:
            "You are an organizational psychologist writing premium corporate development feedback. Return strictly valid JSON only.",
        },
        {
          role: "user",
          content: `Return JSON with keys: executiveSummary, strengthsNarrative, developmentNarrative, managerCoaching, improvementRoadmap (array of 3-6 strings), cautionNotes (array of 2-4 strings). Rules: do not include numeric scores or percentages, do not mention AI, and provide concrete workplace examples. Data: ${JSON.stringify(
            inputPayload,
          )}`,
        },
      ],
    });

    const text = response.output_text || "";
    const parsed = parseJson(text);

    if (!parsed) {
      return fallbackNarrative(traits, competencies);
    }

    return {
      executiveSummary:
        parsed.executiveSummary || fallbackNarrative(traits, competencies).executiveSummary,
      strengthsNarrative:
        parsed.strengthsNarrative || fallbackNarrative(traits, competencies).strengthsNarrative,
      developmentNarrative:
        parsed.developmentNarrative ||
        fallbackNarrative(traits, competencies).developmentNarrative,
      managerCoaching:
        parsed.managerCoaching || fallbackNarrative(traits, competencies).managerCoaching,
      improvementRoadmap: Array.isArray(parsed.improvementRoadmap)
        ? parsed.improvementRoadmap.slice(0, 6).map(String)
        : fallbackNarrative(traits, competencies).improvementRoadmap,
      cautionNotes: Array.isArray(parsed.cautionNotes)
        ? parsed.cautionNotes.slice(0, 4).map(String)
        : fallbackNarrative(traits, competencies).cautionNotes,
    };
  } catch {
    return fallbackNarrative(traits, competencies);
  }
}
