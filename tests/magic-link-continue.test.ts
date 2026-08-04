import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { POST } from "@/app/api/auth/continue/route";
import {
  issueMagicLinkConfirmationNonce,
  MAGIC_LINK_CONFIRMATION_COOKIE,
  verifyMagicLinkConfirmationNonce,
} from "@/lib/magic-link-continue";

const APP_ORIGIN = "https://www.olqlab.test";
const originalNextAuthUrl = process.env.NEXTAUTH_URL;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

function verificationUrl(token = "token-a") {
  const url = new URL("/api/auth/callback/email", APP_ORIGIN);
  url.searchParams.set("token", token);
  url.searchParams.set("email", "person@example.com");
  return url.toString();
}

function continueRequest(input: {
  tokenUrl?: string;
  nonce?: string;
  origin?: string | null;
  secFetchSite?: string | null;
}) {
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
  });
  if (input.nonce) {
    headers.set("cookie", `${MAGIC_LINK_CONFIRMATION_COOKIE}=${input.nonce}`);
  }
  if (input.origin !== null) {
    headers.set("origin", input.origin ?? APP_ORIGIN);
  }
  if (input.secFetchSite !== null) {
    headers.set("sec-fetch-site", input.secFetchSite ?? "same-origin");
  }

  return new NextRequest(`${APP_ORIGIN}/api/auth/continue`, {
    method: "POST",
    headers,
    body: new URLSearchParams({ tokenUrl: input.tokenUrl ?? verificationUrl() }),
  });
}

function expectRejected(response: Response) {
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    `${APP_ORIGIN}/signin?error=invalid_link`,
  );
  expect(response.headers.get("set-cookie")).toContain(
    `${MAGIC_LINK_CONFIRMATION_COOKIE}=`,
  );
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
}

describe("magic-link confirmation continuation", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = APP_ORIGIN;
    process.env.NEXTAUTH_SECRET = "test-secret-".padEnd(48, "s");
  });

  afterAll(() => {
    if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = originalNextAuthUrl;
    if (originalNextAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
  });

  it("issues an HttpOnly, strict same-site nonce on a valid confirm-page GET", () => {
    const tokenUrl = verificationUrl();
    const confirmUrl = new URL("/signin/confirm", APP_ORIGIN);
    confirmUrl.searchParams.set("tokenUrl", tokenUrl);

    const response = proxy(new NextRequest(confirmUrl));
    const cookie = response.cookies.get(MAGIC_LINK_CONFIRMATION_COOKIE);

    expect(cookie?.value).toBeTruthy();
    expect(
      verifyMagicLinkConfirmationNonce({
        cookieValue: cookie?.value || "",
        canonicalTokenUrl: tokenUrl,
      }),
    ).toBe(true);
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=strict");
    expect(setCookie).toContain("Path=/api/auth/continue");
    expect(setCookie).toContain("Secure");
  });

  it("rejects a continue POST with a missing confirmation nonce", async () => {
    const response = await POST(continueRequest({}));

    expectRejected(response);
  });

  it("rejects cross-site Origin and Sec-Fetch-Site signals even with a valid nonce", async () => {
    const tokenUrl = verificationUrl();
    const nonce = issueMagicLinkConfirmationNonce(tokenUrl);

    const wrongOrigin = await POST(
      continueRequest({
        tokenUrl,
        nonce,
        origin: "https://attacker.example",
      }),
    );
    expectRejected(wrongOrigin);

    const crossSiteFetch = await POST(
      continueRequest({
        tokenUrl,
        nonce,
        secFetchSite: "cross-site",
      }),
    );
    expectRejected(crossSiteFetch);
  });

  it("consumes a valid nonce so a browser replay without the cookie is rejected", async () => {
    const tokenUrl = verificationUrl();
    const nonce = issueMagicLinkConfirmationNonce(tokenUrl);

    const accepted = await POST(continueRequest({ tokenUrl, nonce }));
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get("location")).toBe(tokenUrl);
    expect(accepted.headers.get("set-cookie")).toContain("Max-Age=0");

    const replay = await POST(continueRequest({ tokenUrl }));
    expectRejected(replay);
  });

  it("accepts a same-origin POST only when the nonce is bound to that token URL", async () => {
    const tokenUrl = verificationUrl();
    const nonce = issueMagicLinkConfirmationNonce(tokenUrl);

    const accepted = await POST(continueRequest({ tokenUrl, nonce }));
    expect(accepted.status).toBe(303);
    expect(accepted.headers.get("location")).toBe(tokenUrl);

    const swapped = await POST(
      continueRequest({
        tokenUrl: verificationUrl("token-b"),
        nonce,
      }),
    );
    expectRejected(swapped);
  });
});
