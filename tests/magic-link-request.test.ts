import { describe, expect, it, vi } from "vitest";
import {
  isAcceptedMagicLinkRequest,
  requestMagicLink,
} from "@/lib/magic-link-request";

const ORIGIN = "https://staging.olqlab.com";
const VERIFY_REQUEST_URL =
  `${ORIGIN}/api/auth/verify-request?provider=email&type=email`;

describe("magic-link request result handling", () => {
  it("accepts completed email-flow responses without exposing recipient state", () => {
    expect(
      isAcceptedMagicLinkRequest({
        error: null,
        ok: true,
        status: 200,
        url: VERIFY_REQUEST_URL,
      }),
    ).toBe(true);

    expect(
      isAcceptedMagicLinkRequest({
        error: "EmailSignin",
        ok: true,
        status: 200,
        url: null,
      }),
    ).toBe(true);
  });

  it.each([
    undefined,
    { error: null, ok: false, status: 500, url: VERIFY_REQUEST_URL },
  ])("rejects an unsuccessful or unexpected response %#", (response) => {
    expect(isAcceptedMagicLinkRequest(response)).toBe(false);
  });

  it("converts transport failures into the visible error state", async () => {
    const signInRequest = vi.fn().mockRejectedValue(new Error("network unavailable"));

    await expect(
      requestMagicLink({
        email: "person@example.com",
        signInRequest,
      }),
    ).resolves.toBe("error");
  });

  it("returns accepted for a completed verification request", async () => {
    const signInRequest = vi.fn().mockResolvedValue({
      error: null,
      ok: true,
      status: 200,
      url: VERIFY_REQUEST_URL,
    });

    await expect(
      requestMagicLink({
        email: "person@example.com",
        signInRequest,
      }),
    ).resolves.toBe("accepted");
    expect(signInRequest).toHaveBeenCalledWith("email", {
      email: "person@example.com",
      redirect: false,
      callbackUrl: "/dashboard",
    });
  });
});
