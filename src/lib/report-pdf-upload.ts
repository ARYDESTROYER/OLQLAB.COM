import { PDFDocument } from "pdf-lib";

export const MAX_REPORT_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_REPORT_PDF_MULTIPART_BYTES = MAX_REPORT_PDF_BYTES + 192 * 1024;

export function isReportPdfSizeAllowed(sizeBytes: number) {
  return Number.isSafeInteger(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_REPORT_PDF_BYTES;
}

export function safeReportPdfFileName(value: string) {
  const leaf = value.split(/[\\/]/).pop() || "report.pdf";
  const cleaned = leaf.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "report.pdf").slice(0, 180);
}

export async function isStructurallyValidPdf(bytes: Uint8Array) {
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") return false;
  try {
    await PDFDocument.load(bytes, { updateMetadata: false });
    return true;
  } catch {
    return false;
  }
}
