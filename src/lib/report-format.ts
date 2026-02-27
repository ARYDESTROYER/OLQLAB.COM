type AiNarrative = {
  executiveSummary?: string;
  strengthsNarrative?: string;
  developmentNarrative?: string;
  managerCoaching?: string;
  improvementRoadmap?: string[];
  cautionNotes?: string[];
};

type ReportNarrativeShape = {
  assessmentTitle?: string;
  participantName?: string;
  assessmentTakenAt?: string;
  profileHeadline?: string;
  summary?: string;
  strengths?: string[];
  growthAreas?: string[];
  actions?: string[];
  workplaceSignals?: string[];
  reflectionPrompts?: string[];
  managerDiscussionGuide?: string[];
  aiNarrative?: AiNarrative;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toArray(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function toLabelDate(raw?: string) {
  if (!raw) return "Not available";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function list(items: string[], emptyText: string) {
  if (items.length === 0) {
    return `<ul><li>${escapeHtml(emptyText)}</li></ul>`;
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function buildReportHtmlTemplate(
  narrativeInput: unknown,
  defaults?: { assessmentTitle?: string; participantName?: string },
) {
  const narrative =
    narrativeInput && typeof narrativeInput === "object"
      ? (narrativeInput as ReportNarrativeShape)
      : ({} as ReportNarrativeShape);

  const ai =
    narrative.aiNarrative && typeof narrative.aiNarrative === "object"
      ? narrative.aiNarrative
      : ({} as AiNarrative);

  const assessmentTitle =
    String(narrative.assessmentTitle || defaults?.assessmentTitle || "Wisses Leadership Assessment").trim() ||
    "Wisses Leadership Assessment";
  const participantName =
    String(narrative.participantName || defaults?.participantName || "Participant").trim() ||
    "Participant";
  const profileHeadline =
    String(narrative.profileHeadline || "Leadership Development Profile").trim() ||
    "Leadership Development Profile";
  const summary =
    String(
      narrative.summary ||
        ai.executiveSummary ||
        "This report captures leadership tendencies, strengths, and development priorities from the assessment.",
    ).trim();

  const strengths = toArray(narrative.strengths, 8);
  const growthAreas = toArray(narrative.growthAreas, 8);
  const actions = toArray(narrative.actions, 10);
  const workplaceSignals = toArray(narrative.workplaceSignals, 8);
  const managerGuide = toArray(narrative.managerDiscussionGuide, 8);
  const reflections = toArray(narrative.reflectionPrompts, 8);
  const roadmap = toArray(ai.improvementRoadmap, 8);
  const cautions = toArray(ai.cautionNotes, 6);

  const strengthsNarrative = String(ai.strengthsNarrative || "").trim();
  const developmentNarrative = String(ai.developmentNarrative || "").trim();
  const managerCoaching = String(ai.managerCoaching || "").trim();

  return `
<h1>${escapeHtml(assessmentTitle)}</h1>
<p><strong>Participant:</strong> ${escapeHtml(participantName)}</p>
<p><strong>Assessment Date:</strong> ${escapeHtml(toLabelDate(narrative.assessmentTakenAt))}</p>

<h2>${escapeHtml(profileHeadline)}</h2>
<p>${escapeHtml(summary)}</p>

<h2>Key Strengths</h2>
${list(strengths, "No strength narrative available.")}
${strengthsNarrative ? `<p>${escapeHtml(strengthsNarrative)}</p>` : ""}

<h2>Growth Priorities</h2>
${list(growthAreas, "No growth priorities available.")}
${developmentNarrative ? `<p>${escapeHtml(developmentNarrative)}</p>` : ""}

<h2>Action Plan</h2>
${list(actions, "No action plan available.")}
${roadmap.length ? `<h3>Improvement Roadmap</h3>${list(roadmap, "")}` : ""}

<h2>Manager Coaching Guide</h2>
${list(managerGuide, "No manager guide available.")}
${managerCoaching ? `<p>${escapeHtml(managerCoaching)}</p>` : ""}

<h2>Workplace Signals</h2>
${list(workplaceSignals, "No workplace signals available.")}

<h2>Reflection Prompts</h2>
${list(reflections, "No reflection prompts available.")}

${cautions.length ? `<h2>Important Notes</h2>${list(cautions, "")}` : ""}
`.trim();
}
