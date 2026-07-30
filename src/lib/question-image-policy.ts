const LOCAL_QUESTION_IMAGE_PREFIX = "/question-images/";

function isSafePathname(pathname: string) {
  if (!pathname.startsWith(LOCAL_QUESTION_IMAGE_PREFIX)) return false;
  try {
    return pathname.split("/").every((segment) => {
      const decoded = decodeURIComponent(segment);
      return (
        ![".", ".."].includes(decoded) &&
        !decoded.includes("/") &&
        !decoded.includes("\\") &&
        !decoded.includes("\0")
      );
    });
  } catch {
    return false;
  }
}

export function isManagedQuestionImageUrl(url: string | null | undefined) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      !parsed.search &&
      !parsed.hash &&
      (parsed.hostname === "blob.vercel-storage.com" ||
        parsed.hostname.endsWith(".blob.vercel-storage.com")) &&
      isSafePathname(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Question images may come only from this application's public
 * /question-images tree or the managed Vercel Blob bucket used by uploads.
 * Arbitrary third-party URLs are rejected to avoid participant tracking.
 */
export function normalizeQuestionImageUrl(input: string | null | undefined) {
  if (typeof input !== "string" || !input.trim()) return null;
  const value = input.trim();

  if (value.startsWith("/") && !value.startsWith("//")) {
    try {
      const parsed = new URL(value, "https://olqlab.invalid");
      if (
        parsed.origin === "https://olqlab.invalid" &&
        !parsed.search &&
        !parsed.hash &&
        isSafePathname(parsed.pathname)
      ) {
        return parsed.pathname;
      }
    } catch {
      return null;
    }
    return null;
  }

  if (!isManagedQuestionImageUrl(value)) return null;
  return new URL(value).toString();
}

export function isExternalQuestionImageUrl(value: string | null | undefined) {
  return Boolean(value && normalizeQuestionImageUrl(value)?.startsWith("https://"));
}
