import { describe, expect, it } from "vitest";
import { preflightReportPublicationPdf } from "@/lib/report-publication-preflight";

describe("report publication PDF preflight", () => {
  it("rejects AI narrative that would exceed the renderer character limit", async () => {
    const result = await preflightReportPublicationPdf({
      reportWorkflow: "AI_STANDARD",
      narrativeJson: JSON.stringify({
        adminEditedHtml: `<p>${"x".repeat(100_001)}</p>`,
      }),
      assessmentTitle: "Leadership Snapshot",
      participantName: "Participant",
    });

    expect(result).toMatchObject({
      ready: false,
      status: 413,
      code: "PDF_RENDER_LIMIT",
    });
  });

  it("rejects AI narrative that would exceed the renderer page limit", async () => {
    const paragraphs = Array.from({ length: 2_500 }, () => "x").join("</p><p>");
    const result = await preflightReportPublicationPdf({
      reportWorkflow: "AI_STANDARD",
      narrativeJson: JSON.stringify({
        adminEditedHtml: `<p>${paragraphs}</p>`,
      }),
      assessmentTitle: "Leadership Snapshot",
      participantName: "Participant",
    });

    expect(result).toMatchObject({
      ready: false,
      status: 413,
      code: "PDF_RENDER_LIMIT",
    });
  });

  it("leaves manual-PDF publication to the uploaded-asset validator", async () => {
    await expect(
      preflightReportPublicationPdf({
        reportWorkflow: "MANUAL_PDF_UPLOAD",
        narrativeJson: "not-used-by-manual-workflow",
        assessmentTitle: "Manual report",
        participantName: "Participant",
      }),
    ).resolves.toEqual({ ready: true });
  });
});
