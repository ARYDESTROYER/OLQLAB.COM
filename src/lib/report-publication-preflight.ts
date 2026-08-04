import {
  parseReportNarrative,
  resolveCanonicalReportText,
} from "@/lib/report-content";
import {
  isReportPdfInputLimitError,
  renderCanonicalReportPdf,
} from "@/lib/report-pdf";

export async function preflightReportPublicationPdf(input: {
  reportWorkflow: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
  narrativeJson: string;
  assessmentTitle: string;
  participantName: string;
}) {
  if (input.reportWorkflow === "MANUAL_PDF_UPLOAD") {
    return { ready: true as const };
  }
  const narrative = parseReportNarrative(input.narrativeJson);
  if (!narrative) {
    return {
      ready: false as const,
      status: 422,
      code: "NARRATIVE_INVALID",
      message: "Report content is not valid canonical narrative JSON.",
    };
  }

  try {
    await renderCanonicalReportPdf({
      assessmentTitle: input.assessmentTitle,
      participantName: input.participantName,
      canonicalText: resolveCanonicalReportText(narrative, {
        assessmentTitle: input.assessmentTitle,
        participantName: input.participantName,
      }),
    });
    return { ready: true as const };
  } catch (error) {
    if (!isReportPdfInputLimitError(error)) throw error;
    return {
      ready: false as const,
      status: 413,
      code: "PDF_RENDER_LIMIT",
      message: `${error.message} Shorten the report before publishing.`,
    };
  }
}
