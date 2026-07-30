import { describe, expect, it } from "vitest";
import {
  normalizePreviewReturnTo,
  serializeAnswerSnapshot,
  toParticipantQuestionDto,
  validateParticipantAnswer,
} from "@/lib/assessment-session";

const question = {
  id: "q1",
  code: "Q1",
  sectionId: "section-1",
  prompt: "I remain calm under pressure.",
  imageUrl: null,
  imageAlt: null,
  imageCaption: null,
  questionType: "LIKERT_TRAIT" as const,
  category: "Neuroticism",
  trait: "neuroticism",
  reverse: true,
  scaleMin: 1,
  scaleMax: 5,
  options: [
    {
      id: "option-1",
      text: "A participant-visible option",
      code: "A",
      impact: { Courage: 3 },
    },
  ],
};

describe("participant assessment boundary", () => {
  it("removes every scoring and bias field from the participant DTO", () => {
    const dto = toParticipantQuestionDto(question);
    expect(dto).toEqual({
      id: "q1",
      code: "Q1",
      sectionId: "section-1",
      prompt: "I remain calm under pressure.",
      imageUrl: null,
      imageAlt: null,
      imageCaption: null,
      questionType: "LIKERT_TRAIT",
      scaleMin: 1,
      scaleMax: 5,
      options: [{ id: "option-1", text: "A participant-visible option" }],
    });
    expect(dto).not.toHaveProperty("trait");
    expect(dto).not.toHaveProperty("reverse");
    expect(dto).not.toHaveProperty("category");
    expect(dto.options[0]).not.toHaveProperty("impact");
  });

  it("does not expose legacy third-party tracking images to participants", () => {
    expect(
      toParticipantQuestionDto({
        ...question,
        imageUrl: "https://tracker.example/pixel.png",
        imageAlt: "Unsafe external image",
        imageCaption: "Unsafe metadata",
      }),
    ).toMatchObject({ imageUrl: null, imageAlt: null, imageCaption: null });
  });

  it("rejects out-of-range and fractional Likert values", () => {
    expect(validateParticipantAnswer(question, { questionId: "q1", value: 6 }).ok).toBe(false);
    expect(validateParticipantAnswer(question, { questionId: "q1", value: 2.5 }).ok).toBe(false);
    expect(validateParticipantAnswer(question, { questionId: "q1", value: 4 })).toEqual({
      ok: true,
      answer: { questionId: "q1", kind: "LIKERT_TRAIT", value: 4 },
    });
  });

  it("supports explicitly clearing a free-text response", () => {
    const freeText = { ...question, questionType: "FREE_TEXT" as const };
    expect(validateParticipantAnswer(freeText, { questionId: "q1", textValue: "  " })).toEqual({
      ok: true,
      answer: { questionId: "q1", kind: "FREE_TEXT", textValue: "", clear: true },
    });
  });

  it("allows only local assessment-admin preview return paths", () => {
    expect(normalizePreviewReturnTo("/admin/assessments/abc", "abc")).toBe(
      "/admin/assessments/abc",
    );
    expect(normalizePreviewReturnTo("https://evil.example/steal", "abc")).toBe(
      "/admin/assessments/abc",
    );
    expect(normalizePreviewReturnTo("//evil.example/steal", "abc")).toBe(
      "/admin/assessments/abc",
    );
  });

  it("creates an order-independent snapshot that changes with any saved answer", () => {
    const first = serializeAnswerSnapshot([
      { questionId: "q2", optionId: "o1" },
      { questionId: "q1", value: 2 },
    ]);
    expect(
      serializeAnswerSnapshot([
        { questionId: "q1", value: 2 },
        { questionId: "q2", optionId: "o1" },
      ]),
    ).toBe(first);
    expect(
      serializeAnswerSnapshot([
        { questionId: "q1", value: 3 },
        { questionId: "q2", optionId: "o1" },
      ]),
    ).not.toBe(first);
  });
});
