import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { questionImageMutationLockKey } from "@/lib/question-image-lock";

describe("question image mutation serialization", () => {
  it("uses a question-scoped advisory lock key", () => {
    expect(questionImageMutationLockKey("question-42")).toBe(
      "olq-question-image:question-42",
    );
  });

  it("re-reads the current image after taking the lock", () => {
    const source = readFileSync(
      "src/app/api/admin/assessments/[id]/questions/[questionId]/image/route.ts",
      "utf8",
    );
    const lockIndex = source.indexOf("await lockQuestionImageMutation");
    const rereadIndex = source.indexOf(
      "const currentQuestion = await tx.question.findFirst",
      lockIndex,
    );
    const updateIndex = source.indexOf(
      "const updated = await tx.question.update",
      rereadIndex,
    );

    expect(lockIndex).toBeGreaterThan(-1);
    expect(rereadIndex).toBeGreaterThan(lockIndex);
    expect(updateIndex).toBeGreaterThan(rereadIndex);
    expect(source).toContain("displacedUrl: currentQuestion.imageUrl");
  });
});
