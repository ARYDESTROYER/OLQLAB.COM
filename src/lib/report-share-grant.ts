import crypto from "node:crypto";

const GRANT_VERSION = "v1";
export const REPORT_SHARE_GRANT_TTL_SECONDS = 15 * 60;

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function grantSignature(input: {
  token: string;
  expiresAtSeconds: number;
  secret: string;
}) {
  return crypto
    .createHmac("sha256", input.secret)
    .update(
      `${GRANT_VERSION}:${tokenHash(input.token)}:${input.expiresAtSeconds}`,
    )
    .digest("base64url");
}

export function reportShareGrantCookieName(token: string) {
  return `olq_report_grant_${tokenHash(token).slice(0, 24)}`;
}

export function createReportShareGrant(input: {
  token: string;
  secret: string;
  now?: Date;
  ttlSeconds?: number;
}) {
  const now = input.now || new Date();
  const ttlSeconds = Math.min(
    Math.max(input.ttlSeconds || REPORT_SHARE_GRANT_TTL_SECONDS, 60),
    60 * 60,
  );
  const expiresAtSeconds = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const signature = grantSignature({
    token: input.token,
    expiresAtSeconds,
    secret: input.secret,
  });
  return `${GRANT_VERSION}.${expiresAtSeconds}.${signature}`;
}

export function verifyReportShareGrant(input: {
  token: string;
  value?: string | null;
  secret: string;
  now?: Date;
}) {
  if (!input.value) return false;
  const [version, rawExpiresAt, providedSignature, extra] =
    input.value.split(".");
  if (version !== GRANT_VERSION || !rawExpiresAt || !providedSignature || extra) {
    return false;
  }
  const expiresAtSeconds = Number.parseInt(rawExpiresAt, 10);
  if (!Number.isSafeInteger(expiresAtSeconds)) return false;
  const nowSeconds = Math.floor((input.now || new Date()).getTime() / 1000);
  if (expiresAtSeconds <= nowSeconds) return false;

  const expected = grantSignature({
    token: input.token,
    expiresAtSeconds,
    secret: input.secret,
  });
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(providedSignature);
  return (
    expectedBytes.length === providedBytes.length &&
    crypto.timingSafeEqual(expectedBytes, providedBytes)
  );
}

export function isReportShareActivationAllowed(input: {
  origin: string | null;
  requestOrigin: string;
  secFetchSite: string | null;
}) {
  if (input.secFetchSite && input.secFetchSite !== "same-origin") return false;
  if (input.origin) {
    try {
      if (new URL(input.origin).origin !== input.requestOrigin) return false;
    } catch {
      return false;
    }
  }
  return Boolean(input.origin || input.secFetchSite === "same-origin");
}

export function buildScannerResistantReportLinkHtml(input: {
  baseUrl: string;
  token: string;
}) {
  const url = `${input.baseUrl.replace(/\/$/, "")}/reports/shared/${encodeURIComponent(input.token)}`;
  return `<p><a href="${url}">Open secure report</a></p><p>For your privacy, the page asks you to confirm before showing report content.</p>`;
}
