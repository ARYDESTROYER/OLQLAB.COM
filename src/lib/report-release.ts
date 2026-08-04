export type ReportAudience = "SELF" | "LEADER" | "SHARED";

export type ReportReleaseInput = {
  audience: ReportAudience;
  now?: Date;
  report: {
    status: string;
    availableAt: Date | string | null;
    hasManualPdf: boolean;
  } | null;
  policy: {
    reportWorkflow: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
    showResultsToEmployee?: boolean;
    resultReleaseDelayHours?: number;
    leaderCanViewFullReport?: boolean;
  };
  submittedAt?: Date | string | null;
};

export type ReportReleaseDecision =
  | { ready: true }
  | {
      ready: false;
      code:
        | "RESULTS_DISABLED"
        | "LEADER_DISABLED"
        | "REPORT_MISSING"
        | "REPORT_DRAFT"
        | "REPORT_DELAYED"
        | "PDF_MISSING";
      status: 403 | 404;
      message: string;
      availableAt?: Date;
    };

export type ReportPublicationDecision =
  | { ready: true }
  | {
      ready: false;
      code: "SESSION_NOT_SUBMITTED" | "NARRATIVE_INVALID" | "PDF_MISSING";
      message: string;
    };

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function evaluateReportPublicationReadiness(input: {
  reportWorkflow: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
  hasSubmittedSession: boolean;
  hasValidNarrative: boolean;
  hasManualPdf: boolean;
}): ReportPublicationDecision {
  if (!input.hasSubmittedSession) {
    return {
      ready: false,
      code: "SESSION_NOT_SUBMITTED",
      message: "Only reports for submitted assessments can be published.",
    };
  }

  if (input.reportWorkflow === "MANUAL_PDF_UPLOAD" && !input.hasManualPdf) {
    return {
      ready: false,
      code: "PDF_MISSING",
      message: "Upload a PDF before publishing this manual report.",
    };
  }

  if (input.reportWorkflow === "AI_STANDARD" && !input.hasValidNarrative) {
    return {
      ready: false,
      code: "NARRATIVE_INVALID",
      message: "A valid report narrative is required before publishing.",
    };
  }

  return { ready: true };
}

export function evaluateReportRelease(input: ReportReleaseInput): ReportReleaseDecision {
  const now = input.now || new Date();

  if (
    (input.audience === "SELF" || input.audience === "SHARED") &&
    input.policy.showResultsToEmployee === false
  ) {
    return {
      ready: false,
      code: "RESULTS_DISABLED",
      status: 403,
      message: "Your organisation has chosen not to release individual results.",
    };
  }

  if (input.audience === "LEADER" && input.policy.leaderCanViewFullReport === false) {
    return {
      ready: false,
      code: "LEADER_DISABLED",
      status: 403,
      message: "Leader access is disabled for this assessment.",
    };
  }

  if (!input.report) {
    return {
      ready: false,
      code: "REPORT_MISSING",
      status: 404,
      message: "The report is not ready yet.",
    };
  }

  if (input.report.status !== "PUBLISHED") {
    return {
      ready: false,
      code: "REPORT_DRAFT",
      status: 403,
      message: "The report is still under review and has not been published yet.",
    };
  }

  const candidateDates: Date[] = [];
  const reportAvailableAt = asDate(input.report.availableAt);
  if (reportAvailableAt) candidateDates.push(reportAvailableAt);

  if (input.audience === "SELF" || input.audience === "SHARED") {
    const submittedAt = asDate(input.submittedAt);
    const delayHours = Math.max(0, Number(input.policy.resultReleaseDelayHours || 0));
    if (submittedAt && delayHours > 0) {
      candidateDates.push(new Date(submittedAt.getTime() + delayHours * 60 * 60 * 1000));
    }
  }

  const availableAt = candidateDates.sort((a, b) => b.getTime() - a.getTime())[0];
  if (availableAt && now < availableAt) {
    return {
      ready: false,
      code: "REPORT_DELAYED",
      status: 403,
      message: `The report will be available after ${availableAt.toISOString()}.`,
      availableAt,
    };
  }

  if (
    input.policy.reportWorkflow === "MANUAL_PDF_UPLOAD" &&
    !input.report.hasManualPdf
  ) {
    return {
      ready: false,
      code: "PDF_MISSING",
      status: 404,
      message: "The report PDF has not been uploaded yet.",
    };
  }

  return { ready: true };
}
