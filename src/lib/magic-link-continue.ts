const SIGN_IN_CONFIRM_PATH = "/signin/confirm";
const AUTH_CALLBACK_PATH = "/api/auth/callback/email";

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

export function getSignInConfirmPath() {
  return SIGN_IN_CONFIRM_PATH;
}
