import { NextRequest, NextResponse } from "next/server";
import {
  issueMagicLinkConfirmationNonce,
  magicLinkConfirmationCookieOptions,
  MAGIC_LINK_CONFIRMATION_COOKIE,
  validateVerificationCallbackUrl,
} from "@/lib/magic-link-continue";

export function proxy(req: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");

  if (req.method !== "GET") return response;

  const tokenUrlRaw = req.nextUrl.searchParams.get("tokenUrl") || "";
  const validated = validateVerificationCallbackUrl(tokenUrlRaw);
  const cookieOptions = magicLinkConfirmationCookieOptions({
    secure: req.nextUrl.protocol === "https:",
  });

  if (!validated) {
    response.cookies.set(MAGIC_LINK_CONFIRMATION_COOKIE, "", {
      ...cookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  }

  response.cookies.set(
    MAGIC_LINK_CONFIRMATION_COOKIE,
    issueMagicLinkConfirmationNonce(validated.absoluteUrl),
    cookieOptions,
  );
  return response;
}

export const config = {
  matcher: ["/signin/confirm"],
};
