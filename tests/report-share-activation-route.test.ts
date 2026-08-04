import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ NEXTAUTH_SECRET: "test-secret" }),
}));
vi.mock("@/lib/unenroll-jobs", () => ({
  lookupReportShareToken: mocks.lookup,
}));

import { POST } from "@/app/api/reports/shared/[token]/activate/route";

function request(headers?: Record<string, string>) {
  return new NextRequest(
    "https://www.olqlab.com/api/reports/shared/bearer-token/activate",
    {
      method: "POST",
      headers,
    },
  );
}

describe("report share activation route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects cross-site activation before token lookup", async () => {
    const response = await POST(
      request({ origin: "https://evil.example", "sec-fetch-site": "cross-site" }),
      { params: Promise.resolve({ token: "bearer-token" }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("sets a short-lived HttpOnly grant and redirects after explicit confirmation", async () => {
    mocks.lookup.mockResolvedValue({ id: "token-row" });
    const response = await POST(
      request({
        origin: "https://www.olqlab.com",
        "sec-fetch-site": "same-origin",
      }),
      { params: Promise.resolve({ token: "bearer-token" }) },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://www.olqlab.com/reports/shared/bearer-token",
    );
    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie).toContain("olq_report_grant_");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=strict");
  });

  it("keeps invalid-token responses generic and grants no cookie", async () => {
    mocks.lookup.mockResolvedValue(null);
    const response = await POST(
      request({
        origin: "https://www.olqlab.com",
        "sec-fetch-site": "same-origin",
      }),
      { params: Promise.resolve({ token: "bearer-token" }) },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("unavailable=1");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
