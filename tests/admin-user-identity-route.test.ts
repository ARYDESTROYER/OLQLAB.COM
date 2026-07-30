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

import { PATCH } from "@/app/api/admin/users/[id]/route";

describe("admin identity changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      session: { user: { id: "admin_1" } },
      liveUser: { id: "admin_1", tenantId: "tenant_1" },
    });
  });

  it("atomically clears direct reports when a Leader is demoted", async () => {
    const updatedUser = {
      id: "leader_1",
      email: "leader@example.com",
      firstName: "Former",
      lastName: "Leader",
      role: "EMPLOYEE",
      tenantId: "tenant_1",
      managerId: null,
      tenant: { id: "tenant_1", name: "Example", type: "ORGANIZATION" },
      manager: null,
    };
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "leader_1",
          email: "leader@example.com",
          tenantId: "tenant_1",
          managerId: null,
          role: "LEADER",
        }),
        findFirst: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        update: vi.fn().mockResolvedValue(updatedUser),
        count: vi.fn(),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({
          id: "tenant_1",
          type: "ORGANIZATION",
          isArchived: false,
          seatLimit: 10,
        }),
      },
      assessmentUserEnrollment: { updateMany: vi.fn() },
      assessmentReportAccessOverride: { deleteMany: vi.fn() },
      assessmentReportShareToken: { updateMany: vi.fn() },
    };
    mocks.transaction.mockImplementation(
      async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    );

    const response = await PATCH(
      new NextRequest("https://www.olqlab.com/api/admin/users/leader_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "EMPLOYEE" }),
      }),
      { params: Promise.resolve({ id: "leader_1" }) },
    );

    expect(response.status).toBe(200);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { managerId: "leader_1" },
      data: { managerId: null },
    });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "leader_1" },
        data: expect.objectContaining({ role: "EMPLOYEE" }),
      }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ clearedDirectReports: 2 }),
      }),
      tx,
    );
  });
});
