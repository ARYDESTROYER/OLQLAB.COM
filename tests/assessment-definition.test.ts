import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_DEFINITION_LIMITS,
  resolveQuestionScale,
  validateAssessmentDefinition,
} from "@/lib/assessment-definition";

describe("nested assessment definition validation", () => {
  it("accepts a bounded valid nested definition", () => {
    expect(
      validateAssessmentDefinition({
        sections: [
          {
            title: "Scenarios",
            questions: [
              {
                prompt: "What would you do?",
                questionType: "SJT_SINGLE",
                imageUrl: "/question-images/scenario.png",
                options: [{ text: "Listen" }, { text: "Escalate" }],
              },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects unsafe images and invalid scenario definitions before writes begin", () => {
    expect(
      validateAssessmentDefinition({
        sections: [
          {
            title: "Scenarios",
            questions: [
              {
                prompt: "What would you do?",
                questionType: "SJT_SINGLE",
                imageUrl: "https://tracker.example/pixel.png",
                options: [{ text: "Only choice" }],
              },
            ],
          },
        ],
      }),
    ).toContain("image URL");
  });

  it("caps nested question work", () => {
    expect(
      validateAssessmentDefinition({
        questions: Array.from(
          { length: ASSESSMENT_DEFINITION_LIMITS.questions + 1 },
          (_, index) => ({ prompt: `Question ${index + 1}`, trait: "openness" }),
        ),
      }),
    ).toContain("no more than");
  });

  it("uses one bounded integer scale contract for creation and imports", () => {
    expect(
      resolveQuestionScale({ questionType: "FREE_TEXT" }),
    ).toEqual({ ok: true, scaleMin: 1, scaleMax: 1 });
    expect(
      resolveQuestionScale({
        questionType: "LIKERT_TRAIT",
        scaleMin: 1.5,
        scaleMax: 5,
      }),
    ).toMatchObject({ ok: false });
    expect(
      resolveQuestionScale({
        questionType: "LIKERT_TRAIT",
        scaleMin: 0,
        scaleMax: 21,
      }),
    ).toMatchObject({ ok: false });
  });

  it("preserves the existing counterpart for a partial scale patch", () => {
    expect(
      resolveQuestionScale(
        {
          questionType: "LIKERT_TRAIT",
          scaleMax: 7,
        },
        { scaleMin: 2, scaleMax: 6 },
      ),
    ).toEqual({ ok: true, scaleMin: 2, scaleMax: 7 });

    expect(
      resolveQuestionScale(
        { questionType: "FREE_TEXT" },
        { scaleMin: 1, scaleMax: 5 },
      ),
    ).toEqual({ ok: true, scaleMin: 1, scaleMax: 5 });
  });
});
