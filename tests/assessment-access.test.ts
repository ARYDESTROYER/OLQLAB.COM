import { describe, expect, it } from "vitest";
import {
  isAssessmentParticipantRole,
  resolveDueUnenrollOverlay,
} from "@/lib/assessment-access";

describe("logical assessment access overlays", () => {
  const createdAt = new Date("2026-07-01T00:00:00.000Z");

  it("applies a due user job immediately without executing side effects", () => {
    const overlay = resolveDueUnenrollOverlay({
      userId: "user-1",
      tenantId: "tenant-1",
      userCreatedAt: createdAt,
      tenantEnrollments: [],
      dueJobs: [
        {
          id: "job-1",
          targetScope: "USER",
          targetId: "user-1",
          reportMode: "REVOKE",
          effectiveAt: new Date("2026-07-30T10:00:00.000Z"),
          createdAt: new Date("2026-07-29T10:00:00.000Z"),
        },
      ],
    });
    expect(overlay.directEnrollmentRevoked).toBe(true);
    expect(overlay.overrideMode).toBe("REVOKE");
    expect(overlay.sourceJobId).toBe("job-1");
  });

  it("respects includeFutureUsers for due Organisation jobs", () => {
    const job = {
      id: "job-tenant",
      targetScope: "TENANT" as const,
      targetId: "tenant-1",
      reportMode: "LINK_ONLY" as const,
      effectiveAt: new Date("2026-07-30T10:00:00.000Z"),
      createdAt: new Date("2026-07-29T10:00:00.000Z"),
    };
    const ineligible = resolveDueUnenrollOverlay({
      userId: "user-1",
      tenantId: "tenant-1",
      userCreatedAt: new Date("2026-07-20T00:00:00.000Z"),
      tenantEnrollments: [
        {
          id: "enrollment-1",
          tenantId: "tenant-1",
          includeFutureUsers: false,
          createdAt,
        },
      ],
      dueJobs: [job],
    });
    expect(ineligible.revokedTenantIds.size).toBe(0);
    expect(ineligible.overrideMode).toBeNull();

    const eligible = resolveDueUnenrollOverlay({
      userId: "user-2",
      tenantId: "tenant-1",
      userCreatedAt: createdAt,
      tenantEnrollments: [
        {
          id: "enrollment-1",
          tenantId: "tenant-1",
          includeFutureUsers: false,
          createdAt,
        },
      ],
      dueJobs: [job],
    });
    expect(eligible.revokedTenantIds).toEqual(new Set(["tenant-1"]));
    expect(eligible.overrideMode).toBe("LINK_ONLY");
  });

  it("never treats an admin as an assessment participant", () => {
    expect(isAssessmentParticipantRole("ADMIN")).toBe(false);
    expect(isAssessmentParticipantRole("EMPLOYEE")).toBe(true);
    expect(isAssessmentParticipantRole("LEADER")).toBe(true);
  });
});
