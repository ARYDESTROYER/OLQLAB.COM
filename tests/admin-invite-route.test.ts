import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  fallbackDelete: vi.fn(),
  fallbackUpdate: vi.fn(),
  requireAdmin: vi.fn(),
  sendEmail: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/audit-log", () => ({
  recordAuditLog: mocks.audit,
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    EMAIL_FROM: "invites@olqlab.test",
    NEXTAUTH_URL: "https://www.olqlab.test",
  }),
}));

vi.mock("@/lib/resend", () => ({
  EmailDeliveryError: class EmailDeliveryError extends Error {
    readonly providerCode: string;
    readonly statusCode: number | null;

    constructor(input: {
      message: string;
      providerCode: string;
      statusCode: number | null;
    }) {
      super(input.message);
      this.name = "EmailDeliveryError";
      this.providerCode = input.providerCode;
      this.statusCode = input.statusCode;
    }
  },
  sendEmailOrThrow: mocks.sendEmail,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    invite: {
      deleteMany: mocks.fallbackDelete,
      updateMany: mocks.fallbackUpdate,
    },
  },
}));

import { POST } from "@/app/api/admin/invites/send/route";
import { EmailDeliveryError } from "@/lib/resend";

function inviteRequest() {
  return new NextRequest("https://www.olqlab.com/api/admin/invites/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId: "tenant_1" }),
  });
}

function inviteTransactionClient(input: {
  retryableInvites?: Array<{
    id: string;
    email: string;
    deliveryAttemptCount: number;
  }>;
  freshSeats?: Array<{ id: string; userEmail: string }>;
  remaining?: number;
} = {}) {
  const deleteMany = vi.fn().mockImplementation(
    async (args: { where?: { id?: string } }) => ({
      count: args.where?.id ? 1 : 0,
    }),
  );
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce([{ lockResult: false }])
    .mockResolvedValueOnce(input.retryableInvites || [])
    .mockResolvedValueOnce(
      input.freshSeats || [
        { id: "seat_1", userEmail: "participant@example.com" },
      ],
    )
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ lockResult: false }])
    .mockResolvedValueOnce([{ count: input.remaining || 0 }]);
  return {
    $queryRaw: queryRaw,
    tenant: {
      findUnique: vi.fn().mockResolvedValue({
        id: "tenant_1",
        type: "ORGANIZATION",
        isArchived: false,
      }),
    },
    invite: {
      create: vi.fn().mockResolvedValue({
        id: "invite_1",
        email: "participant@example.com",
      }),
      deleteMany,
      updateMany,
    },
  };
}

describe("admin invite delivery reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.requireAdmin.mockResolvedValue({
      liveUser: { id: "admin_1", tenantId: "tenant_1" },
      session: { user: { id: "admin_1" } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps an active reservation when the delivery outcome is ambiguous", async () => {
    const tx = inviteTransactionClient({ remaining: 1 });
    mocks.transaction.mockImplementation(
      async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    );
    mocks.sendEmail.mockRejectedValue(new Error("provider response was lost"));

    const response = await POST(inviteRequest());
    const body = (await response.json()) as { remaining: number };

    expect(response.status).toBe(502);
    expect(body.remaining).toBe(1);
    expect(tx.invite.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.invite.deleteMany).not.toHaveBeenCalledWith({
      where: { id: "invite_1" },
    });
    expect(mocks.fallbackDelete).not.toHaveBeenCalled();
    expect(tx.invite.updateMany).toHaveBeenCalledWith({
      where: {
        id: "invite_1",
        deliveryState: "IN_FLIGHT",
        deliveryClaimId: expect.any(String),
      },
      data: {
        deliveryState: "UNKNOWN",
        deliveryClaimId: null,
        deliveryClaimedAt: null,
      },
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.invite.delivery_failed",
        metadata: expect.objectContaining({
          deliveryState: "DELIVERY_UNKNOWN",
          transitionApplied: true,
          reservationReleased: false,
        }),
      }),
      tx,
    );
  });

  it("releases the reservation after a definitive provider rejection", async () => {
    const tx = inviteTransactionClient();
    mocks.transaction.mockImplementation(
      async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    );
    mocks.sendEmail.mockRejectedValue(
      new EmailDeliveryError({
        message: "Recipient is suppressed.",
        providerCode: "validation_error",
        statusCode: 422,
      }),
    );

    const response = await POST(inviteRequest());

    expect(response.status).toBe(502);
    expect(tx.invite.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "invite_1",
        deliveryState: "IN_FLIGHT",
        deliveryClaimId: expect.any(String),
      },
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.invite.delivery_failed",
        metadata: expect.objectContaining({
          deliveryState: "DEFINITIVE_REJECTION",
          transitionApplied: true,
          reservationReleased: true,
        }),
      }),
      tx,
    );
  });

  it("reclaims an ambiguous reservation and replays the same provider idempotency key", async () => {
    const tx = inviteTransactionClient({
      retryableInvites: [
        {
          id: "invite_existing",
          email: "participant@example.com",
          deliveryAttemptCount: 1,
        },
      ],
      freshSeats: [],
    });
    mocks.transaction.mockImplementation(
      async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    );
    mocks.sendEmail.mockResolvedValue({ id: "email_accepted" });

    const response = await POST(inviteRequest());

    expect(response.status).toBe(200);
    expect(tx.invite.create).not.toHaveBeenCalled();
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "participant@example.com" }),
      { idempotencyKey: "invite:invite_existing" },
    );
    expect(tx.invite.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: "invite_existing" }),
        data: expect.objectContaining({
          deliveryState: "IN_FLIGHT",
          deliveryClaimId: expect.any(String),
          deliveryAttemptCount: { increment: 1 },
        }),
      }),
    );
    expect(tx.invite.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: "invite_existing",
          deliveryState: "IN_FLIGHT",
          deliveryClaimId: expect.any(String),
        },
        data: expect.objectContaining({
          deliveryState: "SENT",
          deliveryClaimId: null,
          providerDeliveryId: "email_accepted",
        }),
      }),
    );

    const retryQuery = tx.$queryRaw.mock.calls[1]?.[0] as { sql: string };
    expect(retryQuery.sql).toContain(
      `invite."deliveryState" = 'UNKNOWN'::"InviteDeliveryState"`,
    );
    expect(retryQuery.sql).toContain('invite."deliveryClaimedAt" <= ?');
    expect(retryQuery.sql).toContain("FOR UPDATE OF invite SKIP LOCKED");
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.invite.delivery_attempted",
        metadata: expect.objectContaining({
          inviteId: "invite_existing",
          attemptNumber: 2,
          replay: true,
        }),
      }),
      tx,
    );
  });
});
