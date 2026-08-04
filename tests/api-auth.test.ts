import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

import { requireAdmin } from "@/lib/api-auth";

describe("live authentication compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps an active persisted Solo administrator authenticated", async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: {
        id: "legacy-solo-admin",
        email: "legacy@example.com",
        firstName: "Legacy",
        lastName: "Admin",
        role: "ADMIN",
        tenantId: "solo-tenant",
      },
    });
    mocks.userFindUnique.mockResolvedValue({
      id: "legacy-solo-admin",
      email: "legacy@example.com",
      firstName: "Legacy",
      lastName: "Admin",
      role: "ADMIN",
      tenantId: "solo-tenant",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      tenant: {
        name: "Legacy Solo Organisation",
        type: "SOLO",
        isArchived: false,
      },
    });

    const result = await requireAdmin();

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.liveUser).toMatchObject({
      id: "legacy-solo-admin",
      role: "ADMIN",
      tenant: { type: "SOLO", isArchived: false },
    });
    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          createdAt: true,
          tenant: {
            select: expect.objectContaining({ name: true }),
          },
        }),
      }),
    );
  });
});
