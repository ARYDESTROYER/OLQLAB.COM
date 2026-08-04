import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseRuntimeEnv: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  parseRuntimeEnv: mocks.parseRuntimeEnv,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: mocks.queryRaw,
  },
}));

import { GET } from "@/app/api/health/ready/route";

describe("readiness route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires runtime configuration, database access, and auth rate-limit schema", async () => {
    mocks.parseRuntimeEnv.mockReturnValue({});
    mocks.queryRaw
      .mockResolvedValueOnce([{ result: 1 }])
      .mockResolvedValueOnce([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({
      status: "ready",
      checks: {
        runtimeConfiguration: "ok",
        database: "ok",
        authRateLimitSchema: "ok",
      },
    });
  });

  it("fails before checking schema when the database is unavailable", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.parseRuntimeEnv.mockReturnValue({});
    mocks.queryRaw.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({
      status: "not_ready",
      checks: {
        runtimeConfiguration: "ok",
        database: "failed",
        authRateLimitSchema: "unknown",
      },
    });
    consoleError.mockRestore();
  });

  it("fails before querying the database when runtime configuration is invalid", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.parseRuntimeEnv.mockImplementation(() => {
      throw new Error("invalid environment");
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      checks: { runtimeConfiguration: "failed" },
    });
    consoleError.mockRestore();
  });

  it("fails when the authentication rate-limit migration is missing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.parseRuntimeEnv.mockReturnValue({});
    mocks.queryRaw
      .mockResolvedValueOnce([{ result: 1 }])
      .mockRejectedValueOnce(new Error("relation does not exist"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "not_ready",
      checks: {
        runtimeConfiguration: "ok",
        database: "ok",
        authRateLimitSchema: "failed",
      },
    });
    consoleError.mockRestore();
  });
});
