import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SIGN_IN_CONFIRM_PATH = "/signin/confirm";
const AUTH_CALLBACK_PATH = "/api/auth/callback/email";
const CONFIRMATION_NONCE_VERSION = "v1";
const CONFIRMATION_NONCE_CONTEXT = "olq-magic-link-confirmation";

export const MAGIC_LINK_CONFIRMATION_COOKIE = "olq_magic_link_confirmation";
export const MAGIC_LINK_CONFIRMATION_COOKIE_PATH = "/api/auth/continue";
export const MAGIC_LINK_CONFIRMATION_TTL_SECONDS = 10 * 60;

function addOriginFamily(allowed: Set<string>, url: URL) {
  allowed.add(url.origin);

  const hostname = url.hostname.toLowerCase();
  const candidateHosts = new Set<string>([hostname]);
  if (hostname.startsWith("www.")) {
    candidateHosts.add(hostname.slice(4));
  } else {
    candidateHosts.add(`www.${hostname}`);
  }

  for (const host of candidateHosts) {
    const normalized = `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}`;
    allowed.add(normalized);
  }
}

function getPublicBaseUrl() {
  const fromNextAuth = process.env.NEXTAUTH_URL?.trim();
  if (fromNextAuth) return fromNextAuth;
  return "http://localhost:3000";
}

function parseUrlSafely(value: string, base?: string) {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function getConfirmationSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "NEXTAUTH_SECRET must be configured before issuing a magic-link confirmation nonce.",
    );
  }
  return secret;
}

function confirmationNonceSignature(input: {
  tokenUrl: string;
  expiresAtMs: number;
  nonce: string;
}) {
  return createHmac("sha256", getConfirmationSecret())
    .update(CONFIRMATION_NONCE_CONTEXT)
    .update("\0")
    .update(String(input.expiresAtMs))
    .update("\0")
    .update(input.nonce)
    .update("\0")
    .update(input.tokenUrl)
    .digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
  );
}

export function buildMagicLinkContinueUrl(input: { verificationUrl: string; email: string }) {
  const publicBase = getPublicBaseUrl();
  const url = new URL(SIGN_IN_CONFIRM_PATH, publicBase);
  url.searchParams.set("tokenUrl", input.verificationUrl);
  url.searchParams.set("email", input.email.toLowerCase().trim());
  return url.toString();
}

export function validateVerificationCallbackUrl(rawTokenUrl: string) {
  const trimmed = rawTokenUrl.trim();
  if (!trimmed) return null;

  const publicBase = getPublicBaseUrl();
  const absolute = parseUrlSafely(trimmed, publicBase);
  if (!absolute) return null;

  const allowedOrigins = new Set<string>();
  addOriginFamily(allowedOrigins, new URL(publicBase));

  if (process.env.NEXTAUTH_URL) {
    const maybe = parseUrlSafely(process.env.NEXTAUTH_URL);
    if (maybe) addOriginFamily(allowedOrigins, maybe);
  }

  if (!allowedOrigins.has(absolute.origin)) return null;
  if (absolute.pathname !== AUTH_CALLBACK_PATH) return null;

  const token = absolute.searchParams.get("token") || "";
  const email = absolute.searchParams.get("email") || "";
  if (!token || !email) return null;

  return {
    absoluteUrl: absolute.toString(),
    email: email.toLowerCase().trim(),
  };
}

export function issueMagicLinkConfirmationNonce(
  canonicalTokenUrl: string,
  nowMs = Date.now(),
) {
  const expiresAtMs = nowMs + MAGIC_LINK_CONFIRMATION_TTL_SECONDS * 1_000;
  const nonce = randomBytes(32).toString("base64url");
  const signature = confirmationNonceSignature({
    tokenUrl: canonicalTokenUrl,
    expiresAtMs,
    nonce,
  });
  return [CONFIRMATION_NONCE_VERSION, expiresAtMs, nonce, signature].join(".");
}

export function verifyMagicLinkConfirmationNonce(input: {
  cookieValue: string;
  canonicalTokenUrl: string;
  nowMs?: number;
}) {
  const [version, expiresAtRaw, nonce, signature, extra] =
    input.cookieValue.split(".");
  if (
    version !== CONFIRMATION_NONCE_VERSION ||
    !expiresAtRaw ||
    !nonce ||
    !signature ||
    extra !== undefined
  ) {
    return false;
  }

  const expiresAtMs = Number(expiresAtRaw);
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs) return false;

  let nonceBytes: Buffer;
  try {
    nonceBytes = Buffer.from(nonce, "base64url");
  } catch {
    return false;
  }
  if (nonceBytes.length !== 32 || nonceBytes.toString("base64url") !== nonce) {
    return false;
  }

  const expected = confirmationNonceSignature({
    tokenUrl: input.canonicalTokenUrl,
    expiresAtMs,
    nonce,
  });
  return constantTimeEqual(signature, expected);
}

export function isSameOriginMagicLinkContinueRequest(input: {
  requestOrigin: string;
  originHeader: string | null;
  secFetchSiteHeader: string | null;
}) {
  if (
    input.secFetchSiteHeader &&
    input.secFetchSiteHeader.toLowerCase() !== "same-origin"
  ) {
    return false;
  }

  if (!input.originHeader) return true;
  const parsedOrigin = parseUrlSafely(input.originHeader);
  const parsedRequestOrigin = parseUrlSafely(input.requestOrigin);
  return Boolean(
    parsedOrigin &&
      parsedRequestOrigin &&
      input.originHeader === parsedOrigin.origin &&
      parsedOrigin.origin === parsedRequestOrigin.origin,
  );
}

export function magicLinkConfirmationCookieOptions(input: { secure: boolean }) {
  return {
    httpOnly: true,
    secure: input.secure,
    sameSite: "strict" as const,
    path: MAGIC_LINK_CONFIRMATION_COOKIE_PATH,
    maxAge: MAGIC_LINK_CONFIRMATION_TTL_SECONDS,
    priority: "high" as const,
  };
}

export function getSignInConfirmPath() {
  return SIGN_IN_CONFIRM_PATH;
}
