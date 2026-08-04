import { describe, expect, it } from "vitest";
import {
  bearerAuthorizationMatches,
  constantTimeSecretMatches,
} from "@/lib/internal-job-auth";

describe("internal job authorization", () => {
  const secret = "s".repeat(32);

  it("accepts only an exact Bearer cron secret", () => {
    expect(bearerAuthorizationMatches(`Bearer ${secret}`, secret)).toBe(true);
    expect(bearerAuthorizationMatches(`bearer ${secret}`, secret)).toBe(false);
    expect(bearerAuthorizationMatches(`Bearer ${secret}x`, secret)).toBe(false);
    expect(bearerAuthorizationMatches(null, secret)).toBe(false);
  });

  it("rejects missing and length-mismatched legacy secrets", () => {
    expect(constantTimeSecretMatches(secret, secret)).toBe(true);
    expect(constantTimeSecretMatches("short", secret)).toBe(false);
    expect(constantTimeSecretMatches(secret, undefined)).toBe(false);
  });
});
