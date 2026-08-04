import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findReport: vi.fn(),
  findUser: vi.fn(),
  issueToken: vi.fn(),
  revokeToken: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    report: { findUnique: mocks.findReport },
    user: { findUnique: mocks.findUser },
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    EMAIL_FROM: "reports@olqlab.test",
    NEXTAUTH_URL: "https://www.olqlab.test",
    REPORT_SHARE_BASE_URL: "https://reports.olqlab.test",
  }),
}));

vi.mock("@/lib/resend", () => ({
  EmailDeliveryError: class EmailDeliveryError extends Error {
    readonly providerCode: string;
    readonly statusCode: number | null;

    constructor(input: {
      message: string;
      providerCode: string;
      statusCode: number | null;
    }) {
      super(input.message);
      this.name = "EmailDeliveryError";
      this.providerCode = input.providerCode;
      this.statusCode = input.statusCode;
    }
  },
  sendEmailOrThrow: mocks.sendEmail,
}));

vi.mock("@/lib/unenroll-jobs", () => ({
  issueReportShareToken: mocks.issueToken,
  revokeReportShareToken: mocks.revokeToken,
}));

vi.mock("@/lib/report-share-grant", () => ({
  buildScannerResistantReportLinkHtml: ({ token }: { token: string }) =>
    `<a href="https://reports.olqlab.test/reports/shared/${token}">View report</a>`,
}));

import { sendPublishedReportEmail } from "@/lib/report-delivery";
import { buildPublishedReportDeliveryIdempotencyKey } from "@/lib/report-delivery-idempotency";
import { EmailDeliveryError } from "@/lib/resend";

const reportVersion = {
  reportId: "report-attempt-1",
  publicationGeneration: 3,
  reportWorkflow: "MANUAL_PDF_UPLOAD",
  narrativeJson: '{"summary":"Ready"}',
  manualPdf: {
    id: "pdf-1",
    pdfBytes: Buffer.from("pdf-version-one"),
  },
};

