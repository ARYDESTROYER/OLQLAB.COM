import { evaluateReportRelease } from "@/lib/report-release";

export type AssessmentExportReportStatus =
  | "NOT_UPLOADED_YET"
  | "UPLOADED"
  | "AWAITING_DELIVERY_TIMER"
  | "DELIVERED_TO_USER";

export function resolveAssessmentExportReportStatus(input: {
  session: {
    status: "IN_PROGRESS" | "SUBMITTED";
    submittedAt: Date | null;
  } | null;
  report: {
    status: "DRAFT" | "PUBLISHED";
    availableAt: Date | null;
    hasManualPdf: boolean;
  } | null;
  policy: {
    reportWorkflow: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
    showResultsToEmployee: boolean;
    resultReleaseDelayHours: number;
  };
  now: Date;
}): AssessmentExportReportStatus | null {
  if (!input.session || input.session.status !== "SUBMITTED") return null;
  if (!input.report) return "NOT_UPLOADED_YET";

  if (input.report.status !== "PUBLISHED") {
    return input.report.hasManualPdf ? "UPLOADED" : "NOT_UPLOADED_YET";
  }

  const decision = evaluateReportRelease({
    audience: "SELF",
    now: input.now,
    report: input.report,
    policy: input.policy,
    submittedAt: input.session.submittedAt,
  });
  if (decision.ready) return "DELIVERED_TO_USER";
  if (decision.code === "REPORT_DELAYED") return "AWAITING_DELIVERY_TIMER";
  if (decision.code === "PDF_MISSING") return "NOT_UPLOADED_YET";
  return "UPLOADED";
}

export function estimateAggregatedCsvTextBytes(input: {
  rawUtf8Bytes: number;
  quoteCharacters: number;
  values: number;
}) {
  const rawUtf8Bytes = Math.max(0, Math.floor(input.rawUtf8Bytes));
  const quoteCharacters = Math.max(0, Math.floor(input.quoteCharacters));
  const values = Math.max(0, Math.floor(input.values));

  // CSV can add one byte per embedded quote, two wrapper quotes, and one
  // spreadsheet-formula neutralization prefix. The aggregate remains a hard
  // upper bound without hydrating the free-text values into application memory.
  return rawUtf8Bytes + quoteCharacters + values * 3;
}
