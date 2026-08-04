import { describe, expect, it } from "vitest";
import { hasTenantSeatCapacity } from "@/lib/tenant-seat-lock";

describe("tenant seat inventory policy", () => {
  it("rejects a new reservation at capacity", () => {
    expect(
      hasTenantSeatCapacity({
        seatLimit: 5,
        currentSeatCount: 5,
        hasExistingSeat: false,
      }),
    ).toBe(false);
  });

  it("allows an existing seat to be reused at capacity", () => {
    expect(
      hasTenantSeatCapacity({
        seatLimit: 5,
        currentSeatCount: 5,
        hasExistingSeat: true,
      }),
    ).toBe(true);
  });
});
