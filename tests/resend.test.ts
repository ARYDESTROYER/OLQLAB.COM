import { describe, expect, it } from "vitest";
import { assertEmailDelivered, EmailDeliveryError } from "@/lib/resend";

describe("Resend result checking", () => {
  it("returns the provider delivery id on success", () => {
    expect(
      assertEmailDelivered({
        data: { id: "email-123" },
        error: null,
        headers: null,
      }),
    ).toEqual({ id: "email-123" });
  });

  it("throws a typed error when Resend resolves with an error result", () => {
    expect(() =>
      assertEmailDelivered({
        data: null,
        error: {
          message: "quota exceeded",
          name: "daily_quota_exceeded",
          statusCode: 429,
        },
        headers: null,
      }),
    ).toThrow(EmailDeliveryError);
  });
});
