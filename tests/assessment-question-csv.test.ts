import { describe, expect, it } from "vitest";
import {
  buildAssessmentCsvTemplate,
  parseAssessmentQuestionCsv,
} from "@/lib/assessment-question-csv";

describe("assessment question CSV image policy", () => {
  it("rejects third-party image URLs before import persistence", () => {
    const csv = buildAssessmentCsvTemplate().replace(
      "/question-images/q31-missed-deadline.png",
      "https://tracker.example/pixel.png",
    );
    const result = parseAssessmentQuestionCsv(csv);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: "image_url", code: "INVALID_VALUE" }),
      ]),
    );
  });
});
