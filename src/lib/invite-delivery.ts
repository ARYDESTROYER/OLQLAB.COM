import { EmailDeliveryError } from "@/lib/resend";

export const INVITE_DELIVERY_CLAIM_TTL_MS = 5 * 60 * 1_000;

export function getInviteDeliveryStaleBefore(now: Date) {
  return new Date(now.getTime() - INVITE_DELIVERY_CLAIM_TTL_MS);
}

export type SkippedInviteSeat = {
  email: string;
  reason:
    | "USER_MISSING"
    | "USER_IN_DIFFERENT_ORGANISATION"
    | "ADMIN_ACCOUNT";
};

export function shouldReleaseInviteReservation(error: unknown) {
  return (
    error instanceof EmailDeliveryError &&
    error.providerCode !== "missing_delivery_id"
  );
}

export function classifySkippedInviteSeat(input: {
  email: string;
  userId: string | null;
  userTenantId: string | null;
  seatTenantId: string;
  role: "ADMIN" | "EMPLOYEE" | "LEADER" | null;
}): SkippedInviteSeat {
  if (!input.userId) {
    return { email: input.email, reason: "USER_MISSING" };
  }
  if (input.userTenantId !== input.seatTenantId) {
    return {
      email: input.email,
      reason: "USER_IN_DIFFERENT_ORGANISATION",
    };
  }
  if (input.role === "ADMIN") {
    return { email: input.email, reason: "ADMIN_ACCOUNT" };
  }
  throw new Error("An eligible participant seat cannot be classified as skipped.");
}

export function buildInviteDeliveryResult(input: {
  attempted: number;
  sent: number;
  failed: Array<{ email: string }>;
  remaining: number;
  auditWarnings: Array<{ email: string }>;
  skipped: SkippedInviteSeat[];
  skippedCount: number;
}) {
  if (input.sent + input.failed.length !== input.attempted) {
    throw new Error("Invite delivery accounting is inconsistent.");
  }
  if (input.skippedCount < input.skipped.length) {
    throw new Error("Invite skip accounting is inconsistent.");
  }
  return {
    status: input.failed.length > 0 ? 502 : 200,
    body: {
      invited: input.sent,
      failed: input.failed,
      attempted: input.attempted,
      remaining: Math.max(0, input.remaining),
      auditWarnings: input.auditWarnings,
      skipped: input.skipped,
      skippedCount: Math.max(0, input.skippedCount),
    },
  };
}
