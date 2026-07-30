import { describe, expect, it } from "vitest";
import {
  buildPersistentRateLimitBucket,
  consumePersistentMagicLinkRateLimit,
  FixedWindowRateLimiter,
  isMagicLinkRecipientEligible,
  resolveVerificationRequestDecision,
  type PersistentRateLimitBucket,
} from "@/lib/auth-security";

describe("magic-link rate limiting", () => {
  it("enforces a fixed window, resets, and bounds local memory", () => {
    const limiter = new FixedWindowRateLimiter(2);
    expect(limiter.consume({ key: "a", limit: 1, windowMs: 100, nowMs: 0 })).toBe(true);
    expect(limiter.consume({ key: "a", limit: 1, windowMs: 100, nowMs: 1 })).toBe(false);
    expect(limiter.consume({ key: "a", limit: 1, windowMs: 100, nowMs: 100 })).toBe(true);
    limiter.consume({ key: "b", limit: 1, windowMs: 100, nowMs: 100 });
    limiter.consume({ key: "c", limit: 1, windowMs: 100, nowMs: 100 });
    expect(limiter.size()).toBe(2);
  });

  it("uses non-PII persistent keys and changes buckets at the window boundary", () => {
    const first = buildPersistentRateLimitBucket({
      dimension: "email",
      value: "person@example.com",
      limit: 5,
      windowMs: 1_000,
      nowMs: 999,
    });
    const second = buildPersistentRateLimitBucket({
      dimension: "email",
      value: "person@example.com",
      limit: 5,
      windowMs: 1_000,
      nowMs: 1_000,
    });
    expect(first.key).not.toContain("person@example.com");
    expect(first.key).not.toBe(second.key);
    expect(first.resetAt).toEqual(new Date(1_000));
  });

  it("allows only five concurrent email attempts through the shared counter", async () => {
    const counts = new Map<string, number>();
    const increment = async (bucket: PersistentRateLimitBucket) => {
      const next = (counts.get(bucket.key) || 0) + 1;
      counts.set(bucket.key, next);
      return next;
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        consumePersistentMagicLinkRateLimit(
          { email: "person@example.com", ip: null, nowMs: 10_000 },
          increment,
        ),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(results.at(-1)).toBe(false);
  });
});

describe("magic-link enumeration boundary", () => {
  it("uses the same generic success URL for unknown and rate-limited recipients", () => {
    const unknown = resolveVerificationRequestDecision({
      rateLimitPassed: true,
      recipientEligible: false,
      authOrigin: "https://www.olqlab.com",
    });
    const throttled = resolveVerificationRequestDecision({
      rateLimitPassed: false,
      recipientEligible: true,
      authOrigin: "https://www.olqlab.com",
    });
    expect(unknown).toBe(throttled);
    expect(unknown).toBe(
      "https://www.olqlab.com/api/auth/verify-request?provider=email&type=email",
    );
  });

  it("rejects unknown, unseated, archived, and solo-admin recipients", () => {
    const base = {
      hasUser: true,
      hasSeat: true,
      tenantArchived: false,
      tenantType: "ORGANIZATION" as const,
      role: "EMPLOYEE" as const,
    };
    expect(isMagicLinkRecipientEligible(base)).toBe(true);
    expect(isMagicLinkRecipientEligible({ ...base, hasSeat: false })).toBe(false);
    expect(isMagicLinkRecipientEligible({ ...base, tenantArchived: true })).toBe(false);
    expect(
      isMagicLinkRecipientEligible({
        ...base,
        role: "ADMIN",
        tenantType: "SOLO",
      }),
    ).toBe(false);
  });
});
