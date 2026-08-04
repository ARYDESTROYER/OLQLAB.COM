import { describe, expect, it } from "vitest";
import { UnenrollJobStatus } from "@prisma/client";
import {
  createIdempotentShareToken,
  isReportShareTokenAllowed,
  isJobRetryEligible,
  parseJobExecutionState,
  reportShareTokenMatchesPublication,
  selectLatestApplicableUnenrollJobForRecipient,
  selectUnenrollRecipientBatch,
  selectLatestUnenrollJob,
  shouldStopUnenrollWork,
} from "@/lib/unenroll-jobs";

describe("unenroll job retry safety", () => {
  it("never treats a replacement publication as the token's original content", () => {
    const token = {
      reportId: "report-1",
      publicationVersionKey: "publication-generation-1",
    };
    expect(
      reportShareTokenMatchesPublication({
        token,
        binding: {
          reportId: "report-1",
          publicationVersionKey: "publication-generation-1",
        },
      }),
    ).toBe(true);
    expect(
      reportShareTokenMatchesPublication({
        token,
        binding: {
          reportId: "report-1",
          publicationVersionKey: "publication-generation-2",
        },
      }),
    ).toBe(false);
    expect(
      reportShareTokenMatchesPublication({
        token,
        binding: {
          reportId: "replacement-report",
          publicationVersionKey: "publication-generation-1",
        },
      }),
    ).toBe(false);
  });

  it("derives the same opaque share token for the same job/user key", () => {
    const first = createIdempotentShareToken({
      idempotencyKey: "job-1:user-1",
      reportId: "report-attempt-1",
      publicationVersionKey: "publication-1",
      secret: "secret-value",
    });
    const second = createIdempotentShareToken({
      idempotencyKey: "job-1:user-1",
      reportId: "report-attempt-1",
      publicationVersionKey: "publication-1",
      secret: "secret-value",
    });
    expect(first).toBe(second);
    expect(first).not.toContain("job-1");
    expect(
      createIdempotentShareToken({
        idempotencyKey: "job-1:user-1",
        reportId: "report-attempt-2",
        publicationVersionKey: "publication-1",
        secret: "secret-value",
      }),
    ).not.toBe(first);
    expect(
      createIdempotentShareToken({
        idempotencyKey: "job-1:user-1",
        reportId: "report-attempt-1",
        publicationVersionKey: "publication-2",
        secret: "secret-value",
      }),
    ).not.toBe(first);
  });

  it("does not steal a live claim, but recovers it after the lease", () => {
    const claimedAt = new Date("2026-07-30T10:00:00.000Z");
    const errorMessage = `JOB_CLAIM_V1|1|${claimedAt.toISOString()}|claim-1`;
    expect(parseJobExecutionState(errorMessage)).toMatchObject({ kind: "claim", attempt: 1 });
    expect(
      isJobRetryEligible({
        status: UnenrollJobStatus.FAILED,
        errorMessage,
        updatedAt: claimedAt,
        effectiveAt: claimedAt,
        now: new Date("2026-07-30T10:09:59.000Z"),
      }),
    ).toBe(false);
    expect(
      isJobRetryEligible({
        status: UnenrollJobStatus.FAILED,
        errorMessage,
        updatedAt: claimedAt,
        effectiveAt: claimedAt,
        now: new Date("2026-07-30T10:10:00.000Z"),
      }),
    ).toBe(true);
  });

  it("stops automatic retries after three failures", () => {
    expect(
      isJobRetryEligible({
        status: UnenrollJobStatus.FAILED,
        errorMessage: "JOB_FAILURE_V1|3|provider failed",
        updatedAt: new Date("2026-07-30T10:00:00.000Z"),
        effectiveAt: new Date("2026-07-30T09:00:00.000Z"),
        now: new Date("2026-07-30T11:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("resumes checkpointed work without consuming another failure attempt", () => {
    expect(parseJobExecutionState("JOB_CHECKPOINT_V1|2|20|45")).toMatchObject({
      kind: "checkpoint",
      attempt: 2,
    });
    expect(
      isJobRetryEligible({
        status: UnenrollJobStatus.PENDING,
        errorMessage: "JOB_CHECKPOINT_V1|2|20|45",
        updatedAt: new Date("2026-07-30T10:00:00.000Z"),
        effectiveAt: new Date("2026-07-30T09:00:00.000Z"),
        now: new Date("2026-07-30T10:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("bounds recipient work and skips durable completion receipts on resume", () => {
    const impactedUsers = Array.from({ length: 8 }, (_, index) => ({
      id: `user-${index + 1}`,
    }));
    const first = selectUnenrollRecipientBatch({
      impactedUsers,
      completedUserIds: [],
      limit: 3,
    });
    expect(first.batch.map((user) => user.id)).toEqual(["user-1", "user-2", "user-3"]);
    expect(first.remaining).toBe(5);

    const resumed = selectUnenrollRecipientBatch({
      impactedUsers,
      completedUserIds: first.batch.map((user) => user.id),
      limit: 3,
    });
    expect(resumed.batch.map((user) => user.id)).toEqual(["user-4", "user-5", "user-6"]);
    expect(resumed.completed).toBe(3);
    expect(resumed.remaining).toBe(2);
  });

  it("stops before the absolute deadline reserve is consumed", () => {
    expect(
      shouldStopUnenrollWork({
        nowMs: 34_999,
        deadlineAtMs: 40_000,
        reserveMs: 5_000,
      }),
    ).toBe(false);
    expect(
      shouldStopUnenrollWork({
        nowMs: 35_000,
        deadlineAtMs: 40_000,
        reserveMs: 5_000,
      }),
    ).toBe(true);
    expect(shouldStopUnenrollWork({ nowMs: Number.MAX_SAFE_INTEGER })).toBe(
      false,
    );
  });

  it("selects the same latest effective job for normal and retry ordering", () => {
    const jobs = [
      {
        id: "created-first-later-effective",
        effectiveAt: new Date("2026-07-30T12:00:00.000Z"),
        createdAt: new Date("2026-07-29T09:00:00.000Z"),
      },
      {
        id: "created-second-earlier-effective",
        effectiveAt: new Date("2026-07-30T10:00:00.000Z"),
        createdAt: new Date("2026-07-29T10:00:00.000Z"),
      },
    ];
    expect(selectLatestUnenrollJob(jobs)?.id).toBe(
      "created-first-later-effective",
    );

    const tied = jobs.map((job) => ({
      ...job,
      effectiveAt: new Date("2026-07-30T12:00:00.000Z"),
    }));
    expect(selectLatestUnenrollJob(tied)?.id).toBe(
      "created-second-earlier-effective",
    );
  });

  it("keeps tenant-vs-user precedence stable across normal and retry order", () => {
    const tenantEnrollment = {
      id: "tenant-enrollment-1",
      tenantId: "tenant-1",
      includeFutureUsers: false,
      createdAt: new Date("2026-07-10T00:00:00.000Z"),
    };
    const tenantJob = {
      id: "tenant-job-newer",
      targetScope: "TENANT" as const,
      targetId: "tenant-1",
      reportMode: "REVOKE" as const,
      effectiveAt: new Date("2026-07-30T12:00:00.000Z"),
      createdAt: new Date("2026-07-29T09:00:00.000Z"),
    };
    const userJob = {
      id: "user-job-older",
      targetScope: "USER" as const,
      targetId: "user-1",
      reportMode: "LINK_ONLY" as const,
      effectiveAt: new Date("2026-07-30T10:00:00.000Z"),
      createdAt: new Date("2026-07-29T10:00:00.000Z"),
    };
    const input = {
      userId: "user-1",
      tenantId: "tenant-1",
      userCreatedAt: new Date("2026-07-01T00:00:00.000Z"),
      tenantEnrollments: [tenantEnrollment],
    };

    expect(
      selectLatestApplicableUnenrollJobForRecipient({
        ...input,
        jobs: [userJob, tenantJob],
      })?.id,
    ).toBe(tenantJob.id);
    expect(
      selectLatestApplicableUnenrollJobForRecipient({
        ...input,
        // A retry can observe rows in a different order; precedence must not
        // depend on query/claim order.
        jobs: [tenantJob, userJob],
      })?.id,
    ).toBe(tenantJob.id);

    expect(
      selectLatestApplicableUnenrollJobForRecipient({
        ...input,
        userCreatedAt: new Date("2026-07-20T00:00:00.000Z"),
        jobs: [tenantJob, userJob],
      })?.id,
    ).toBe(userJob.id);
  });

  it("enforces due report modes for ordinary and job-issued share links", () => {
    expect(
      isReportShareTokenAllowed({
        role: "EMPLOYEE",
        hasActiveEnrollment: true,
        dueMode: "REVOKE",
        dueSourceJobId: "job-1",
        durableMode: null,
        durableSourceJobId: null,
        tokenSourceJobId: null,
      }),
    ).toBe(false);
    expect(
      isReportShareTokenAllowed({
        role: "EMPLOYEE",
        hasActiveEnrollment: true,
        dueMode: "LINK_ONLY",
        dueSourceJobId: "job-1",
        durableMode: null,
        durableSourceJobId: null,
        tokenSourceJobId: null,
      }),
    ).toBe(false);
    expect(
      isReportShareTokenAllowed({
        role: "EMPLOYEE",
        hasActiveEnrollment: false,
        dueMode: "LINK_ONLY",
        dueSourceJobId: "job-1",
        durableMode: null,
        durableSourceJobId: null,
        tokenSourceJobId: "job-1",
      }),
    ).toBe(true);
    expect(
      isReportShareTokenAllowed({
        role: "ADMIN",
        hasActiveEnrollment: true,
        dueMode: null,
        dueSourceJobId: null,
        durableMode: null,
        durableSourceJobId: null,
        tokenSourceJobId: null,
      }),
    ).toBe(false);
  });

  it("keeps completed durable overrides authoritative for share links", () => {
    expect(
      isReportShareTokenAllowed({
        role: "EMPLOYEE",
        hasActiveEnrollment: false,
        dueMode: null,
        dueSourceJobId: null,
        durableMode: "REVOKE",
        durableSourceJobId: "completed-job",
        tokenSourceJobId: null,
      }),
    ).toBe(false);
    expect(
      isReportShareTokenAllowed({
        role: "EMPLOYEE",
        hasActiveEnrollment: false,
        dueMode: null,
        dueSourceJobId: null,
        durableMode: "LINK_ONLY",
        durableSourceJobId: "completed-job",
        tokenSourceJobId: "completed-job",
      }),
    ).toBe(true);
    expect(
      isReportShareTokenAllowed({
        role: "EMPLOYEE",
        hasActiveEnrollment: false,
        dueMode: null,
        dueSourceJobId: null,
        durableMode: "KEEP_APP_ACCESS",
        durableSourceJobId: "completed-job",
        tokenSourceJobId: null,
      }),
    ).toBe(true);
    expect(
      isReportShareTokenAllowed({
        role: "EMPLOYEE",
        hasActiveEnrollment: false,
        dueMode: null,
        dueSourceJobId: null,
        durableMode: null,
        durableSourceJobId: null,
        tokenSourceJobId: null,
      }),
    ).toBe(false);
  });
});
