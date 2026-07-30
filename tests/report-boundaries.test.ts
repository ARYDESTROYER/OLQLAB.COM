import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  canonicalizeReportNarrative,
  isReportNarrativeSizeAllowed,
  MAX_REPORT_NARRATIVE_BYTES,
  reportHtmlToPlainText,
  sanitizeReportHtml,
} from "@/lib/report-content";
import {
  evaluateReportPublicationReadiness,
  evaluateReportRelease,
} from "@/lib/report-release";
import { participantReference } from "@/lib/report-privacy";
import { buildReportHtmlTemplate } from "@/lib/report-format";
import {
  MAX_REPORT_PDF_TEXT_CHARACTERS,
  normalizePdfText,
  ReportPdfInputLimitError,
  renderCanonicalReportPdf,
} from "@/lib/report-pdf";
import {
  isReportPdfSizeAllowed,
  isStructurallyValidPdf,
  MAX_REPORT_PDF_BYTES,
  safeReportPdfFileName,
} from "@/lib/report-pdf-upload";

describe("report HTML security boundary", () => {
  it("bounds stored narrative work by UTF-8 bytes", () => {
    expect(isReportNarrativeSizeAllowed("a".repeat(MAX_REPORT_NARRATIVE_BYTES))).toBe(
      true,
    );
    expect(
      isReportNarrativeSizeAllowed("✅".repeat(MAX_REPORT_NARRATIVE_BYTES / 2)),
    ).toBe(false);
  });

  it("builds a native OLQ Lab template using only editor-safe semantic nodes", () => {
    const generated = buildReportHtmlTemplate({
      assessmentTitle: "Wissen Leadership Assessment",
      participantName: "A Participant",
      summary: "A data-derived summary.",
      strengths: ["Listens before deciding"],
    });
    expect(generated).toContain("OLQ Lab Leadership Development Report");
    expect(generated).toContain("Wissen Leadership Assessment");
    expect(generated).not.toMatch(/Talent\s*Vantage|<style|<svg|<table|class=/i);
    expect(sanitizeReportHtml(generated)).toBe(generated);
  });

  it("removes executable markup while preserving supported report formatting", () => {
    const safe = sanitizeReportHtml(
      '<h2 onclick="alert(1)">Summary</h2><script>alert(1)</script><p>Safe <strong>copy</strong></p><img src=x onerror=alert(2)>',
    );
    expect(safe).toBe("<h2>Summary</h2><p>Safe <strong>copy</strong></p>");
    expect(safe).not.toMatch(/script|onclick|onerror|<img/i);
  });

  it("stores sanitized HTML and a matching canonical PDF text representation", () => {
    const result = canonicalizeReportNarrative({
      adminEditedHtml: "<h2>नमस्ते OLQ</h2><p>Coach &amp; participant ✅</p>",
    });
    expect(result.adminEditedHtml).toBe("<h2>नमस्ते OLQ</h2><p>Coach &amp; participant ✅</p>");
    expect(result.adminEditedText).toBe("नमस्ते OLQ\nCoach & participant ✅");
    expect(reportHtmlToPlainText(String(result.adminEditedHtml))).toBe(result.adminEditedText);
  });

  it("drops the legacy third-party template instead of republishing it", () => {
    const result = canonicalizeReportNarrative({
      adminEditedHtml: "<div>TALENT<br>VANTAGE</div>",
    });
    expect(result.adminEditedHtml).toBeUndefined();
    expect(result.adminEditedText).toBeUndefined();
  });

  it("preserves an assessment title that contains the word Wissen", () => {
    const result = canonicalizeReportNarrative({
      adminEditedHtml: "<h1>Wissen Leadership Assessment</h1><p>Participant-authored notes.</p>",
    });
    expect(result.adminEditedHtml).toContain("Wissen Leadership Assessment");
  });
});

describe("canonical report release decisions", () => {
  const base = {
    audience: "SELF" as const,
    now: new Date("2026-07-30T12:00:00.000Z"),
    report: {
      status: "PUBLISHED",
      availableAt: null,
      hasManualPdf: true,
    },
    policy: {
      reportWorkflow: "AI_STANDARD" as const,
      showResultsToEmployee: true,
      resultReleaseDelayHours: 0,
      leaderCanViewFullReport: true,
    },
    submittedAt: new Date("2026-07-30T10:00:00.000Z"),
  };

  it("blocks draft and delayed reports across direct routes", () => {
    expect(
      evaluateReportRelease({ ...base, report: { ...base.report, status: "DRAFT" } }),
    ).toMatchObject({ ready: false, code: "REPORT_DRAFT" });
    expect(
      evaluateReportRelease({
        ...base,
        policy: { ...base.policy, resultReleaseDelayHours: 4 },
      }),
    ).toMatchObject({ ready: false, code: "REPORT_DELAYED" });
  });

  it("requires the uploaded asset for manual reports", () => {
    expect(
      evaluateReportRelease({
        ...base,
        policy: { ...base.policy, reportWorkflow: "MANUAL_PDF_UPLOAD" },
        report: { ...base.report, hasManualPdf: false },
      }),
    ).toMatchObject({ ready: false, code: "PDF_MISSING" });
  });

  it("does not let shared links bypass employee release policy or delay", () => {
    expect(
      evaluateReportRelease({
        ...base,
        audience: "SHARED",
        policy: { ...base.policy, showResultsToEmployee: false },
      }),
    ).toMatchObject({ ready: false, code: "RESULTS_DISABLED" });
    expect(
      evaluateReportRelease({
        ...base,
        audience: "SHARED",
        policy: { ...base.policy, resultReleaseDelayHours: 4 },
      }),
    ).toMatchObject({ ready: false, code: "REPORT_DELAYED" });
  });

  it("preserves legitimate published report access", () => {
    expect(evaluateReportRelease(base)).toEqual({ ready: true });
  });
});

