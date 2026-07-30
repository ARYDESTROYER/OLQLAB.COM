import { describe, expect, it } from "vitest";
import { normalizeSignInEmailPrefill } from "@/lib/signin-prefill";

describe("sign-in email prefill", () => {
  it("normalizes a single invite email", () => {
    expect(normalizeSignInEmailPrefill("  Participant@Example.COM ")).toBe(
      "participant@example.com",
    );
  });

  it("ignores ambiguous and oversized query values", () => {
    expect(normalizeSignInEmailPrefill(["one@example.com", "two@example.com"])).toBe("");
    expect(normalizeSignInEmailPrefill(`${"a".repeat(321)}@example.com`)).toBe("");
    expect(normalizeSignInEmailPrefill(undefined)).toBe("");
  });
});
