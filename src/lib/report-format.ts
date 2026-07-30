type AiNarrative = {
  executiveSummary?: string;
  strengthsNarrative?: string;
  developmentNarrative?: string;
  managerCoaching?: string;
  improvementRoadmap?: string[];
  cautionNotes?: string[];
};

type TraitNarrative = {
  name?: string;
  band?: string;
  summary?: string;
  leverage?: string;
  developmentFocus?: string;
};

type CompetencyTheme = {
  name?: string;
  category?: string;
  insight?: string;
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
  traitNarratives?: TraitNarrative[];
  competencyThemes?: CompetencyTheme[];
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

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean).slice(0, maxItems);
}

function list(items: string[]) {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
}

function section(title: string, content: string) {
  return content.trim() ? `<h2>${escapeHtml(title)}</h2>${content}` : "";
}

function paragraph(value: unknown) {
  const normalized = text(value);
  return normalized ? `<p>${escapeHtml(normalized)}</p>` : "";
}

function utcDateLabel(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Build OLQ Lab's canonical editable report document. The output deliberately
 * uses only the HTML nodes supported by the editor's StarterKit configuration
 * and the report sanitizer. It never invents scores, recommendations, partner
 * names, classifications, or behavioural claims when source data is absent.
 */
export function buildReportHtmlTemplate(
  narrativeInput: unknown,
  defaults?: { assessmentTitle?: string; participantName?: string },
) {
  const narrative =
    narrativeInput && typeof narrativeInput === "object" && !Array.isArray(narrativeInput)
      ? (narrativeInput as ReportNarrativeShape)
      : {};
  const ai =
    narrative.aiNarrative &&
    typeof narrative.aiNarrative === "object" &&
    !Array.isArray(narrative.aiNarrative)
      ? narrative.aiNarrative
      : {};

  const assessmentTitle =
    text(narrative.assessmentTitle) ||
    text(defaults?.assessmentTitle) ||
    "Leadership Development Assessment";
  const participantName =
    text(narrative.participantName) || text(defaults?.participantName) || "Participant";
  const takenAt = utcDateLabel(narrative.assessmentTakenAt);
  const profileHeadline = text(narrative.profileHeadline);
  const summary = text(narrative.summary) || text(ai.executiveSummary);

  const traitBlocks = Array.isArray(narrative.traitNarratives)
    ? narrative.traitNarratives
        .slice(0, 10)
        .map((trait) => {
          if (!trait || typeof trait !== "object") return "";
          const name = text(trait.name);
          const band = text(trait.band);
          const body = [
            paragraph(trait.summary),
            text(trait.leverage)
              ? `<p><strong>How to use this tendency:</strong> ${escapeHtml(text(trait.leverage))}</p>`
              : "",
            text(trait.developmentFocus)
              ? `<p><strong>Development focus:</strong> ${escapeHtml(text(trait.developmentFocus))}</p>`
              : "",
          ].join("");
          if (!name || !body) return "";
          return `<h3>${escapeHtml(name)}${band ? ` — ${escapeHtml(band)}` : ""}</h3>${body}`;
        })
        .join("")
    : "";

  const competencyBlocks = Array.isArray(narrative.competencyThemes)
    ? narrative.competencyThemes
        .slice(0, 12)
        .map((theme) => {
          if (!theme || typeof theme !== "object") return "";
          const name = text(theme.name);
          const insight = text(theme.insight);
          const category = text(theme.category);
          if (!name || !insight) return "";
          return `<h3>${escapeHtml(name)}${category ? ` — ${escapeHtml(category)}` : ""}</h3><p>${escapeHtml(insight)}</p>`;
        })
        .join("")
    : "";

  const strengths = strings(narrative.strengths);
  const growthAreas = strings(narrative.growthAreas);
  const actions = strings(narrative.actions);
  const workplaceSignals = strings(narrative.workplaceSignals);
  const reflectionPrompts = strings(narrative.reflectionPrompts);
  const managerGuide = strings(narrative.managerDiscussionGuide);
  const roadmap = strings(ai.improvementRoadmap);
  const cautions = strings(ai.cautionNotes);

  const body = [
    `<h1>OLQ Lab Leadership Development Report</h1>`,
    `<p><strong>Assessment:</strong> ${escapeHtml(assessmentTitle)}</p>`,
    `<p><strong>Participant:</strong> ${escapeHtml(participantName)}</p>`,
    takenAt ? `<p><strong>Assessment completed:</strong> ${escapeHtml(takenAt)}</p>` : "",
    `<hr />`,
    profileHeadline ? `<h2>${escapeHtml(profileHeadline)}</h2>` : "",
    summary ? `<p>${escapeHtml(summary)}</p>` : "",
    section("Detailed assessment patterns", traitBlocks),
    section("Competency themes", competencyBlocks),
    section(
      "Strengths to build on",
      [paragraph(ai.strengthsNarrative), list(strengths)].join(""),
    ),
    section(
      "Development priorities",
      [paragraph(ai.developmentNarrative), list(growthAreas), list(cautions)].join(""),
    ),
    section("Workplace signals", list(workplaceSignals)),
    section("Recommended next steps", [list(actions), list(roadmap)].join("")),
    section(
      "Manager or coach discussion",
      [paragraph(ai.managerCoaching), list(managerGuide)].join(""),
    ),
    section("Reflection prompts", list(reflectionPrompts)),
    `<hr />`,
    `<blockquote>This report is intended for leadership development. Interpret it alongside observed behaviour, role context, and a conversation with the participant.</blockquote>`,
  ]
    .filter(Boolean)
    .join("");

  return body;
}
