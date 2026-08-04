import { describe, expect, it } from "vitest";
import {
  formatReportArchiveReason,
  takeBoundedReportHistory,
} from "@/lib/report-archive-history";

describe("report archive history", () => {
  it("uses operator-friendly labels for known and legacy archive reasons", () => {
    expect(formatReportArchiveReason("scheduled_retest_started")).toBe("Retest started");
    expect(formatReportArchiveReason("manual_pdf_replaced")).toBe("Manual PDF replaced");
    expect(formatReportArchiveReason("legacy-custom_reason")).toBe(
      "Legacy custom reason",
    );
    expect(formatReportArchiveReason(null)).toBe("Archived report");
  });

  it("returns only the bounded prefix and reports hidden history", () => {
    expect(takeBoundedReportHistory([1, 2, 3], 2)).toEqual({
      items: [1, 2],
      hasMore: true,
    });
    expect(takeBoundedReportHistory([1, 2], 2)).toEqual({
      items: [1, 2],
      hasMore: false,
    });
  });
});
