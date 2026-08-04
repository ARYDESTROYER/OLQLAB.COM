import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  release: vi.fn(),
  render: vi.fn(),
  reportFind: vi.fn(),
  reserve: vi.fn(),
  revalidate: vi.fn(),
  sessionFind: vi.fn(),
  verifyGrant: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    report: { findUnique: mocks.reportFind },
    quizSession: { findUnique: mocks.sessionFind },
  },
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ NEXTAUTH_SECRET: "test-secret" }),
}));
vi.mock("@/lib/unenroll-jobs", () => ({
  releaseReportShareTokenDownloadReservation: mocks.release,
  reserveReportShareTokenDownload: mocks.reserve,
  revalidateReportShareTokenDownloadReservation: mocks.revalidate,
}));
vi.mock("@/lib/report-release", () => ({
  evaluateReportRelease: () => ({ ready: true }),
}));
vi.mock("@/lib/report-content", () => ({
  parseReportNarrative: () => ({ summary: "Ready" }),
  resolveCanonicalReportText: () => "Canonical report",
}));
vi.mock("@/lib/report-pdf", () => ({
  isReportPdfInputLimitError: () => false,
  renderCanonicalReportPdf: mocks.render,
}));
vi.mock("@/lib/report-share-grant", () => ({
  reportShareGrantCookieName: () => "grant-cookie",
  verifyReportShareGrant: mocks.verifyGrant,
}));

import { GET } from "@/app/api/reports/shared/[token]/pdf/route";

const tokenRow = {
  id: "token-row-1",
  assessmentId: "assessment-1",
  userId: "user-1",
  reportId: "report-1",
  assessment: {
    title: "Leadership assessment",
    policy: {
      reportWorkflow: "AI_STANDARD",
      showResultsToEmployee: true,
      resultReleaseDelayHours: 0,
      leaderCanViewFullReport: true,
    },
  },
  user: { firstName: "Asha", lastName: "Rao" },
};

function request() {
  return GET(new Request("https://www.olqlab.com/api/reports/shared/token/pdf"), {
    params: Promise.resolve({ token: "token" }),
  });
}

describe("shared report PDF quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieGet.mockReturnValue({ value: "signed-grant" });
    mocks.verifyGrant.mockReturnValue(true);
    mocks.release.mockResolvedValue(true);
    mocks.revalidate.mockResolvedValue(true);
    mocks.reportFind.mockResolvedValue({
      id: "report-1",
      assessmentId: "assessment-1",
      userId: "user-1",
      status: "PUBLISHED",
      availableAt: new Date("2026-07-30T00:00:00.000Z"),
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      narrativeJson: { summary: "Ready" },
      pdfAsset: null,
      assessment: { policy: tokenRow.assessment.policy },
    });
    mocks.sessionFind.mockResolvedValue({
      status: "SUBMITTED",
      submittedAt: new Date("2026-07-29T00:00:00.000Z"),
    });
    mocks.render.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  });

  it("rejects missing activation grants before quota or report work", async () => {
    mocks.verifyGrant.mockReturnValue(false);

    const response = await request();

    expect(response.status).toBe(404);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.reportFind).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("allows only one parallel render when only one slot can be reserved", async () => {
    let remainingSlots = 1;
    mocks.reserve.mockImplementation(async () => {
      if (remainingSlots === 0) return null;
      remainingSlots -= 1;
      return tokenRow;
    });

    const responses = await Promise.all([request(), request()]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 404]);
    expect(mocks.reserve).toHaveBeenCalledTimes(2);
    expect(
      mocks.reportFind.mock.calls.filter(([query]) =>
        JSON.stringify(query).includes("pdfBytes"),
      ),
    ).toHaveLength(1);
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it("releases the exact reservation if PDF rendering fails", async () => {
    mocks.reserve.mockResolvedValue(tokenRow);
    mocks.render.mockRejectedValue(new Error("renderer unavailable"));

    await expect(request()).rejects.toThrow("renderer unavailable");

    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledWith("token-row-1");
  });

  it("denies and releases when access is revoked during rendering", async () => {
    let finishRender: ((bytes: Uint8Array) => void) | undefined;
    mocks.reserve.mockResolvedValue(tokenRow);
    mocks.render.mockImplementation(
      () =>
        new Promise<Uint8Array>((resolve) => {
          finishRender = resolve;
        }),
    );

    const pending = request();
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce());
    mocks.revalidate.mockResolvedValue(false);
    finishRender?.(new Uint8Array([37, 80, 68, 70]));
    const response = await pending;

    expect(response.status).toBe(404);
    expect(mocks.revalidate).toHaveBeenCalledWith({
      tokenId: "token-row-1",
      reportId: "report-1",
    });
    expect(mocks.release).toHaveBeenCalledWith("token-row-1");
  });
});
