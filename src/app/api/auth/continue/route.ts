import { NextRequest, NextResponse } from "next/server";
import {
  isSameOriginMagicLinkContinueRequest,
  magicLinkConfirmationCookieOptions,
  MAGIC_LINK_CONFIRMATION_COOKIE,
  validateVerificationCallbackUrl,
  verifyMagicLinkConfirmationNonce,
} from "@/lib/magic-link-continue";

function toSafeSignInErrorUrl(req: NextRequest) {
  return new URL("/signin?error=invalid_link", req.nextUrl.origin);
}

function consumeConfirmationNonce(req: NextRequest, response: NextResponse) {
  response.cookies.set(MAGIC_LINK_CONFIRMATION_COOKIE, "", {
    ...magicLinkConfirmationCookieOptions({
      secure: req.nextUrl.protocol === "https:",
    }),
    maxAge: 0,
    expires: new Date(0),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function rejectContinueRequest(req: NextRequest) {
  return consumeConfirmationNonce(
    req,
    NextResponse.redirect(toSafeSignInErrorUrl(req), { status: 303 }),
  );
}

export async function POST(req: NextRequest) {
  if (
    !isSameOriginMagicLinkContinueRequest({
      requestOrigin: req.nextUrl.origin,
      originHeader: req.headers.get("origin"),
      secFetchSiteHeader: req.headers.get("sec-fetch-site"),
    })
  ) {
    return rejectContinueRequest(req);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return rejectContinueRequest(req);
  const tokenUrlRaw = String(form.get("tokenUrl") || "");

  const validated = validateVerificationCallbackUrl(tokenUrlRaw);
  if (!validated) {
    return rejectContinueRequest(req);
  }

  const confirmationNonce = req.cookies.get(MAGIC_LINK_CONFIRMATION_COOKIE)?.value;
  if (
    !confirmationNonce ||
    !verifyMagicLinkConfirmationNonce({
      cookieValue: confirmationNonce,
      canonicalTokenUrl: validated.absoluteUrl,
    })
  ) {
    return rejectContinueRequest(req);
  }

  return consumeConfirmationNonce(
    req,
    NextResponse.redirect(validated.absoluteUrl, { status: 303 }),
  );
}

export async function GET(req: NextRequest) {
  return rejectContinueRequest(req);
}
