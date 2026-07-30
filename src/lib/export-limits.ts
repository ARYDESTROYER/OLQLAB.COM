export const ASSESSMENT_EXPORT_LIMITS = {
  assessments: 20,
  participants: 5_000,
  questions: 2_000,
  rows: 25_000,
  cells: 750_000,
  responseBytes: 4 * 1024 * 1024,
} as const;

export function getAssessmentExportLimitError(input: {
  assessments?: number;
  participants?: number;
  questions?: number;
  rows?: number;
  cells?: number;
  responseBytes?: number;
}) {
  if ((input.assessments || 0) > ASSESSMENT_EXPORT_LIMITS.assessments) {
    return `Select no more than ${ASSESSMENT_EXPORT_LIMITS.assessments} assessments per export.`;
  }
  if ((input.participants || 0) > ASSESSMENT_EXPORT_LIMITS.participants) {
    return `Export no more than ${ASSESSMENT_EXPORT_LIMITS.participants.toLocaleString("en-US")} participant-assessment records at once.`;
  }
  if ((input.questions || 0) > ASSESSMENT_EXPORT_LIMITS.questions) {
    return `Export no more than ${ASSESSMENT_EXPORT_LIMITS.questions.toLocaleString("en-US")} question columns at once.`;
  }
  if ((input.rows || 0) > ASSESSMENT_EXPORT_LIMITS.rows) {
    return `Export no more than ${ASSESSMENT_EXPORT_LIMITS.rows.toLocaleString("en-US")} CSV rows at once.`;
  }
  if ((input.cells || 0) > ASSESSMENT_EXPORT_LIMITS.cells) {
    return "This selection is too large to build safely as a synchronous CSV. Narrow the assessments, participants, fields, or answer layout.";
  }
  if ((input.responseBytes || 0) > ASSESSMENT_EXPORT_LIMITS.responseBytes) {
    return "The generated CSV exceeds the safe download size. Narrow the assessment or participant selection.";
  }
  return null;
}