describe("published report delivery idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({
      firstName: "Asha",
      email: "asha@example.com",
    });
    mocks.findReport.mockResolvedValue({
      id: reportVersion.reportId,
      publicationGeneration: reportVersion.publicationGeneration,
      narrativeJson: reportVersion.narrativeJson,
      pdfAsset: reportVersion.manualPdf,
      assessment: {
        title: "Leadership Profile",
        policy: { reportWorkflow: reportVersion.reportWorkflow },
      },
    });
    mocks.issueToken.mockResolvedValue({
      token: "stable-share-token",
      expiresAt: new Date("2026-08-06T12:00:00.000Z"),
    });
    mocks.revokeToken.mockResolvedValue(true);
  });

  it("is stable for one publication and changes with attempt, narrative, or PDF content", () => {
    const key = buildPublishedReportDeliveryIdempotencyKey(reportVersion);

    expect(
      buildPublishedReportDeliveryIdempotencyKey({
        ...reportVersion,
        manualPdf: {
          ...reportVersion.manualPdf,
          pdfBytes: Buffer.from("pdf-version-one"),
        },
      }),
    ).toBe(key);
    expect(
      buildPublishedReportDeliveryIdempotencyKey({
        ...reportVersion,
        publicationGeneration: 4,
      }),
    ).not.toBe(key);
    expect(
      buildPublishedReportDeliveryIdempotencyKey({
        ...reportVersion,
        reportId: "report-attempt-2",
      }),
    ).not.toBe(key);
    expect(
      buildPublishedReportDeliveryIdempotencyKey({
        ...reportVersion,
        narrativeJson: '{"summary":"Edited"}',
      }),
    ).not.toBe(key);
    expect(
      buildPublishedReportDeliveryIdempotencyKey({
        ...reportVersion,
        manualPdf: {
          ...reportVersion.manualPdf,
          pdfBytes: Buffer.from("pdf-version-two"),
        },
      }),
    ).not.toBe(key);
  });

  it("creates a fresh delivery/link key for explicit redelivery and reuses it on retry", async () => {
    mocks.sendEmail
      .mockRejectedValueOnce(new Error("ambiguous redelivery response"))
      .mockResolvedValueOnce({ id: "email-redelivery" });

    const input = {
      assessmentId: "assessment-1",
      userId: "user-1",
      redeliveryKey: "b3f09b46-3fc6-4b67-8ea1-13df6d94f664",
    };
    await expect(sendPublishedReportEmail(input)).rejects.toThrow(
      "ambiguous redelivery response",
    );
    await expect(sendPublishedReportEmail(input)).resolves.toBe(true);

    const firstIssue = mocks.issueToken.mock.calls[0]?.[0] as {
      idempotencyKey: string;
      expectedPublicationVersionKey: string;
    };
    const retryIssue = mocks.issueToken.mock.calls[1]?.[0] as {
      idempotencyKey: string;
      expectedPublicationVersionKey: string;
    };
    expect(firstIssue.idempotencyKey).toMatch(/^report-redelivery-/);
    expect(retryIssue.idempotencyKey).toBe(firstIssue.idempotencyKey);
    expect(firstIssue.expectedPublicationVersionKey).toMatch(
      /^report-publication-/,
    );
    expect(retryIssue.expectedPublicationVersionKey).toBe(
      firstIssue.expectedPublicationVersionKey,
    );
    expect(mocks.sendEmail.mock.calls[0]?.[1]).toEqual({
      idempotencyKey: firstIssue.idempotencyKey,
    });
    expect(mocks.revokeToken).not.toHaveBeenCalled();
  });

  it("keeps the link active after an ambiguous failure and reuses the token and provider key on retry", async () => {
    mocks.sendEmail
      .mockRejectedValueOnce(new Error("provider response was lost"))
      .mockResolvedValueOnce({ id: "email-1" });

    await expect(
      sendPublishedReportEmail({
        assessmentId: "assessment-1",
        userId: "user-1",
      }),
    ).rejects.toThrow("provider response was lost");
    expect(mocks.revokeToken).not.toHaveBeenCalled();

    await expect(
      sendPublishedReportEmail({
        assessmentId: "assessment-1",
        userId: "user-1",
      }),
    ).resolves.toBe(true);

    const firstIssue = mocks.issueToken.mock.calls[0]?.[0] as {
      idempotencyKey: string;
      expectedPublicationVersionKey: string;
    };
    const retryIssue = mocks.issueToken.mock.calls[1]?.[0] as {
      idempotencyKey: string;
      expectedPublicationVersionKey: string;
    };
    expect(retryIssue.idempotencyKey).toBe(firstIssue.idempotencyKey);
    expect(firstIssue.expectedPublicationVersionKey).toBe(firstIssue.idempotencyKey);
    expect(retryIssue.expectedPublicationVersionKey).toBe(firstIssue.idempotencyKey);

    expect(mocks.sendEmail.mock.calls[0]?.[0]).toEqual(
      mocks.sendEmail.mock.calls[1]?.[0],
    );
    expect(mocks.sendEmail.mock.calls[0]?.[1]).toEqual({
      idempotencyKey: firstIssue.idempotencyKey,
    });
    expect(mocks.sendEmail.mock.calls[1]?.[1]).toEqual({
      idempotencyKey: firstIssue.idempotencyKey,
    });
  });

  it("keeps a link active when the provider returns no delivery identifier", async () => {
    mocks.sendEmail.mockRejectedValueOnce(
      new EmailDeliveryError({
        message: "Email provider returned no delivery identifier.",
        providerCode: "missing_delivery_id",
        statusCode: null,
      }),
    );

    await expect(
      sendPublishedReportEmail({
        assessmentId: "assessment-1",
        userId: "user-1",
      }),
    ).rejects.toThrow("no delivery identifier");
    expect(mocks.revokeToken).not.toHaveBeenCalled();
  });

  it("revokes the link after a definitive provider rejection", async () => {
    mocks.sendEmail.mockRejectedValueOnce(
      new EmailDeliveryError({
        message: "Email provider rejected the message: recipient suppressed",
        providerCode: "validation_error",
        statusCode: 422,
      }),
    );

    await expect(
      sendPublishedReportEmail({
        assessmentId: "assessment-1",
        userId: "user-1",
      }),
    ).rejects.toThrow("recipient suppressed");
    expect(mocks.revokeToken).toHaveBeenCalledOnce();
    expect(mocks.revokeToken).toHaveBeenCalledWith("stable-share-token");
  });
});
