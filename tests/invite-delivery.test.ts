import { describe, expect, it } from "vitest";
import {
  buildInviteDeliveryResult,
  classifySkippedInviteSeat,
  getInviteDeliveryStaleBefore,
  INVITE_DELIVERY_CLAIM_TTL_MS,
  shouldReleaseInviteReservation,
} from "@/lib/invite-delivery";
import { EmailDeliveryError } from "@/lib/resend";

describe("invite delivery accounting", () => {
  it("uses a bounded claim lease so a crashed sender can be replayed", () => {
    const now = new Date("2026-07-30T10:00:00.000Z");
    expect(getInviteDeliveryStaleBefore(now).getTime()).toBe(
      now.getTime() - INVITE_DELIVERY_CLAIM_TTL_MS,
    );
    expect(INVITE_DELIVERY_CLAIM_TTL_MS).toBe(5 * 60 * 1_000);
  });

  it("surfaces provider failures and preserves the locked remaining count", () => {
    expect(
      buildInviteDeliveryResult({
        attempted: 3,
        sent: 2,
        failed: [{ email: "failed@example.com" }],
        remaining: 7,
        auditWarnings: [],
        skipped: [{ email: "orphan@example.com", reason: "USER_MISSING" }],
        skippedCount: 2,
      }),
    ).toEqual({
      status: 502,
      body: {
        invited: 2,
        failed: [{ email: "failed@example.com" }],
        attempted: 3,
        remaining: 7,
        auditWarnings: [],
        skipped: [{ email: "orphan@example.com", reason: "USER_MISSING" }],
        skippedCount: 2,
      },
    });
  });

  it("rejects accounting that could silently drop a reserved recipient", () => {
    expect(() =>
      buildInviteDeliveryResult({
        attempted: 3,
        sent: 1,
        failed: [],
        remaining: 0,
        auditWarnings: [],
        skipped: [],
        skippedCount: 0,
      }),
    ).toThrow("accounting is inconsistent");
  });

  it("distinguishes orphan, cross-organisation, and admin seats", () => {
    expect(
      classifySkippedInviteSeat({
        email: "missing@example.com",
        userId: null,
        userTenantId: null,
        seatTenantId: "tenant_1",
        role: null,
      }),
    ).toEqual({ email: "missing@example.com", reason: "USER_MISSING" });
    expect(
      classifySkippedInviteSeat({
        email: "moved@example.com",
        userId: "user_1",
        userTenantId: "tenant_2",
        seatTenantId: "tenant_1",
        role: "EMPLOYEE",
      }),
    ).toEqual({
      email: "moved@example.com",
      reason: "USER_IN_DIFFERENT_ORGANISATION",
    });
    expect(
      classifySkippedInviteSeat({
        email: "admin@example.com",
        userId: "admin_1",
        userTenantId: "tenant_1",
        seatTenantId: "tenant_1",
        role: "ADMIN",
      }),
    ).toEqual({ email: "admin@example.com", reason: "ADMIN_ACCOUNT" });
  });

  it("preserves reservations after ambiguous failures and releases definitive rejections", () => {
    expect(
      shouldReleaseInviteReservation(new Error("provider response was lost")),
    ).toBe(false);
    expect(
      shouldReleaseInviteReservation(
        new EmailDeliveryError({
          message: "Email provider returned no delivery identifier.",
          providerCode: "missing_delivery_id",
          statusCode: null,
        }),
      ),
    ).toBe(false);
    expect(
      shouldReleaseInviteReservation(
        new EmailDeliveryError({
          message: "Recipient is suppressed.",
          providerCode: "validation_error",
          statusCode: 422,
        }),
      ),
    ).toBe(true);
  });
});
