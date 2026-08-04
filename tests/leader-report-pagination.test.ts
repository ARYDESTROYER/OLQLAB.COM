import { describe, expect, it } from "vitest";
import {
  decodeLeaderReportCursor,
  encodeLeaderReportCursor,
  InvalidLeaderReportCursorError,
} from "@/lib/leader-report-pagination";

describe("leader report pagination cursors", () => {
  it("round-trips a submitted session boundary", () => {
    const cursor = encodeLeaderReportCursor({
      sessionId: "session_02",
      submittedAt: new Date("2026-07-30T10:15:00.000Z"),
    });

    expect(decodeLeaderReportCursor(cursor)).toEqual({
      sessionId: "session_02",
      submittedAt: new Date("2026-07-30T10:15:00.000Z"),
    });
  });

  it("round-trips the legacy-safe null submitted date boundary", () => {
    const cursor = encodeLeaderReportCursor({
      sessionId: "session_without_date",
      submittedAt: null,
    });

    expect(decodeLeaderReportCursor(cursor)).toEqual({
      sessionId: "session_without_date",
      submittedAt: null,
    });
  });

  it("rejects malformed, oversized, and non-canonical cursors", () => {
    const nonCanonicalDate = Buffer.from(
      JSON.stringify({
        v: 1,
        sessionId: "session_02",
        submittedAt: "2026-07-30T15:45:00+05:30",
      }),
      "utf8",
    ).toString("base64url");

    expect(() => decodeLeaderReportCursor("not-json")).toThrow(
      InvalidLeaderReportCursorError,
    );
    expect(() => decodeLeaderReportCursor("x".repeat(513))).toThrow(
      InvalidLeaderReportCursorError,
    );
    expect(() => decodeLeaderReportCursor(nonCanonicalDate)).toThrow(
      InvalidLeaderReportCursorError,
    );
  });
});
