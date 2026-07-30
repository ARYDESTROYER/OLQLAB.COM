import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createToken: vi.fn(),
  findDirectEnrollment: vi.fn(),
  findDueJobs: vi.fn(),
  findExistingToken: vi.fn(),
  findOverride: vi.fn(),
  findReport: vi.fn(),
  findSession: vi.fn(),
  findTenantEnrollments: vi.fn(),
  findUser: vi.fn(),
  lockToken: vi.fn(),
  transaction: vi.fn(),
  updateToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    assessmentReportAccessOverride: { findUnique: mocks.findOverride },
    assessmentReportShareToken: { create: mocks.createToken },
    assessmentTenantEnrollment: { findMany: mocks.findTenantEnrollments },
    assessmentUnenrollJob: { findMany: mocks.findDueJobs },
    assessmentUserEnrollment: { findUnique: mocks.findDirectEnrollment },
    quizSession: { findUnique: mocks.findSession },
    report: { findUnique: mocks.findReport },
    user: { findUnique: mocks.findUser },
  },
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ NEXTAUTH_SECRET: "share-token-secret".padEnd(48, "s") }),
}));

import { buildPublishedReportDeliveryIdempotencyKey } from "@/lib/report-delivery-idempotency";
import { issueReportShareToken } from "@/lib/unenroll-jobs";

describe("idempotent report share-token reissue", () => {
  const report = {
    id: "report-attempt-1",
    publicationGeneration: 1,
    narrativeJson: '{"summary":"Ready"}',
    status: "PUBLISHED",
    availableAt: new Date("2020-01-01T10:00:00.000Z"),
    pdfAsset: null,
    assessment: {
      policy: {
        reportWorkflow: "AI_STANDARD",
        showResultsToEmployee: true,
        resultReleaseDelayHours: 0,
      },
    },
  };
  const existingExpiry = new Date("2099-01-01T10:00:00.000Z");

  function existingToken(overrides?: Record<string, unknown>) {
    return {
      id: "share-token-1",
      assessmentId: "assessment-1",
      userId: "user-1",
      reportId: report.id,
      publicationVersionKey: buildPublishedReportDeliveryIdempotencyKey({
        reportId: report.id,
        publicationGeneration: report.publicationGeneration,
        reportWorkflow: report.assessment.policy.reportWorkflow,
        narrativeJson: report.narrativeJson,
        manualPdf: null,
      }),
      sourceJobId: null,
      expiresAt: existingExpiry,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      role: "EMPLOYEE",
    });
    mocks.findDirectEnrollment.mockResolvedValue({
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mocks.findTenantEnrollments.mockResolvedValue([]);
    mocks.findOverride.mockResolvedValue(null);
    mocks.findDueJobs.mockResolvedValue([]);
    mocks.findReport.mockResolvedValue(report);
    mocks.findSession.mockResolvedValue({
      status: "SUBMITTED",
      submittedAt: new Date("2020-01-01T09:00:00.000Z"),
    });
    mocks.findExistingToken.mockResolvedValue(existingToken());
    mocks.lockToken.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    mocks.updateToken.mockImplementation(
      async (query: { data: { expiresAt?: Date } }) => ({
        expiresAt: query.data.expiresAt || existingExpiry,
      }),
    );
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: mocks.lockToken,
          assessmentReportShareToken: {
            create: mocks.createToken,
            findUnique: mocks.findExistingToken,
            update: mocks.updateToken,
          },
        }),
    );
  });

  it("unrevokes the deterministic token and preserves its original expiry on retry", async () => {
    const publicationKey = buildPublishedReportDeliveryIdempotencyKey({
      reportId: report.id,
      publicationGeneration: report.publicationGeneration,
      reportWorkflow: report.assessment.policy.reportWorkflow,
      narrativeJson: report.narrativeJson,
      manualPdf: null,
    });
    const input = {
      assessmentId: "assessment-1",
      userId: "user-1",
      idempotencyKey: publicationKey,
      expectedPublicationVersionKey: publicationKey,
    };

    const first = await issueReportShareToken(input);
    const retry = await issueReportShareToken(input);

    expect(retry?.token).toBe(first?.token);
    expect(first?.expiresAt).toEqual(existingExpiry);
    expect(retry?.expiresAt).toEqual(existingExpiry);
    expect(mocks.updateToken).toHaveBeenCalledTimes(2);
    for (const [query] of mocks.updateToken.mock.calls) {
      expect(query.data).toEqual({ revokedAt: null });
      expect(query.select).toEqual({ expiresAt: true });
    }
  });

  it("renews an expired deterministic token before returning it", async () => {
    mocks.findExistingToken.mockResolvedValue(
      existingToken({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
    );
    const publicationKey = buildPublishedReportDeliveryIdempotencyKey({
      reportId: report.id,
      publicationGeneration: report.publicationGeneration,
      reportWorkflow: report.assessment.policy.reportWorkflow,
      narrativeJson: report.narrativeJson,
      manualPdf: null,
    });

    const reissued = await issueReportShareToken({
      assessmentId: "assessment-1",
      userId: "user-1",
      idempotencyKey: publicationKey,
      expectedPublicationVersionKey: publicationKey,
    });

    const update = mocks.updateToken.mock.calls[0]?.[0] as {
      data: {
        revokedAt: null;
        expiresAt: Date;
        downloadsUsed: number;
        maxDownloads: number;
      };
    };
    expect(update.data.revokedAt).toBeNull();
    expect(update.data.expiresAt).toBeInstanceOf(Date);
    expect(update.data.downloadsUsed).toBe(0);
    expect(update.data.maxDownloads).toBe(5);
    expect(update.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(reissued?.expiresAt).toEqual(update.data.expiresAt);
  });

  it("refuses to rebind an existing deterministic token to another identity", async () => {
    mocks.findExistingToken.mockResolvedValue(
      existingToken({ userId: "different-user" }),
    );
    const publicationKey = buildPublishedReportDeliveryIdempotencyKey({
      reportId: report.id,
      publicationGeneration: report.publicationGeneration,
      reportWorkflow: report.assessment.policy.reportWorkflow,
      narrativeJson: report.narrativeJson,
      manualPdf: null,
    });

    await expect(
      issueReportShareToken({
        assessmentId: "assessment-1",
        userId: "user-1",
        idempotencyKey: publicationKey,
        expectedPublicationVersionKey: publicationKey,
      }),
    ).resolves.toBeNull();
    expect(mocks.updateToken).not.toHaveBeenCalled();
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("refuses issuance for a superseded publication generation", async () => {
    const previousPublicationKey = buildPublishedReportDeliveryIdempotencyKey({
      reportId: report.id,
      publicationGeneration: report.publicationGeneration - 1,
      reportWorkflow: report.assessment.policy.reportWorkflow,
      narrativeJson: report.narrativeJson,
      manualPdf: null,
    });

    await expect(
      issueReportShareToken({
        assessmentId: "assessment-1",
        userId: "user-1",
        idempotencyKey: previousPublicationKey,
        expectedPublicationVersionKey: previousPublicationKey,
      }),
    ).resolves.toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createToken).not.toHaveBeenCalled();
  });
});
