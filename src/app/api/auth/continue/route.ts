import { NextRequest, NextResponse } from "next/server";
import { validateVerificationCallbackUrl } from "@/lib/magic-link-continue";

function toSafeSignInErrorUrl(req: NextRequest) {
  return new URL("/signin?error=invalid_link", req.nextUrl.origin);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const tokenUrlRaw = String(form.get("tokenUrl") || "");

  const validated = validateVerificationCallbackUrl(tokenUrlRaw);
  if (!validated) {
    return NextResponse.redirect(toSafeSignInErrorUrl(req), { status: 303 });
  }

  return NextResponse.redirect(validated.absoluteUrl, { status: 303 });
}

export async function GET(req: NextRequest) {
  return NextResponse.redirect(toSafeSignInErrorUrl(req), { status: 303 });
}
