import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const MAGIC_LINK_WINDOW_MS = 15 * 60 * 1000;
const MAGIC_LINK_EMAIL_LIMIT = 5;
const MAGIC_LINK_IP_LIMIT = 20;
const MAGIC_LINK_MAX_BUCKETS = 10_000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;
const RATE_LIMIT_CLEANUP_BATCH = 100;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

declare global {
  var __olqMagicLinkRateLimits: RateLimitStore | undefined;
  var __olqMagicLinkRateLimitCleanupAt: number | undefined;
}

function hashRateLimitKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export class FixedWindowRateLimiter {
  private readonly entries: RateLimitStore;

  constructor(
    private readonly maxEntries: number,
    entries: RateLimitStore = new Map(),
  ) {
    this.entries = entries;
  }

  consume(input: {
    key: string;
    limit: number;
    windowMs: number;
    nowMs?: number;
  }) {
    const nowMs = input.nowMs ?? Date.now();
    const current = this.entries.get(input.key);

    if (!current || current.resetAt <= nowMs) {
      this.makeRoom(nowMs, input.key);
      this.entries.set(input.key, {
        count: 1,
        resetAt: nowMs + input.windowMs,
      });
      return true;
    }

    current.count += 1;
    return current.count <= input.limit;
  }

  size() {
    return this.entries.size;
  }

  private makeRoom(nowMs: number, incomingKey: string) {
    if (this.entries.has(incomingKey) || this.entries.size < this.maxEntries) return;

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= nowMs) this.entries.delete(key);
    }

    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }
}

const sharedMagicLinkStore =
  globalThis.__olqMagicLinkRateLimits ||
  (globalThis.__olqMagicLinkRateLimits = new Map<string, RateLimitEntry>());
const magicLinkLimiter = new FixedWindowRateLimiter(
  MAGIC_LINK_MAX_BUCKETS,
  sharedMagicLinkStore,
);

export function extractClientIp(headers: Pick<Headers, "get">) {
  const directIp = headers.get("x-real-ip")?.trim();
  if (directIp) return directIp;

  const forwarded = headers.get("x-forwarded-for");
  const firstForwardedIp = forwarded?.split(",")[0]?.trim();
  return firstForwardedIp || null;
}

export type PersistentRateLimitBucket = {
  key: string;
  limit: number;
  resetAt: Date;
};

export function buildPersistentRateLimitBucket(input: {
  dimension: "email" | "ip";
  value: string;
  limit: number;
  windowMs: number;
  nowMs: number;
}): PersistentRateLimitBucket {
  const bucketStartMs = Math.floor(input.nowMs / input.windowMs) * input.windowMs;
  const keyHash = hashRateLimitKey(
    `${input.dimension}:${input.value}:${bucketStartMs}`,
  );

  return {
    key: `${input.dimension}:${keyHash}`,
    limit: input.limit,
    resetAt: new Date(bucketStartMs + input.windowMs),
  };
}

type IncrementPersistentBucket = (
  bucket: PersistentRateLimitBucket,
) => Promise<number>;

async function incrementPersistentBucket(bucket: PersistentRateLimitBucket) {
  const rows = await db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "AuthRateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${bucket.key}, 1, ${bucket.resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE
      SET "count" = "AuthRateLimitBucket"."count" + 1,
          "resetAt" = EXCLUDED."resetAt",
          "updatedAt" = NOW()
    RETURNING "count"
  `);

  return Number(rows[0]?.count || 0);
}

async function cleanupExpiredPersistentBuckets(nowMs: number) {
  const lastCleanupAt = globalThis.__olqMagicLinkRateLimitCleanupAt || 0;
  if (nowMs - lastCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) return;
  globalThis.__olqMagicLinkRateLimitCleanupAt = nowMs;

  await db.$executeRaw(Prisma.sql`
    DELETE FROM "AuthRateLimitBucket"
    WHERE "key" IN (
      SELECT "key"
      FROM "AuthRateLimitBucket"
      WHERE "resetAt" <= ${new Date(nowMs)}
      ORDER BY "resetAt" ASC
      LIMIT ${RATE_LIMIT_CLEANUP_BATCH}
    )
  `);
}

export async function consumePersistentMagicLinkRateLimit(
  input: {
    email: string;
    ip: string | null;
    nowMs?: number;
  },
  incrementBucket: IncrementPersistentBucket = incrementPersistentBucket,
) {
  const nowMs = input.nowMs ?? Date.now();
  const normalizedEmail = input.email.trim().toLowerCase();
  const buckets = [
    buildPersistentRateLimitBucket({
      dimension: "email",
      value: normalizedEmail,
      limit: MAGIC_LINK_EMAIL_LIMIT,
      windowMs: MAGIC_LINK_WINDOW_MS,
      nowMs,
    }),
    ...(input.ip
      ? [
          buildPersistentRateLimitBucket({
            dimension: "ip" as const,
            value: input.ip,
            limit: MAGIC_LINK_IP_LIMIT,
            windowMs: MAGIC_LINK_WINDOW_MS,
            nowMs,
          }),
        ]
      : []),
  ];

  const counts = await Promise.all(buckets.map((bucket) => incrementBucket(bucket)));
  return counts.every((count, index) => count <= buckets[index].limit);
}

export async function consumeMagicLinkRateLimit(input: {
  email: string;
  ip: string | null;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const normalizedEmail = input.email.trim().toLowerCase();
  const emailAllowed = magicLinkLimiter.consume({
    key: `email:${hashRateLimitKey(normalizedEmail)}`,
    limit: MAGIC_LINK_EMAIL_LIMIT,
    windowMs: MAGIC_LINK_WINDOW_MS,
    nowMs,
  });
  const ipAllowed = input.ip
    ? magicLinkLimiter.consume({
        key: `ip:${hashRateLimitKey(input.ip)}`,
        limit: MAGIC_LINK_IP_LIMIT,
        windowMs: MAGIC_LINK_WINDOW_MS,
        nowMs,
      })
    : true;

  if (!emailAllowed || !ipAllowed) return false;

  try {
    const allowed = await consumePersistentMagicLinkRateLimit({
      email: normalizedEmail,
      ip: input.ip,
      nowMs,
    });
    await cleanupExpiredPersistentBuckets(nowMs);
    return allowed;
  } catch (error) {
    // Authentication throttling fails closed. A database/schema outage must not
    // silently remove the abuse boundary or leak whether an account exists.
    console.error("Magic-link rate limiting failed closed.", error);
    return false;
  }
}

export function isMagicLinkRecipientEligible(input: {
  hasUser: boolean;
  hasSeat: boolean;
  tenantArchived: boolean;
  tenantType: "ORGANIZATION" | "SOLO";
  role: "ADMIN" | "EMPLOYEE" | "LEADER";
}) {
  if (!input.hasUser || !input.hasSeat || input.tenantArchived) return false;
  return input.role !== "ADMIN" || input.tenantType === "ORGANIZATION";
}

export function resolveVerificationRequestDecision(input: {
  rateLimitPassed: boolean;
  recipientEligible: boolean;
  authOrigin: string;
}) {
  if (input.rateLimitPassed && input.recipientEligible) return true as const;

  const verifyRequestUrl = new URL("/api/auth/verify-request", input.authOrigin);
  verifyRequestUrl.searchParams.set("provider", "email");
  verifyRequestUrl.searchParams.set("type", "email");
  return verifyRequestUrl.toString();
}
