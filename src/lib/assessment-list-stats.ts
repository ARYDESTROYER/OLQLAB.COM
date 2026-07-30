export type AssessmentSessionCountRow = {
  assessmentId: string;
  status: "IN_PROGRESS" | "SUBMITTED";
  _count: { _all: number };
};

export function buildAssessmentParticipantStats(
  assessmentIds: string[],
  eligibleByAssessmentId: ReadonlyMap<string, number>,
  sessionCounts: AssessmentSessionCountRow[],
) {
  const statusCounts = new Map<string, { completed: number; inProgress: number }>();
  for (const row of sessionCounts) {
    const current = statusCounts.get(row.assessmentId) || { completed: 0, inProgress: 0 };
    if (row.status === "SUBMITTED") current.completed = row._count._all;
    else current.inProgress = row._count._all;
    statusCounts.set(row.assessmentId, current);
  }

  return new Map(
    assessmentIds.map((assessmentId) => {
      const total = eligibleByAssessmentId.get(assessmentId) || 0;
      const counts = statusCounts.get(assessmentId) || { completed: 0, inProgress: 0 };
      const completed = Math.min(total, Math.max(0, counts.completed));
      const inProgress = Math.min(
        Math.max(total - completed, 0),
        Math.max(0, counts.inProgress),
      );
      const notStarted = total - completed - inProgress;
      return [
        assessmentId,
        {
          total,
          completed,
          inProgress,
          notStarted,
          completionRate:
            total === 0
              ? 0
              : Math.round((completed / total) * 100),
        },
      ];
    }),
  );
}
