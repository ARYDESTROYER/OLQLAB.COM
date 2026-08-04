import { describe, expect, it } from "vitest";
import { buildManualPdfDeliveryFailure } from "@/lib/manual-report-delivery";

const publishedReport = {
  id: "report-1",
  status: "PUBLISHED",
  availableAt: new Date("2026-07-30T12:00:00.000Z"),
  deliveryMethod: "EMAIL_LINK",
};

describe("manual PDF delivery failures", () => {
  it("returns a conflict while preserving uploaded and published state when no link is delivered", () => {
    const result = buildManualPdfDeliveryFailure(
      "LINK_UNAVAILABLE",
      publishedReport,
    );

    expect(result.status).toBe(409);
    expect(result.body).toMatchObject({
      uploaded: true,
      published: true,
      report: publishedReport,
    });
    expect(result.body.error).toContain("secure link was no longer releasable");
  });

  it("returns a bad gateway while preserving uploaded and published state after an email failure", () => {
    const result = buildManualPdfDeliveryFailure("EMAIL_FAILED", publishedReport);

    expect(result.status).toBe(502);
    expect(result.body).toMatchObject({
      uploaded: true,
      published: true,
      report: publishedReport,
    });
    expect(result.body.error).toContain("email could not be delivered");
  });
});
