import { describe, expect, it, vi } from "vitest";
import { attemptMagicLinkDelivery } from "@/lib/magic-link-delivery";
import { EmailDeliveryError } from "@/lib/resend";

describe("magic-link provider delivery boundary", () => {
  it("reports successful provider acceptance", async () => {
    const log = vi.fn();

    await expect(
      attemptMagicLinkDelivery(() => Promise.resolve({ id: "email-123" }), log),
    ).resolves.toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it("masks provider failure while logging only non-PII diagnostics", async () => {
    const log = vi.fn();
    const deliveryError = new EmailDeliveryError({
      message: "recipient address must not appear in logs",
      providerCode: "validation_error",
      statusCode: 422,
    });

    await expect(
      attemptMagicLinkDelivery(() => Promise.reject(deliveryError), log),
    ).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(
      "Magic-link provider delivery failed after request acceptance.",
      {
        errorName: "EmailDeliveryError",
        providerCode: "validation_error",
        statusCode: 422,
      },
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(deliveryError.message);
  });
});
