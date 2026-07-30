import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_EXPORT_LIMITS,
  getAssessmentExportLimitError,
} from "@/lib/export-limits";

describe("assessment export limits", () => {
  it("accepts values at every configured boundary", () => {
    expect(
      getAssessmentExportLimitError({
        assessments: ASSESSMENT_EXPORT_LIMITS.assessments,
        participants: ASSESSMENT_EXPORT_LIMITS.participants,
        questions: ASSESSMENT_EXPORT_LIMITS.questions,
        rows: ASSESSMENT_EXPORT_LIMITS.rows,
        cells: ASSESSMENT_EXPORT_LIMITS.cells,
        responseBytes: ASSESSMENT_EXPORT_LIMITS.responseBytes,
      }),
    ).toBeNull();
  });

  it("rejects an export whose rows and columns create an unsafe allocation", () => {
    expect(
      getAssessmentExportLimitError({
        cells: ASSESSMENT_EXPORT_LIMITS.cells + 1,
      }),
    ).toContain("too large to build safely");
  });

  it("rejects a response that would exceed the Vercel-safe boundary", () => {
    expect(
      getAssessmentExportLimitError({
        responseBytes: ASSESSMENT_EXPORT_LIMITS.responseBytes + 1,
      }),
    ).toContain("safe download size");
  });
});
