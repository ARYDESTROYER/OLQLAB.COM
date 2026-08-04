import { timingSafeEqual } from "node:crypto";

export function constantTimeSecretMatches(
  provided: string,
  expected: string | undefined,
) {
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

export function bearerAuthorizationMatches(
  authorization: string | null,
  expected: string | undefined,
) {
  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) return false;
  return constantTimeSecretMatches(authorization.slice(prefix.length), expected);
}
