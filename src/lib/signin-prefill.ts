const MAX_SIGN_IN_EMAIL_LENGTH = 320;

export function normalizeSignInEmailPrefill(
  value: string | string[] | undefined,
) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return normalized.length <= MAX_SIGN_IN_EMAIL_LENGTH ? normalized : "";
}
