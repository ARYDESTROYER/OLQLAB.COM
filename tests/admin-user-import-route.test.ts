import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  requireAdmin: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/audit-log", () => ({
  recordAuditLog: mocks.audit,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/admin/users/import-csv/route";

describe("admin user CSV import seat capacity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      liveUser: { id: "admin_1", tenantId: "tenant_1" },
      session: { user: { id: "admin_1" } },
    });
  });

  it("does not bypass a full Organisation when repairing an existing user without a Seat", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lockResult: false }]),
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          id: "tenant_1",
          name: "Full Organisation",
          seatLimit: 1,
          isArchived: false,
          type: "ORGANIZATION",
        }),
        createMany: vi.fn(),
      },
      seat: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(1),
        createMany: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "existing_user",
            email: "existing@example.com",
            tenantId: "tenant_1",
          },
        ]),
        createMany: vi.fn(),
        update: vi.fn(),
      },
    };
    mocks.transaction.mockImplementation(
      async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    );

    const response = await POST(
      new NextRequest("https://www.olqlab.com/api/admin/users/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ORGANIZATION",
          tenantId: "tenant_1",
          csvText: "email,first_name,last_name\nexisting@example.com,Existing,User",
        }),
      }),
    );
    const body = (await response.json()) as {
      summary: { repairedCount: number; skippedCount: number };
      issues: Array<{ reason: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.summary).toMatchObject({ repairedCount: 0, skippedCount: 1 });
    expect(body.issues).toContainEqual(
      expect.objectContaining({ reason: "seat_limit_reached" }),
    );
    expect(tx.seat.createMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
