export type ManualPdfPublishedReport = {
  id: string;
  status: string;
  availableAt: Date | null;
  deliveryMethod: string | null;
};

type ManualPdfDeliveryFailureReason = "LINK_UNAVAILABLE" | "EMAIL_FAILED";

export function buildManualPdfDeliveryFailure(
  reason: ManualPdfDeliveryFailureReason,
  report: ManualPdfPublishedReport,
) {
  if (reason === "LINK_UNAVAILABLE") {
    return {
      status: 409 as const,
      body: {
        error:
          "The PDF was uploaded and published, but its secure link was no longer releasable when delivery was attempted. Review the release policy and retry notification.",
        uploaded: true as const,
        published: true as const,
        report,
      },
    };
  }

  return {
    status: 502 as const,
    body: {
      error:
        "The PDF was uploaded and published, but the email could not be delivered. Retry notification after checking email configuration.",
      uploaded: true as const,
      published: true as const,
      report,
    },
  };
}
