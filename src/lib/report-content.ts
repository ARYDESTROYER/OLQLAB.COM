import sanitizeHtml from "sanitize-html";
import { buildReportHtmlTemplate } from "@/lib/report-format";

export type ReportNarrative = Record<string, unknown> & {
  adminEditedHtml?: string;
  adminEditedText?: string;
};

export const MAX_REPORT_NARRATIVE_BYTES = 256 * 1024;
export const MAX_REPORT_NARRATIVE_REQUEST_BYTES =
  MAX_REPORT_NARRATIVE_BYTES + 32 * 1024;

export function isReportNarrativeSizeAllowed(input: string) {
  return Buffer.byteLength(input, "utf8") <= MAX_REPORT_NARRATIVE_BYTES;
}

const ALLOWED_REPORT_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
] as const;

export function sanitizeReportHtml(input: string) {
  return sanitizeHtml(input, {
    allowedTags: [...ALLOWED_REPORT_TAGS],
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "template"],
    enforceHtmlBoundary: true,
  }).trim();
}

function decodeHtmlEntities(input: string) {
  return input.replace(
    /&(?:#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos|#39|nbsp);/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal) {
        const codePoint = Number.parseInt(decimal, 10);
        return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : "�";
      }
      if (hexadecimal) {
        const codePoint = Number.parseInt(hexadecimal, 16);
        return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : "�";
      }

      const named: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
        "&#39;": "'",
        "&nbsp;": " ",
      };
      return named[entity.toLowerCase()] || entity;
    },
  );
}

export function reportHtmlToPlainText(input: string) {
  const safe = sanitizeReportHtml(input)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(?:p|h[1-4]|li|blockquote)\s*>/gi, "\n")
    .replace(/<\s*li\s*>/gi, "• ")
    .replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(safe)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseReportNarrative(input: string): ReportNarrative | null {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as ReportNarrative;
  } catch {
    return null;
  }
}

export function isLegacyThirdPartyReportHtml(input: string) {
  return /TALENT\s*(?:<br\s*\/?>|\s)+VANTAGE|data-report-template=["'](?:talent-vantage|wissen-v1)["']/i.test(
    input,
  );
}

export function canonicalizeReportNarrative(input: ReportNarrative) {
  const next: ReportNarrative = { ...input };
  if (typeof next.adminEditedHtml === "string") {
    const sanitized = sanitizeReportHtml(next.adminEditedHtml);
    if (sanitized && !isLegacyThirdPartyReportHtml(sanitized)) {
      next.adminEditedHtml = sanitized;
      next.adminEditedText = reportHtmlToPlainText(sanitized);
    } else {
      delete next.adminEditedHtml;
      delete next.adminEditedText;
    }
  }
  return next;
}

export function resolveCanonicalReportHtml(
  narrative: ReportNarrative,
  defaults: { assessmentTitle: string; participantName: string },
) {
  const edited = narrative.adminEditedHtml;
  if (
    typeof edited === "string" &&
    edited.trim() &&
    !isLegacyThirdPartyReportHtml(edited)
  ) {
    return sanitizeReportHtml(edited);
  }

  return sanitizeReportHtml(buildReportHtmlTemplate(narrative, defaults));
}

export function resolveCanonicalReportText(
  narrative: ReportNarrative,
  defaults: { assessmentTitle: string; participantName: string },
) {
  if (
    typeof narrative.adminEditedText === "string" &&
    narrative.adminEditedText.trim() &&
    typeof narrative.adminEditedHtml === "string" &&
    !isLegacyThirdPartyReportHtml(narrative.adminEditedHtml)
  ) {
    return narrative.adminEditedText.trim();
  }
  return reportHtmlToPlainText(resolveCanonicalReportHtml(narrative, defaults));
}
