import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  findReport: vi.fn(),
  findPreflightReport: vi.fn(),
  findPreflightUser: vi.fn(),
  findSession: vi.fn(),
  findUser: vi.fn(),
  lock: vi.fn(),
  revokeTokens: vi.fn(),
  sendEmail: vi.fn(),
  transaction: vi.fn(),
  updateReport: vi.fn(),
  preflight: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: async () => ({
    session: { user: { id: "admin-1", role: "ADMIN" } },
    liveUser: { id: "admin-1", role: "ADMIN", tenantId: "tenant-1" },
  }),
}));

vi.mock("@/lib/audit-log", () => ({ recordAuditLog: mocks.audit }));
vi.mock("@/lib/report-delivery", () => ({
  sendPublishedReportEmail: mocks.sendEmail,
}));
vi.mock("@/lib/report-publication-preflight", () => ({
  preflightReportPublicationPdf: mocks.preflight,
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    report: { findUnique: mocks.findPreflightReport },
    user: { findUnique: mocks.findPreflightUser },
  },
}));

import { PATCH } from "@/app/api/admin/reports/[reportId]/route";
import { POST as publish } from "@/app/api/admin/reports/[reportId]/send/route";

function tx() {
  return {
    $queryRaw: mocks.lock,
    assessmentReportShareToken: { updateMany: mocks.revokeTokens },
    quizSession: { findUnique: mocks.findSession },
    report: { findUnique: mocks.findReport, update: mocks.updateReport },
    user: { findUnique: mocks.findUser },
  };
}

describe("admin report lifecycle serialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lock.mockResolvedValue([{ lockResult: null }]);
    mocks.findUser.mockResolvedValue({
      tenantId: "tenant-1",
      firstName: "Asha",
      lastName: "Rao",
    });
    mocks.findPreflightReport.mockResolvedValue({
      userId: "user-1",
      narrativeJson: '{"summary":"Ready"}',
      assessment: {
        title: "Leadership Snapshot",
        policy: { reportWorkflow: "MANUAL_PDF_UPLOAD" },
      },
    });
    mocks.findPreflightUser.mockResolvedValue({
      firstName: "Asha",
      lastName: "Rao",
    });
    mocks.preflight.mockResolvedValue({ ready: true });
    mocks.findSession.mockResolvedValue({
      status: "SUBMITTED",
      submittedAt: new Date("2026-07-30T10:00:00.000Z"),
    });
    mocks.revokeTokens.mockResolvedValue({ count: 1 });
    mocks.audit.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(
      async (callback: (client: ReturnType<typeof tx>) => Promise<unknown>) =>
        callback(tx()),
    );
  });

  it("saves edits to a published report as a non-visible draft under the report lock", async () => {
    mocks.findReport.mockResolvedValue({
      id: "report-1",
      status: "PUBLISHED",
      userId: "user-1",
      assessmentId: "assessment-1",
      narrativeJson: '{"summary":"Old"}',
      availableAt: new Date("2026-07-30T10:00:00.000Z"),
      assessment: { policy: { reportWorkflow: "AI_STANDARD" } },
      pdfAsset: null,
    });
    mocks.updateReport.mockImplementation(async ({ data }: { data: object }) => ({
      id: "report-1",
      status: "DRAFT",
      ...data,
    }));

    const response = await PATCH(
      new NextRequest("https://www.olqlab.test/api/admin/reports/report-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeJson: JSON.stringify({ summary: "Replacement" }),
        }),
      }),
      { params: Promise.resolve({ reportId: "report-1" }) },
    );
    const body = (await response.json()) as {
      report: { status: string };
      unpublishedForContentChange: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.report.status).toBe("DRAFT");
    expect(body.unpublishedForContentChange).toBe(true);
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findReport.mock.invocationCallOrder[0]!,
    );
    expect(mocks.updateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          availableAt: null,
          deliveryMethod: null,
        }),
      }),
    );
    expect(mocks.revokeTokens).toHaveBeenCalledOnce();
  });

  it("revalidates and publishes a manual report inside the same lock transaction", async () => {
    mocks.findReport.mockResolvedValue({
      id: "report-1",
      status: "DRAFT",
      publicationGeneration: 0,
      userId: "user-1",
      assessmentId: "assessment-1",
      narrativeJson: '{"summary":"Ready"}',
      availableAt: null,
      assessment: {
        title: "Leadership Snapshot",
        policy: {
          reportWorkflow: "MANUAL_PDF_UPLOAD",
          showResultsToEmployee: true,
          resultReleaseDelayHours: 0,
        },
      },
      pdfAsset: { id: "pdf-1" },
    });
    mocks.updateReport.mockResolvedValue({
      id: "report-1",
      status: "PUBLISHED",
      publicationGeneration: 1,
      availableAt: new Date("2026-07-30T10:00:00.000Z"),
      deliveryMethod: "DASHBOARD_ONLY",
    });

    const response = await publish(
      new NextRequest("https://www.olqlab.test/api/admin/reports/report-1/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryMethod: "DASHBOARD_ONLY" }),
      }),
      { params: Promise.resolve({ reportId: "report-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.findSession).toHaveBeenCalledOnce();
    expect(mocks.updateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PUBLISHED",
          publicationGeneration: { increment: 1 },
        }),
      }),
    );
    expect(mocks.revokeTokens).toHaveBeenCalledOnce();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an undownloadable AI report on send and direct publish before mutation", async () => {
    mocks.findPreflightReport.mockResolvedValue({
      userId: "user-1",
      narrativeJson: '{"summary":"Oversized"}',
      assessment: {
        title: "Leadership Snapshot",
        policy: { reportWorkflow: "AI_STANDARD" },
      },
    });
    mocks.preflight.mockResolvedValue({
      ready: false,
      status: 413,
      code: "PDF_RENDER_LIMIT",
      message: "Report content exceeds the PDF rendering limit. Shorten the report before publishing.",
    });

    const response = await publish(
      new NextRequest("https://www.olqlab.test/api/admin/reports/report-1/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryMethod: "DASHBOARD_ONLY" }),
      }),
      { params: Promise.resolve({ reportId: "report-1" }) },
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(413);
    expect(body.code).toBe("PDF_RENDER_LIMIT");

    const patchResponse = await PATCH(
      new NextRequest("https://www.olqlab.test/api/admin/reports/report-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      }),
      { params: Promise.resolve({ reportId: "report-1" }) },
    );
    const patchBody = (await patchResponse.json()) as { code: string };
    expect(patchResponse.status).toBe(413);
    expect(patchBody.code).toBe("PDF_RENDER_LIMIT");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
