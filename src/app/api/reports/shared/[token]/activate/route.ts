import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  createReportShareGrant,
  isReportShareActivationAllowed,
  REPORT_SHARE_GRANT_TTL_SECONDS,
  reportShareGrantCookieName,
} from "@/lib/report-share-grant";
import { lookupReportShareToken } from "@/lib/unenroll-jobs";

function genericJson(status: number) {
  return NextResponse.json(
    { error: "Unable to open this secure report link." },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (
    !isReportShareActivationAllowed({
      origin: req.headers.get("origin"),
      requestOrigin: req.nextUrl.origin,
      secFetchSite: req.headers.get("sec-fetch-site"),
    })
  ) {
    return genericJson(403);
  }
  if (!token || token.length > 1_024) return genericJson(404);

  const tokenRow = await lookupReportShareToken(token);
  const landingUrl = new URL(
    `/reports/shared/${encodeURIComponent(token)}`,
    req.nextUrl.origin,
  );
  if (!tokenRow) {
    landingUrl.searchParams.set("unavailable", "1");
    return NextResponse.redirect(landingUrl, {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const value = createReportShareGrant({
    token,
    secret: getEnv().NEXTAUTH_SECRET,
  });
  const response = NextResponse.redirect(landingUrl, {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set(reportShareGrantCookieName(token), value, {
    httpOnly: true,
    maxAge: REPORT_SHARE_GRANT_TTL_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: req.nextUrl.protocol === "https:",
  });
  return response;
}
