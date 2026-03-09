export const DEFAULT_ASSESSMENT_INTRO_DESCRIPTION =
  'You will answer personality items and practical workplace scenarios. There are no "wrong" answers. Choose what best reflects your natural style.';

export const DEFAULT_ASSESSMENT_INTRO_BULLETS = [
  "Set aside 10-15 minutes without interruption.",
  "Respond honestly to maximize insight quality.",
  "You can complete in one sitting and submit once all questions are answered.",
];

export function normalizeAssessmentIntroDescription(input: unknown) {
  if (typeof input !== "string") return DEFAULT_ASSESSMENT_INTRO_DESCRIPTION;
  const trimmed = input.trim();
  return trimmed || DEFAULT_ASSESSMENT_INTRO_DESCRIPTION;
}

export function normalizeAssessmentIntroBullets(input: unknown) {
  if (!Array.isArray(input)) return [...DEFAULT_ASSESSMENT_INTRO_BULLETS];

  const normalized = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [...DEFAULT_ASSESSMENT_INTRO_BULLETS];
}