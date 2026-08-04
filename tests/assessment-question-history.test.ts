import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessmentContentLockKey } from "@/lib/assessment-content-lock";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("assessment question history immutability", () => {
  it("uses an assessment-scoped content lock", () => {
    expect(assessmentContentLockKey("assessment-42")).toBe(
      "olq-assessment-content:assessment-42",
    );
  });

  it("serializes first-session creation with question evidence writes", () => {
    const startRoute = source("src/app/api/assessment/sessions/start/route.ts");
    const resetRoute = source(
      "src/app/api/admin/assessments/[id]/participants/[userId]/reset/route.ts",
    );
    const createRoute = source(
      "src/app/api/admin/assessments/[id]/questions/route.ts",
    );
    const updateRoute = source(
      "src/app/api/admin/assessments/[id]/questions/[questionId]/route.ts",
    );
    const imageRoute = source(
      "src/app/api/admin/assessments/[id]/questions/[questionId]/image/route.ts",
    );

    expect(startRoute).toContain("await lockAssessmentContent(tx, assessmentId)");
    const resetContentLock = resetRoute.indexOf(
      "await lockAssessmentContent(tx, assessmentId)",
    );
    const resetSessionLookup = resetRoute.indexOf(
      "const existingSession = await tx.quizSession.findUnique",
    );
    const resetSessionLock = resetRoute.indexOf(
      "await lockAssessmentSession(tx, existingSession.id)",
    );
    const resetSessionCreate = resetRoute.indexOf(
      "const resetSession = await tx.quizSession.create",
    );
    expect(resetContentLock).toBeGreaterThan(-1);
    expect(resetSessionLookup).toBeGreaterThan(resetContentLock);
    expect(resetSessionLock).toBeGreaterThan(resetSessionLookup);
    expect(resetSessionCreate).toBeGreaterThan(resetContentLock);
    expect(createRoute).toContain("await lockAssessmentContent(tx, id)");
    expect(createRoute).toContain("await assessmentHasAttemptHistory(tx, id)");
    expect(updateRoute).toContain("questionImage.imageUrl !== existing.imageUrl");
    expect(updateRoute).toContain("await assessmentHasAttemptHistory(tx, id)");
    expect(imageRoute.match(/await lockAssessmentContent\(tx, assessmentId\)/g)).toHaveLength(2);
    expect(imageRoute.match(/await assessmentHasAttemptHistory\(tx, assessmentId\)/g)).toHaveLength(2);
  });

  it("wires direct POST and partial PATCH to the canonical scale resolver", () => {
    const createRoute = source(
      "src/app/api/admin/assessments/[id]/questions/route.ts",
    );
    const updateRoute = source(
      "src/app/api/admin/assessments/[id]/questions/[questionId]/route.ts",
    );

    expect(createRoute).toContain("resolveQuestionScale({");
    expect(updateRoute).toContain("resolveQuestionScale(");
    expect(updateRoute).toContain(
      "{ scaleMin: existing.scaleMin, scaleMax: existing.scaleMax }",
    );
    expect(createRoute).not.toContain("Math.round(input)");
    expect(updateRoute).not.toContain("Math.round(input)");
  });
});
