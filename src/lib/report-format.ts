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
  partnerNames?: string;
  classification?: string;
  profileHeadline?: string;
  summary?: string;
  strengths?: string[];
  growthAreas?: string[];
  actions?: string[];
  workplaceSignals?: string[];
  reflectionPrompts?: string[];
  managerDiscussionGuide?: string[];
  cprScores?: {
    composite?: number;
    pattern?: number;
    recognition?: number;
  };
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

function clampPercent(value: number) {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function toPercent(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clampPercent(num);
}

function cprDominance(composite: number, pattern: number, recognition: number) {
  const data = [
    { key: "C", value: composite },
    { key: "P", value: pattern },
    { key: "R", value: recognition },
  ].sort((a, b) => b.value - a.value);

  return `${data.map((item) => item.key).join("-")} Dominance`;
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
    String(narrative.assessmentTitle || defaults?.assessmentTitle || "Wissen Leadership Assessment").trim() ||
    "Wissen Leadership Assessment";
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

  const composite = toPercent(narrative.cprScores?.composite, 82);
  const pattern = toPercent(narrative.cprScores?.pattern, 58);
  const recognition = toPercent(narrative.cprScores?.recognition, 78);
  const dominance = cprDominance(composite, pattern, recognition);
  const partnerNames = String(narrative.partnerNames || "CPR Coaching Panel").trim();
  const classification = String(narrative.classification || "For Personal and Coaching Use Only").trim();

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

  const toc = [
    "Executive Summary",
    "Dominant Style",
    "C-style analysis",
    "P-style analysis",
    "R-style analysis",
    "Strengths in Leadership",
    "Limitations & Potential Challenges",
    "Recommendations for Individual Development Plan (IDP)",
  ];

  const recommendationRows = [
    ["0-6 Months", "1 disruptive project", "Analyze 3 trends", "Mentor leader"],
    ["6-12 Months", "1 disruptive process", "Strategic presentation to execs", "1 inclusive policy change"],
    ["12-18 Months", "1 transformative initiative", "1 predictive model", "1 bold strategic move"],
  ];

  return `
<style>
.cpr-report{font-family:Georgia,"Times New Roman",serif;color:#111827;line-height:1.46}
.cpr-page{position:relative;background:#e5e7eb;border:3px solid #1d4ed8;padding:24px 28px 28px;margin:0 0 18px;min-height:900px;box-sizing:border-box}
.cpr-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.cpr-logo{width:88px;height:58px;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;letter-spacing:.08em;text-align:center}
.cpr-title{text-align:center;font-size:54px;font-weight:700;line-height:1.05;margin:36px 0 18px}
.cpr-subtitle{text-align:center;font-size:46px;font-weight:700;line-height:1.05;margin:0 0 28px}
.cpr-lead{font-size:18px;margin:8px 0}
.cpr-h2{text-align:center;font-size:50px;text-decoration:underline;font-weight:700;margin:38px 0 22px}
.cpr-h3{font-size:38px;text-decoration:underline;font-weight:700;margin:12px 0 16px}
.cpr-body{font-size:21px;text-align:justify}
.cpr-list li{margin:14px 0;font-size:21px}
.cpr-table{width:100%;border-collapse:collapse;margin-top:18px;font-size:18px}
.cpr-table th,.cpr-table td{border:1px solid #111827;padding:8px;vertical-align:top}
.cpr-conf{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:12px;color:#6b7280}
.cpr-wheel{display:block;margin:18px auto;max-width:360px;width:100%}
</style>
<div class="cpr-report">
  <section class="cpr-page">
    <div class="cpr-header">
      <div class="cpr-logo">TALENT<br/>VANTAGE</div>
      <div class="cpr-logo">CPR</div>
    </div>
    <div class="cpr-title">CPR™</div>
    <div class="cpr-subtitle">Analysis &amp; Recommendation</div>
    <p class="cpr-lead"><strong>Prepared for :</strong> ${escapeHtml(participantName)}</p>
    <p class="cpr-lead"><strong>Partner :</strong> ${escapeHtml(partnerNames)}</p>
    <p class="cpr-lead"><strong>Date :</strong> ${escapeHtml(toLabelDate(narrative.assessmentTakenAt))}</p>
    <p class="cpr-lead"><strong>Classification :</strong> ${escapeHtml(classification)}</p>
    <svg class="cpr-wheel" viewBox="0 0 420 320" role="img" aria-label="CPR Wheel">
      <circle cx="210" cy="160" r="126" fill="#e5e7eb" stroke="#0f172a" stroke-width="2"/>
      <path d="M210 160 L210 34 A126 126 0 0 1 319 223 Z" fill="#60a5fa" opacity="0.8"/>
      <path d="M210 160 L319 223 A126 126 0 0 1 101 223 Z" fill="#f59e0b" opacity="0.8"/>
      <path d="M210 160 L101 223 A126 126 0 0 1 210 34 Z" fill="#a3e635" opacity="0.75"/>
      <circle cx="210" cy="160" r="62" fill="none" stroke="#334155" stroke-width="1"/>
      <text x="202" y="36" font-size="38" font-weight="700" fill="#0f172a">P</text>
      <text x="319" y="250" font-size="38" font-weight="700" fill="#0f172a">R</text>
      <text x="72" y="250" font-size="38" font-weight="700" fill="#0f172a">C</text>
    </svg>
    <p class="cpr-body" style="font-size:15px">The CPR framework is developed using a multi-method psychometric design integrating self-report tendencies and situational judgement formats. Results represent leadership pattern tendencies for development and coaching use.</p>
    <div class="cpr-conf">Confidential</div>
  </section>

  <section class="cpr-page">
    <div class="cpr-header">
      <div class="cpr-logo">TALENT<br/>VANTAGE</div>
      <div class="cpr-logo">CPR</div>
    </div>
    <h2 class="cpr-h2">Table of Contents</h2>
    <ol class="cpr-list">
      ${toc.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ol>
    <div class="cpr-conf">Confidential</div>
  </section>

  <section class="cpr-page">
    <div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div>
    <h3 class="cpr-h3" style="text-align:center">Executive Summary</h3>
    <p class="cpr-body">Dear ${escapeHtml(participantName)},</p>
    <p class="cpr-body">${escapeHtml(summary)}</p>
    <p class="cpr-body">${escapeHtml(strengthsNarrative || "Your profile indicates practical leadership strengths and a clear potential trajectory with focused development.")}</p>
    <p class="cpr-body">${escapeHtml(developmentNarrative || "Development emphasis should focus on strategic boldness, decision-speed in ambiguity, and sustained recovery patterns.")}</p>
    <div class="cpr-conf">Confidential</div>
  </section>

  <section class="cpr-page">
    <div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div>
    <h3 class="cpr-h3" style="text-align:center">${escapeHtml(dominance)}</h3>
    <p class="cpr-body">Dominance is inferred from Composite Leadership (C), Pattern Perception (P), and Recognition &amp; Responsibility (R) signals.</p>
    <svg class="cpr-wheel" viewBox="0 0 420 340" role="img" aria-label="CPR Dominance Chart">
      <circle cx="210" cy="170" r="118" fill="#f3f4f6" stroke="#64748b" stroke-width="1.5"/>
      <path d="M210 170 L210 52 A118 118 0 0 1 312 229 Z" fill="#8ecae6"/>
      <path d="M210 170 L312 229 A118 118 0 0 1 108 229 Z" fill="#ffd38f"/>
      <path d="M210 170 L108 229 A118 118 0 0 1 210 52 Z" fill="#d8b4d8"/>
      <polygon points="210,${170 - composite} ${210 + Math.round(pattern * 0.86)},${170 + Math.round(pattern * 0.5)} ${210 - Math.round(recognition * 0.86)},${170 + Math.round(recognition * 0.5)}" fill="#334155" opacity="0.28" stroke="#0f172a" stroke-width="2"/>
      <text x="196" y="40" font-size="16" font-weight="700" fill="#0f172a">C (${composite}%)</text>
      <text x="322" y="246" font-size="16" font-weight="700" fill="#0f172a">P (${pattern}%)</text>
      <text x="54" y="246" font-size="16" font-weight="700" fill="#0f172a">R (${recognition}%)</text>
    </svg>
    <table class="cpr-table">
      <thead><tr><th>Dimension</th><th>Score</th><th>Key Attributes Exhibited</th></tr></thead>
      <tbody>
        <tr><td><strong>Composite (C)</strong></td><td>${composite}%</td><td>Analytical, decisive, systematic, role-adherent</td></tr>
        <tr><td><strong>Pattern (P)</strong></td><td>${pattern}%</td><td>Observant, insightful, context-aware, perceptive</td></tr>
        <tr><td><strong>Recognition (R)</strong></td><td>${recognition}%</td><td>Ethical, accountable, empathetic, fair, responsive</td></tr>
      </tbody>
    </table>
    <div class="cpr-conf">Confidential</div>
  </section>

  <section class="cpr-page"><div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div><h3 class="cpr-h3">C - Composite Integration (High - ${composite}%)</h3>${list(strengths.slice(0, 5), "Composite analysis data pending.")}${strengthsNarrative ? `<p class="cpr-body">${escapeHtml(strengthsNarrative)}</p>` : ""}<div class="cpr-conf">Confidential</div></section>
  <section class="cpr-page"><div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div><h3 class="cpr-h3">P - Pattern Perception (Moderate - ${pattern}%)</h3>${list(workplaceSignals.slice(0, 5), "Pattern analysis data pending.")}${developmentNarrative ? `<p class="cpr-body">${escapeHtml(developmentNarrative)}</p>` : ""}<div class="cpr-conf">Confidential</div></section>
  <section class="cpr-page"><div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div><h3 class="cpr-h3">R - Recognition &amp; Responsibility (High - ${recognition}%)</h3>${list(managerGuide.slice(0, 5), "Recognition analysis data pending.")}${managerCoaching ? `<p class="cpr-body">${escapeHtml(managerCoaching)}</p>` : ""}<div class="cpr-conf">Confidential</div></section>

  <section class="cpr-page"><div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div><h3 class="cpr-h3">Strengths</h3>${list(strengths, "No strengths available.")}<div class="cpr-conf">Confidential</div></section>
  <section class="cpr-page"><div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div><h3 class="cpr-h3">Limitations</h3>${list(growthAreas.length ? growthAreas : cautions, "No limitations listed.")}<div class="cpr-conf">Confidential</div></section>

  <section class="cpr-page">
    <div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div>
    <h3 class="cpr-h3">Recommendations</h3>
    <p class="cpr-body">${escapeHtml(profileHeadline || "Recommendations for Individual Development Plan (IDP)")}</p>
    ${list(actions.length ? actions : roadmap, "No recommendations available.")}
    <h4 style="font-size:24px;margin:16px 0 8px">IDP Timeframe Grid</h4>
    <table class="cpr-table">
      <thead><tr><th>Timeframe</th><th>C-Dimension Focus</th><th>P-Dimension Focus</th><th>R-Dimension Focus</th></tr></thead>
      <tbody>
        ${recommendationRows
          .map(
            (row) => `<tr><td><strong>${escapeHtml(row[0])}</strong></td><td>${escapeHtml(row[1])}</td><td>${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <div class="cpr-conf">Confidential</div>
  </section>

  <section class="cpr-page">
    <div class="cpr-header"><div class="cpr-logo">TALENT<br/>VANTAGE</div><div class="cpr-logo">CPR</div></div>
    <h2 class="cpr-h2" style="text-decoration:none">Thank you!</h2>
    <p class="cpr-body" style="text-align:center;font-weight:700">Best wishes for your leadership growth journey!</p>
    <svg class="cpr-wheel" viewBox="0 0 420 320" role="img" aria-label="CPR closing visual">
      <circle cx="210" cy="160" r="126" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>
      <path d="M210 160 L210 34 A126 126 0 0 1 319 223 Z" fill="#60a5fa" opacity="0.8"/>
      <path d="M210 160 L319 223 A126 126 0 0 1 101 223 Z" fill="#f59e0b" opacity="0.8"/>
      <path d="M210 160 L101 223 A126 126 0 0 1 210 34 Z" fill="#84cc16" opacity="0.75"/>
      <circle cx="210" cy="160" r="38" fill="#fff" stroke="#334155" stroke-width="1"/>
      <text x="202" y="36" font-size="38" font-weight="700" fill="#0f172a">P</text>
      <text x="319" y="250" font-size="38" font-weight="700" fill="#0f172a">R</text>
      <text x="72" y="250" font-size="38" font-weight="700" fill="#0f172a">C</text>
    </svg>
    <p class="cpr-body" style="text-align:center;font-size:17px">This interpretive profile report is based on response patterns.</p>
    <div class="cpr-conf">Confidential</div>
  </section>
</div>
`.trim();
}
