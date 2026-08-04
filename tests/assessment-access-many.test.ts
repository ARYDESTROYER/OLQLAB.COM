import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  assessmentFindMany: vi.fn(),
  userEnrollmentFindMany: vi.fn(),
  reportOverrideFindMany: vi.fn(),
  tenantEnrollmentFindMany: vi.fn(),
  unenrollJobFindMany: vi.fn(),
  isSchemaCompatibilityError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    assessment: { findMany: mocks.assessmentFindMany },
    assessmentUserEnrollment: {
      findMany: mocks.userEnrollmentFindMany,
    },
    assessmentReportAccessOverride: {
      findMany: mocks.reportOverrideFindMany,
    },
    assessmentTenantEnrollment: {
      findMany: mocks.tenantEnrollmentFindMany,
    },
    assessmentUnenrollJob: {
      findMany: mocks.unenrollJobFindMany,
    },
  },
}));

vi.mock("@/lib/prisma-errors", () => ({
  isSchemaCompatibilityError: mocks.isSchemaCompatibilityError,
}));

import { resolveAssessmentAccessMany } from "@/lib/assessment-access";

describe("batched assessment access resolution", () => {
  const atTime = new Date("2026-08-04T12:00:00.000Z");
  const user = {
    id: "user-1",
    tenantId: "tenant-1",
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    role: "EMPLOYEE" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSchemaCompatibilityError.mockReturnValue(false);
    mocks.userFindUnique.mockResolvedValue(user);
    mocks.assessmentFindMany.mockResolvedValue([
      { id: "assessment-1", isPublished: true },
      { id: "assessment-2", isPublished: true },
    ]);
    mocks.userEnrollmentFindMany.mockResolvedValue([]);
    mocks.reportOverrideFindMany.mockResolvedValue([]);
    mocks.tenantEnrollmentFindMany.mockResolvedValue([]);
    mocks.unenrollJobFindMany.mockResolvedValue([]);
  });

  it("deduplicates ids and resolves direct access with one bounded query per table", async () => {
    mocks.userEnrollmentFindMany.mockResolvedValue([
      {
        id: "direct-1",
        assessmentId: "assessment-1",
        active: true,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        reportMode: "MANUAL",
        reportDelayHours: 24,
      },
    ]);

    const result = await resolveAssessmentAccessMany(
      "user-1",
      ["assessment-1", "assessment-1", "assessment-2"],
      atTime,
    );

    expect([...result.keys()]).toEqual(["assessment-1", "assessment-2"]);
    expect(result.get("assessment-1")).toMatchObject({
      hasDirectEnrollment: true,
      hasActiveEnrollment: true,
      canStartAssessment: true,
      canViewAppReport: true,
      enrollmentReportMode: "MANUAL",
      enrollmentReportDelayHours: 24,
      sources: [{ scope: "USER", enrollmentId: "direct-1" }],
    });
    expect(result.get("assessment-2")).toMatchObject({
      hasActiveEnrollment: false,
      canStartAssessment: false,
    });

    expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.assessmentFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.userEnrollmentFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.reportOverrideFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.tenantEnrollmentFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.unenrollJobFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.assessmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["assessment-1", "assessment-2"] } },
      }),
    );
    expect(mocks.tenantEnrollmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assessmentId: { in: ["assessment-1", "assessment-2"] },
          createdAt: { lte: atTime },
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("honours the Organisation enrollment user-creation cutoff", async () => {
    mocks.tenantEnrollmentFindMany.mockResolvedValue([
      {
        id: "tenant-before-user",
        assessmentId: "assessment-1",
        active: true,
        tenantId: "tenant-1",
        includeFutureUsers: false,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        reportMode: "AUTO",
        reportDelayHours: 0,
      },
      {
        id: "tenant-includes-future",
        assessmentId: "assessment-2",
        active: true,
        tenantId: "tenant-1",
        includeFutureUsers: true,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        reportMode: "MANUAL",
        reportDelayHours: 12,
      },
    ]);

    const result = await resolveAssessmentAccessMany(
      "user-1",
      ["assessment-1", "assessment-2"],
      atTime,
    );

    expect(result.get("assessment-1")).toMatchObject({
      hasTenantEnrollment: false,
      hasActiveEnrollment: false,
      canStartAssessment: false,
    });
    expect(result.get("assessment-2")).toMatchObject({
      hasTenantEnrollment: true,
      hasActiveEnrollment: true,
      canStartAssessment: true,
      enrollmentReportMode: "MANUAL",
      enrollmentReportDelayHours: 12,
    });
  });

  it("lets the latest due unenroll mode override persisted report access", async () => {
    mocks.userEnrollmentFindMany.mockResolvedValue([
      {
        id: "direct-1",
        assessmentId: "assessment-1",
        active: true,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        reportMode: "AUTO",
        reportDelayHours: 0,
      },
    ]);
    mocks.reportOverrideFindMany.mockResolvedValue([
      {
        assessmentId: "assessment-1",
        mode: "KEEP_APP_ACCESS",
      },
    ]);
    mocks.unenrollJobFindMany.mockResolvedValue([
      {
        assessmentId: "assessment-1",
        id: "older-revoke",
        targetScope: "USER",
        targetId: "user-1",
        reportMode: "REVOKE",
        effectiveAt: new Date("2026-08-03T09:00:00.000Z"),
        createdAt: new Date("2026-08-02T09:00:00.000Z"),
      },
      {
        assessmentId: "assessment-1",
        id: "newer-link-only",
        targetScope: "USER",
        targetId: "user-1",
        reportMode: "LINK_ONLY",
        effectiveAt: new Date("2026-08-04T09:00:00.000Z"),
        createdAt: new Date("2026-08-03T09:00:00.000Z"),
      },
    ]);

    const result = await resolveAssessmentAccessMany(
      "user-1",
      ["assessment-1"],
      atTime,
    );

    expect(result.get("assessment-1")).toMatchObject({
      hasDirectEnrollment: false,
      hasActiveEnrollment: false,
      overrideMode: "LINK_ONLY",
      canStartAssessment: false,
      canViewAppReport: false,
      canViewViaLinkOnly: true,
      isRevoked: true,
    });
  });

  it("denies admins even when enrollment rows exist and marks absent assessments", async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...user,
      role: "ADMIN",
    });
    mocks.assessmentFindMany.mockResolvedValue([
      { id: "assessment-1", isPublished: true },
    ]);
    mocks.userEnrollmentFindMany.mockResolvedValue([
      {
        id: "direct-admin",
        assessmentId: "assessment-1",
        active: true,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        reportMode: "AUTO",
        reportDelayHours: 0,
      },
    ]);

    const result = await resolveAssessmentAccessMany(
      "user-1",
      ["assessment-1", "missing-assessment"],
      atTime,
    );

    expect(result.get("assessment-1")).toMatchObject({
      assessmentExists: true,
      hasDirectEnrollment: false,
      hasActiveEnrollment: false,
      canStartAssessment: false,
      canViewAppReport: false,
      isRevoked: true,
    });
    expect(result.get("missing-assessment")).toMatchObject({
      assessmentExists: false,
      isPublished: false,
      hasActiveEnrollment: false,
      canStartAssessment: false,
      canViewAppReport: false,
      isRevoked: true,
    });
  });

  it("falls back to legacy Organisation ownership on schema compatibility errors", async () => {
    const schemaError = new Error("new enrollment table is not available");
    mocks.isSchemaCompatibilityError.mockImplementation(
      (error: unknown) => error === schemaError,
    );
    mocks.userFindUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({
        id: "user-1",
        tenantId: "tenant-1",
        role: "EMPLOYEE",
      });
    mocks.assessmentFindMany
      .mockRejectedValueOnce(schemaError)
      .mockResolvedValueOnce([
        {
          id: "assessment-1",
          tenantId: "tenant-1",
          isPublished: true,
        },
        {
          id: "assessment-2",
          tenantId: "tenant-2",
          isPublished: true,
        },
      ]);

    const result = await resolveAssessmentAccessMany(
      "user-1",
      ["assessment-1", "assessment-2"],
      atTime,
    );

    expect(result.get("assessment-1")).toMatchObject({
      assessmentExists: true,
      hasTenantEnrollment: true,
      hasActiveEnrollment: true,
      canStartAssessment: true,
      canViewAppReport: true,
      sources: [],
    });
    expect(result.get("assessment-2")).toMatchObject({
      assessmentExists: true,
      hasTenantEnrollment: false,
      hasActiveEnrollment: false,
      canStartAssessment: false,
      canViewAppReport: false,
    });
    expect(mocks.userFindUnique).toHaveBeenCalledTimes(2);
    expect(mocks.assessmentFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.userEnrollmentFindMany).not.toHaveBeenCalled();
    expect(mocks.reportOverrideFindMany).not.toHaveBeenCalled();
    expect(mocks.tenantEnrollmentFindMany).not.toHaveBeenCalled();
    expect(mocks.unenrollJobFindMany).not.toHaveBeenCalled();
  });
});
