import { describe, expect, it } from "vitest";
import { buildCsv } from "@/lib/csv";

describe("buildCsv", () => {
  it("neutralizes spreadsheet formulas in string cells", () => {
    const csv = buildCsv(["value"], [
      ["=HYPERLINK(\"https://example.test\")"],
      [" +SUM(1,2)"],
      ["-2+3"],
      ["@SUM(1,2)"],
      ["\uFEFF@SUM(1,2)"],
    ]);

    expect(csv).toContain("\"'=HYPERLINK(\"\"https://example.test\"\")\"");
    expect(csv).toContain("\"' +SUM(1,2)\"");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("\"'@SUM(1,2)\"");
    expect(csv).toContain("\"'\uFEFF@SUM(1,2)\"");
  });

  it("preserves numeric values and normal text", () => {
    expect(buildCsv(["label", "value"], [["normal", -2]])).toBe(
      "label,value\nnormal,-2\n",
    );
  });
});
