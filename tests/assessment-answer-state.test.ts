import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assessmentSaveStatus,
  persistedVersionIsCurrent,
  shouldBlockAssessmentNavigation,
} from "@/lib/assessment-answer-state";

describe("participant answer persistence state", () => {
  it("blocks navigation for local, pending, failed, or submitting answers", () => {
    expect(
      shouldBlockAssessmentNavigation({
        pendingSaves: 0,
        dirtyAnswers: 1,
        saveFailed: false,
        submitting: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockAssessmentNavigation({
        pendingSaves: 0,
        dirtyAnswers: 0,
        saveFailed: true,
        submitting: false,
      }),
    ).toBe(true);
    expect(
      shouldBlockAssessmentNavigation({
        pendingSaves: 0,
        dirtyAnswers: 0,
        saveFailed: false,
        submitting: false,
      }),
    ).toBe(false);
  });

  it("never labels a local or failed response as saved", () => {
    expect(
      assessmentSaveStatus({
        pendingSaves: 0,
        dirtyAnswers: 1,
        saveFailed: false,
      }),
    ).toBe("1 unsaved response");
    expect(
      assessmentSaveStatus({
        pendingSaves: 0,
        dirtyAnswers: 2,
        saveFailed: false,
      }),
    ).toBe("2 unsaved responses");
    expect(
      assessmentSaveStatus({
        pendingSaves: 0,
        dirtyAnswers: 1,
        saveFailed: true,
      }),
    ).toBe("Save failed — retry before leaving");
  });

  it("only clears dirty state for the latest persisted edit", () => {
    expect(persistedVersionIsCurrent(4, 4)).toBe(true);
    expect(persistedVersionIsCurrent(5, 4)).toBe(false);
    expect(persistedVersionIsCurrent(undefined, 0)).toBe(false);
  });

  it("wires dirty state into unload and same-origin navigation guards", () => {
    const sessionPage = readFileSync(
      "src/app/(app)/assessment/session/[sessionId]/page.tsx",
      "utf8",
    );

    expect(sessionPage).toContain("markAnswerDirty(questionId)");
    expect(sessionPage).toContain(
      'window.addEventListener("beforeunload", warnBeforeLeaving)',
    );
    expect(sessionPage).toContain(
      'document.addEventListener("click", interceptInternalNavigation, true)',
    );
    expect(sessionPage).toContain("assessmentSaveStatus({");
    expect(sessionPage).toContain('title="Leave before responses are saved?"');
  });
});
