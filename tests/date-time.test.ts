import { describe, expect, it } from "vitest";
import { formatLocalDateTime } from "@/lib/date-time";

describe("local date-time formatting", () => {
  it("formats a valid timestamp with an explicit time-zone label without throwing", () => {
    expect(() =>
      formatLocalDateTime("2026-07-30T10:15:00.000Z"),
    ).not.toThrow();
    expect(formatLocalDateTime("2026-07-30T10:15:00.000Z")).toMatch(
      /2026/,
    );
  });

  it("returns the requested fallback for missing or invalid values", () => {
    expect(formatLocalDateTime(null)).toBe("Not available");
    expect(
      formatLocalDateTime("not-a-date", { fallback: "Date unavailable" }),
    ).toBe("Date unavailable");
  });
});
