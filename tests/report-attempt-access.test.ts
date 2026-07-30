import { describe, expect, it, vi } from "vitest";
import { revokeAttemptShareTokens } from "@/lib/report-attempt-access";

describe("assessment attempt share-link boundary", () => {
  it("revokes every active token for the user and assessment", async () => {
    const revokedAt = new Date("2026-07-30T10:00:00.000Z");
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const count = await revokeAttemptShareTokens(
      { assessmentReportShareToken: { updateMany } } as never,
      { assessmentId: "assessment-1", userId: "user-1", revokedAt },
    );

    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        assessmentId: "assessment-1",
        userId: "user-1",
        revokedAt: null,
      },
      data: { revokedAt },
    });
  });
});
