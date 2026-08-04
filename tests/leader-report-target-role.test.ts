import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assessmentFind: vi.fn(),
  reportFind: vi.fn(),
  sessionFind: vi.fn(),
  userFind: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireLeaderOrAdmin: async () => ({
    liveUser: {
      id: "leader-1",
      role: "LEADER",
      tenantId: "tenant-1",
    },
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    assessment: { findUnique: mocks.assessmentFind },
    quizSession: { findUnique: mocks.sessionFind },
    report: { findUnique: mocks.reportFind },
    user: { findUnique: mocks.userFind },
  },
}));
vi.mock("@/lib/report-pdf", () => ({
  isReportPdfInputLimitError: () => false,
  renderCanonicalReportPdf: vi.fn(),
}));

import { GET as getLeaderReport } from "@/app/api/reports/leader/[userId]/[assessmentId]/route";
import { GET as getLeaderReportPdf } from "@/app/api/reports/leader/[userId]/[assessmentId]/pdf/route";

const context = {
  params: Promise.resolve({
    userId: "former-participant-admin",
    assessmentId: "assessment-1",
  }),
};

describe("leader report target roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFind.mockResolvedValue({
      id: "former-participant-admin",
      firstName: "Former",
      lastName: "Participant",
      tenantId: "tenant-1",
      managerId: "leader-1",
      role: "ADMIN",
    });
  });

  it("does not expose a promoted admin's historical report JSON", async () => {
    const response = await getLeaderReport(
      new Request(
        "https://www.olqlab.com/api/reports/leader/former-participant-admin/assessment-1",
      ),
      context,
    );

    expect(response.status).toBe(404);
    expect(mocks.reportFind).not.toHaveBeenCalled();
    expect(mocks.sessionFind).not.toHaveBeenCalled();
  });

  it("does not expose a promoted admin's historical report PDF", async () => {
    const response = await getLeaderReportPdf(
      new Request(
        "https://www.olqlab.com/api/reports/leader/former-participant-admin/assessment-1/pdf",
      ),
      context,
    );

    expect(response.status).toBe(404);
    expect(mocks.reportFind).not.toHaveBeenCalled();
    expect(mocks.sessionFind).not.toHaveBeenCalled();
  });
});
