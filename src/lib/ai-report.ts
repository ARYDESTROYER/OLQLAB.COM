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
  const topCompetencies = competencies.slice(0, 3).map((item) => item.name).join(", ");
  const riskCompetencies = [...competencies]
    .reverse()
    .slice(0, 2)
    .map((item) => item.name)
    .join(", ");

  return {
    executiveSummary:
      "The profile indicates a blend of stable personality tendencies and practical behavior signals in real workplace scenarios.",
    strengthsNarrative: `Top emerging behavioral strengths include ${topCompetencies || "collaboration and adaptability"}.`,
    developmentNarrative: `Primary development focus areas include ${riskCompetencies || "emotional regulation and communication consistency"}.`,
    managerCoaching:
      "Use specific weekly behavioral targets, frequent feedback loops, and role-play on high-stakes collaboration situations.",
    improvementRoadmap: [
      "Set one measurable behavior goal for the next 2 weeks.",
      "Gather manager and peer feedback after one major collaboration event.",
      "Repeat assessment in 8-12 weeks to track directional change.",
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
      "Create a professional, development-focused workplace personality report segment. No medical or clinical language.",
  };

  try {
    const response = await client.responses.create({
      model,
      temperature: 0.3,
      max_output_tokens: 1300,
      input: [
        {
          role: "system",
          content:
            "You are an organizational psychologist writing corporate development feedback. Return strictly valid JSON only.",
        },
        {
          role: "user",
          content: `Return JSON with keys: executiveSummary, strengthsNarrative, developmentNarrative, managerCoaching, improvementRoadmap (array of 3-6 strings), cautionNotes (array of 2-4 strings). Data: ${JSON.stringify(
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