describe("report publication readiness", () => {
  it("requires a submitted assessment and workflow-specific report content", () => {
    expect(
      evaluateReportPublicationReadiness({
        reportWorkflow: "AI_STANDARD",
        hasSubmittedSession: false,
        hasValidNarrative: true,
        hasManualPdf: false,
      }),
    ).toMatchObject({ ready: false, code: "SESSION_NOT_SUBMITTED" });
    expect(
      evaluateReportPublicationReadiness({
        reportWorkflow: "AI_STANDARD",
        hasSubmittedSession: true,
        hasValidNarrative: false,
        hasManualPdf: false,
      }),
    ).toMatchObject({ ready: false, code: "NARRATIVE_INVALID" });
    expect(
      evaluateReportPublicationReadiness({
        reportWorkflow: "MANUAL_PDF_UPLOAD",
        hasSubmittedSession: true,
        hasValidNarrative: false,
        hasManualPdf: false,
      }),
    ).toMatchObject({ ready: false, code: "PDF_MISSING" });
  });

  it("allows each workflow only when its required artifact is ready", () => {
    expect(
      evaluateReportPublicationReadiness({
        reportWorkflow: "AI_STANDARD",
        hasSubmittedSession: true,
        hasValidNarrative: true,
        hasManualPdf: false,
      }),
    ).toEqual({ ready: true });
    expect(
      evaluateReportPublicationReadiness({
        reportWorkflow: "MANUAL_PDF_UPLOAD",
        hasSubmittedSession: true,
        hasValidNarrative: false,
        hasManualPdf: true,
      }),
    ).toEqual({ ready: true });
  });
});

describe("AI report privacy boundary", () => {
  it("uses a stable pseudonym without exposing raw identity input", () => {
    const userId = "user_ary@example.com_Ary_Name";
    const reference = participantReference(userId);
    expect(reference).toMatch(/^participant-[a-f0-9]{16}$/);
    expect(reference).not.toContain(userId);
    expect(reference).not.toContain("ary@example.com");
    expect(reference).not.toContain("Ary");
    expect(participantReference(userId)).toBe(reference);
  });
});

describe("canonical PDF boundary", () => {
  it("rejects oversized canonical text before loading fonts or laying out pages", async () => {
    await expect(
      renderCanonicalReportPdf({
        assessmentTitle: "Bounded report",
        participantName: "Participant",
        canonicalText: "x".repeat(MAX_REPORT_PDF_TEXT_CHARACTERS),
      }),
    ).rejects.toBeInstanceOf(ReportPdfInputLimitError);
  });

  it("renders Latin and Devanagari and replaces unsupported emoji without failing", async () => {
    expect(normalizePdfText("Leadership नेतृत्व ✅")).toBe("Leadership नेतृत्व □");
    const bytes = await renderCanonicalReportPdf({
      assessmentTitle: "नेतृत्व Leadership",
      participantName: "Participant",
      submittedAt: "2026-07-30T12:00:00.000Z",
      canonicalText: "Admin redaction preserved. नेतृत्व विकास ✅",
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1_000);
  });

  it("paginates a long single paragraph instead of drawing past the page boundary", async () => {
    const canonicalText = Array.from({ length: 1_200 }, (_, index) => `word${index}`).join(" ");
    const bytes = await renderCanonicalReportPdf({
      assessmentTitle: "Long-form leadership report",
      participantName: "Participant",
      canonicalText,
    });
    const pdf = await PDFDocument.load(bytes);

    // Before the regression fix, the renderer added only one page before the
    // oversized paragraph and drew the remaining lines at negative y positions.
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
  });

  it("enforces the upload boundary and rejects a forged PDF header", async () => {
    expect(isReportPdfSizeAllowed(MAX_REPORT_PDF_BYTES)).toBe(true);
    expect(isReportPdfSizeAllowed(MAX_REPORT_PDF_BYTES + 1)).toBe(false);
    expect(safeReportPdfFileName("../unsafe\u0000/report.pdf")).toBe("report.pdf");
    expect(await isStructurallyValidPdf(Buffer.from("%PDF-not-a-document"))).toBe(false);
  });

  it("accepts a generated report as a structurally valid PDF", async () => {
    const bytes = await renderCanonicalReportPdf({
      assessmentTitle: "OLQ Assessment",
      participantName: "Participant",
      canonicalText: "A valid report.",
    });
    expect(await isStructurallyValidPdf(bytes)).toBe(true);
  });
});
