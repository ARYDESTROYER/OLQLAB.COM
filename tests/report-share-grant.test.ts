import { describe, expect, it } from "vitest";
import {
  buildScannerResistantReportLinkHtml,
  createReportShareGrant,
  isReportShareActivationAllowed,
  reportShareGrantCookieName,
  verifyReportShareGrant,
} from "@/lib/report-share-grant";

describe("scanner-resistant report share grants", () => {
  const now = new Date("2026-07-30T10:00:00.000Z");

  it("binds a short-lived grant and cookie name to one bearer token", () => {
    const value = createReportShareGrant({
      token: "token-one",
      secret: "secret",
      now,
      ttlSeconds: 300,
    });
    expect(
      verifyReportShareGrant({
        token: "token-one",
        value,
        secret: "secret",
        now: new Date("2026-07-30T10:04:59.000Z"),
      }),
    ).toBe(true);
    expect(
      verifyReportShareGrant({
        token: "token-two",
        value,
        secret: "secret",
        now,
      }),
    ).toBe(false);
    expect(
      verifyReportShareGrant({
        token: "token-one",
        value,
        secret: "secret",
        now: new Date("2026-07-30T10:05:00.000Z"),
      }),
    ).toBe(false);
    expect(reportShareGrantCookieName("token-one")).not.toBe(
      reportShareGrantCookieName("token-two"),
    );
  });

  it("accepts same-origin activation and rejects cross-site or headerless posts", () => {
    expect(
      isReportShareActivationAllowed({
        origin: "https://www.olqlab.com",
        requestOrigin: "https://www.olqlab.com",
        secFetchSite: "same-origin",
      }),
    ).toBe(true);
    expect(
      isReportShareActivationAllowed({
        origin: "https://evil.example",
        requestOrigin: "https://www.olqlab.com",
        secFetchSite: "cross-site",
      }),
    ).toBe(false);
    expect(
      isReportShareActivationAllowed({
        origin: null,
        requestOrigin: "https://www.olqlab.com",
        secFetchSite: null,
      }),
    ).toBe(false);
  });

  it("puts only the generic landing URL in email HTML", () => {
    const html = buildScannerResistantReportLinkHtml({
      baseUrl: "https://www.olqlab.com/",
      token: "secret-token",
    });
    expect(html).toContain("/reports/shared/secret-token");
    expect(html).not.toContain("/api/reports/shared/");
    expect(html).not.toContain("/pdf");
  });
});
