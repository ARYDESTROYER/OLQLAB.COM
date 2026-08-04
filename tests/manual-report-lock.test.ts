import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  lockManualReportMutation,
  manualReportMutationLockKey,
} from "@/lib/manual-report-lock";

describe("manual report mutation lock", () => {
  it("uses a stable report-scoped key", () => {
    expect(manualReportMutationLockKey("report-1")).toBe(
      "olq-manual-report:report-1",
    );
    expect(manualReportMutationLockKey("report-2")).not.toBe(
      manualReportMutationLockKey("report-1"),
    );
  });

  it("awaits a transaction-scoped advisory lock for the report", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    const tx = { $queryRaw: queryRaw } as unknown as Prisma.TransactionClient;

    await lockManualReportMutation(tx, "report-1");

    expect(queryRaw).toHaveBeenCalledOnce();
    const query = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(query.values).toEqual(["olq-manual-report:report-1"]);
    expect(query.text).toContain("pg_advisory_xact_lock");
  });
});
