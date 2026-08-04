export type AdminListWindowMeta = {
  returned: number;
  limit: number;
  totalMatchingFilters: number | null;
  totalCandidates: number;
  hasMore: boolean;
  truncated: boolean;
};

export function buildAdminListWindowMeta(input: {
  returned: number;
  limit: number;
  totalCandidates: number;
  processedCandidates: number;
  matchingWithinWindow: number;
  derivedFilterApplied?: boolean;
}): AdminListWindowMeta {
  const unprocessedCandidates = input.totalCandidates > input.processedCandidates;
  const hasMore = input.derivedFilterApplied
    ? unprocessedCandidates || input.matchingWithinWindow > input.limit
    : input.totalCandidates > input.returned;
  const totalMatchingFilters =
    input.derivedFilterApplied && unprocessedCandidates
      ? null
      : input.derivedFilterApplied
        ? input.matchingWithinWindow
        : input.totalCandidates;

  return {
    returned: input.returned,
    limit: input.limit,
    totalMatchingFilters,
    totalCandidates: input.totalCandidates,
    hasMore,
    truncated: hasMore,
  };
}

export function getAdminCsvWindowError(input: {
  totalCandidates: number;
  limit: number;
  recordLabel: string;
  derivedFilterApplied?: boolean;
}) {
  if (input.totalCandidates <= input.limit) return null;
  if (input.derivedFilterApplied) {
    return `CSV export cannot safely evaluate more than ${input.limit.toLocaleString("en-US")} candidate ${input.recordLabel}. Narrow the filters and try again.`;
  }
  return `CSV export matches more than ${input.limit.toLocaleString("en-US")} ${input.recordLabel}. Narrow the filters and try again.`;
}
