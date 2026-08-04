import { createHash, type Hash } from "node:crypto";

type ReportPublicationVersionInput = {
  reportId: string;
  publicationGeneration: number;
  reportWorkflow: string;
  narrativeJson: string;
  manualPdf: {
    id: string;
    pdfBytes: Uint8Array;
  } | null;
};

function appendVersionField(
  hash: Hash,
  label: string,
  value: string | Uint8Array,
) {
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  hash.update(`${label}:${bytes.byteLength}:`);
  hash.update(bytes);
  hash.update("\0");
}

/**
 * Produces one provider-safe key for a report attempt and its publishable
 * content. Status, delivery method, and timestamps are deliberately excluded
 * so retrying the same publication cannot create a second email or share link.
 */
export function buildPublishedReportDeliveryIdempotencyKey(
  input: ReportPublicationVersionInput,
) {
  const hash = createHash("sha256");
  appendVersionField(hash, "context", "olq-published-report-delivery-v1");
  appendVersionField(hash, "report", input.reportId);
  appendVersionField(
    hash,
    "publication-generation",
    String(input.publicationGeneration),
  );
  appendVersionField(hash, "workflow", input.reportWorkflow);
  appendVersionField(hash, "narrative", input.narrativeJson);
  appendVersionField(hash, "pdf-id", input.manualPdf?.id || "none");
  appendVersionField(
    hash,
    "pdf-content",
    input.manualPdf?.pdfBytes || new Uint8Array(),
  );
  return `report-publication-${hash.digest("hex")}`;
}

/**
 * Explicit redelivery gets a fresh link and provider key, while retries of that
 * same operator action reuse both. The caller keeps the opaque action id stable
 * until the provider returns a definitive success/failure.
 */
export function buildPublishedReportRedeliveryIdempotencyKey(input: {
  publicationVersionKey: string;
  redeliveryKey: string;
}) {
  const hash = createHash("sha256");
  appendVersionField(hash, "context", "olq-published-report-redelivery-v1");
  appendVersionField(hash, "publication", input.publicationVersionKey);
  appendVersionField(hash, "redelivery", input.redeliveryKey);
  return `report-redelivery-${hash.digest("hex")}`;
}
