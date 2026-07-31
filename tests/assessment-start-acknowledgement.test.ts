import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  resolveAccess: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/assessment-access", () => ({
  resolveAssessmentAccess: mocks.resolveAccess,
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { POST } from "@/app/api/assessment/sessions/start/route";
import sitemap from "@/app/sitemap";

function startRequest(acknowledged?: boolean) {
  return new NextRequest("https://www.olqlab.com/api/assessment/sessions/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assessmentId: "assessment-1", acknowledged }),
  });
}

describe("assessment response-processing acknowledgement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({
      session: { user: { id: "user-1" } },
    });
  });

  it.each([undefined, false])(
    "rejects a missing or false acknowledgement (%s)",
    async (acknowledged) => {
      const response = await POST(startRequest(acknowledged));

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: "Acknowledge response processing before starting.",
      });
      expect(mocks.resolveAccess).not.toHaveBeenCalled();
    },
  );

  it("allows an acknowledged request to progress to access resolution", async () => {
    mocks.resolveAccess.mockResolvedValue({ assessmentExists: false });

    const response = await POST(startRequest(true));

    expect(mocks.resolveAccess).toHaveBeenCalledWith("user-1", "assessment-1");
    expect(response.status).toBe(404);
  });
});

describe("temporary legal-route removal", () => {
  it("keeps Privacy and Terms out of the public sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).not.toContain("https://www.olqlab.com/privacy");
    expect(urls).not.toContain("https://www.olqlab.com/terms");
  });
});
