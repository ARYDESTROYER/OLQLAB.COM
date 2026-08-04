export const REPORT_HISTORY_LIMIT = 100;

const ARCHIVE_REASON_LABELS: Record<string, string> = {
  admin_regenerate_report: "Report regenerated",
  admin_reset_stats: "Participant attempt reset",
  manual_pdf_removed: "Manual PDF removed",
  manual_pdf_replaced: "Manual PDF replaced",
  scheduled_retest_started: "Retest started",
};

export function formatReportArchiveReason(reason: string | null | undefined) {
  if (!reason) return "Archived report";
  const knownLabel = ARCHIVE_REASON_LABELS[reason];
  if (knownLabel) return knownLabel;

  const normalized = reason.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Archived report";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function takeBoundedReportHistory<T>(
  rows: T[],
  limit = REPORT_HISTORY_LIMIT,
) {
  const safeLimit = Math.max(1, Math.floor(limit));
  return {
    items: rows.slice(0, safeLimit),
    hasMore: rows.length > safeLimit,
  };
}
