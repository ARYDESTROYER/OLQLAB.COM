import { describe, expect, it } from "vitest";
import {
  estimateAggregatedCsvTextBytes,
  resolveAssessmentExportReportStatus,
} from "@/lib/assessment-export";
import { getAssessmentExportLimitError } from "@/lib/export-limits";

const submittedSession = {
  status: "SUBMITTED" as const,
  submittedAt: new Date("2026-07-30T10:00:00.000Z"),
};

const publishedReport = {
  status: "PUBLISHED" as const,
  availableAt: new Date("2026-07-30T10:00:00.000Z"),
  hasManualPdf: true,
};

const basePolicy = {
  reportWorkflow: "AI_STANDARD" as const,
  showResultsToEmployee: true,
  resultReleaseDelayHours: 0,
};

describe("assessment results export boundaries", () => {
  it("uses the participant release policy before calling a report delivered", () => {
    expect(
      resolveAssessmentExportReportStatus({
        session: submittedSession,
        report: publishedReport,
        policy: { ...basePolicy, showResultsToEmployee: false },
        now: new Date("2026-07-30T12:00:00.000Z"),
      }),
    ).toBe("UPLOADED");

    expect(
      resolveAssessmentExportReportStatus({
        session: submittedSession,
        report: publishedReport,
        policy: { ...basePolicy, resultReleaseDelayHours: 4 },
        now: new Date("2026-07-30T12:00:00.000Z"),
      }),
    ).toBe("AWAITING_DELIVERY_TIMER");

    expect(
      resolveAssessmentExportReportStatus({
        session: submittedSession,
        report: publishedReport,
        policy: basePolicy,
        now: new Date("2026-07-30T12:00:00.000Z"),
      }),
    ).toBe("DELIVERED_TO_USER");
  });

  it("rejects a large valid free-text selection from aggregate bytes before hydration", () => {
    const longAnswerBytes = 10_000;
    const answerCount = 500;
    const estimate = estimateAggregatedCsvTextBytes({
      rawUtf8Bytes: longAnswerBytes * answerCount,
      quoteCharacters: 0,
      values: answerCount,
    });

    expect(estimate).toBeGreaterThan(4 * 1024 * 1024);
    expect(getAssessmentExportLimitError({ responseBytes: estimate })).toContain(
      "safe download size",
    );
  });

  it("reserves quote escaping, wrapper, and formula-prefix bytes", () => {
    expect(
      estimateAggregatedCsvTextBytes({
        rawUtf8Bytes: 10,
        quoteCharacters: 2,
        values: 3,
      }),
    ).toBe(21);
  });
});
