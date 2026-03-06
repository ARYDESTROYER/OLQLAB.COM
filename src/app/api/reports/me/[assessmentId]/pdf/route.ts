import { addHours, format } from "date-fns";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { db } from "@/lib/db";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";

type TraitBand = "high" | "moderate" | "emerging";

type NarrativePayload = {
  profileHeadline?: string;
  summary?: string;
  strengths?: string[];
  growthAreas?: string[];
  actions?: string[];
  workplaceSignals?: string[];
  reflectionPrompts?: string[];
  managerDiscussionGuide?: string[];
  competencyThemes?: Array<{
    code: string;
    name: string;
    category: "strength" | "focus";
    insight: string;
  }>;
  assessmentTakenAt?: string;
  assessmentTitle?: string;
  participantName?: string;
  aiNarrative?: {
    executiveSummary?: string;
    strengthsNarrative?: string;
    developmentNarrative?: string;
    managerCoaching?: string;
    improvementRoadmap?: string[];
    cautionNotes?: string[];
  };
};

type CompetencySignal = {
  name: string;
  score: number;
};

type TraitSignal = {
  label: string;
  value: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 34;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FOOTER_Y = 22;

const palette = {
  ink: rgb(0.09, 0.12, 0.19),
  heading: rgb(0.11, 0.16, 0.26),
  body: rgb(0.2, 0.25, 0.33),
  muted: rgb(0.42, 0.47, 0.56),
  border: rgb(0.84, 0.88, 0.93),
  page: rgb(0.985, 0.99, 0.997),
  white: rgb(1, 1, 1),
  blueTint: rgb(0.91, 0.97, 1),
  goldTint: rgb(1, 0.95, 0.87),
  mintTint: rgb(0.91, 0.98, 0.94),
  strengthTint: rgb(0.89, 0.96, 0.91),
  focusTint: rgb(1, 0.94, 0.84),
  chartA: rgb(0.34, 0.67, 0.95),
  chartB: rgb(0.97, 0.68, 0.28),
  chartC: rgb(0.44, 0.8, 0.51),
  chartD: rgb(0.74, 0.55, 0.89),
  chartE: rgb(0.98, 0.51, 0.62),
};

function safeText(input: string | undefined | null, max = 1200) {
  return (input || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function formatTakenAt(input: string | Date | undefined | null) {
  if (!input) return "Not available";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "Not available";
  return format(date, "MMMM d, yyyy 'at' h:mm a");
}

function toBand(value: number): TraitBand {
  if (value < 35) return "emerging";
  if (value < 70) return "moderate";
  return "high";
}

function bandLabel(band: TraitBand) {
  if (band === "high") return "Strong signal";
  if (band === "moderate") return "Balanced signal";
  return "Emerging signal";
}

function splitLongToken(token: string, maxWidth: number, font: PDFFont, size: number) {
  if (font.widthOfTextAtSize(token, size) <= maxWidth) return [token];

  const parts: string[] = [];
  let rest = token;

  while (rest.length > 0) {
    if (font.widthOfTextAtSize(rest, size) <= maxWidth) {
      parts.push(rest);
      break;
    }

    let low = 1;
    let high = rest.length;
    let best = 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const isMore = mid < rest.length;
      const candidate = `${rest.slice(0, mid)}${isMore ? "-" : ""}`;

      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const isMore = best < rest.length;
    parts.push(`${rest.slice(0, best)}${isMore ? "-" : ""}`);
    rest = rest.slice(best);
  }

  return parts;
}

function wrapLines(text: string, maxWidth: number, font: PDFFont, size: number) {
  const words = safeText(text, 9000).split(" ").filter(Boolean);
  if (words.length === 0) return [] as string[];

  const expandedWords = words.flatMap((word) =>
    font.widthOfTextAtSize(word, size) <= maxWidth
      ? [word]
      : splitLongToken(word, maxWidth, font, size),
  );

  const lines: string[] = [];
  let line = "";

  for (const word of expandedWords) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
      line = word;
      continue;
    }

    lines.push(word);
    line = "";
  }

  if (line) lines.push(line);
  return lines;
}

function drawTextLines(
  page: PDFPage,
  lines: string[],
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = palette.body,
  lineGap = 4,
) {
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, font, size, color });
    cursor -= size + lineGap;
  }
  return cursor;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = palette.body,
  lineGap = 4,
  maxLines = 999,
) {
  const lines = wrapLines(text, maxWidth, font, size);
  const visible = lines.slice(0, maxLines);

  if (lines.length > maxLines && visible.length > 0) {
    const last = visible.length - 1;
    visible[last] = `${visible[last].replace(/[\s.,;:!?]+$/g, "")}...`;
  }

  return drawTextLines(page, visible, x, y, font, size, color, lineGap);
}

function drawBulletList(
  page: PDFPage,
  items: string[],
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size: number,
  options?: { lineGap?: number; itemGap?: number; maxItems?: number; maxLinesPerItem?: number },
) {
  const lineGap = options?.lineGap ?? 4;
  const itemGap = options?.itemGap ?? 6;
  const maxItems = options?.maxItems ?? 6;
  const maxLinesPerItem = options?.maxLinesPerItem ?? 4;

  let cursor = y;
  for (const item of items.slice(0, maxItems)) {
    page.drawCircle({
      x,
      y: cursor + size / 2 - 1,
      size: 1.9,
      color: palette.body,
    });

    cursor = drawWrappedText(
      page,
      safeText(item, 720),
      x + 8,
      cursor,
      width - 8,
      font,
      size,
      palette.body,
      lineGap,
      maxLinesPerItem,
    );
    cursor -= itemGap;
  }

  return cursor;
}

function drawPageBackground(page: PDFPage, variant: number) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: palette.page });

  if (variant % 4 === 1) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 210, width: PAGE_WIDTH, height: 210, color: palette.blueTint });
    page.drawEllipse({ x: 506, y: 790, xScale: 88, yScale: 54, color: palette.goldTint, opacity: 0.72 });
    return;
  }

  if (variant % 4 === 2) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 158, width: PAGE_WIDTH, height: 158, color: palette.goldTint });
    page.drawEllipse({ x: 92, y: 108, xScale: 70, yScale: 42, color: palette.blueTint, opacity: 0.64 });
    return;
  }

  if (variant % 4 === 3) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 158, width: PAGE_WIDTH, height: 158, color: palette.mintTint });
    page.drawEllipse({ x: 506, y: 106, xScale: 76, yScale: 44, color: palette.blueTint, opacity: 0.62 });
    return;
  }

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 172, width: PAGE_WIDTH, height: 172, color: palette.blueTint });
  page.drawEllipse({ x: 468, y: 786, xScale: 74, yScale: 42, color: palette.goldTint, opacity: 0.72 });
}

function drawFooter(page: PDFPage, pageNumber: number, totalPages: number, font: PDFFont) {
  page.drawLine({
    start: { x: MARGIN_X, y: 34 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 34 },
    thickness: 1,
    color: rgb(0.88, 0.91, 0.95),
  });

  page.drawText("OLQLAB report for workplace development use.", {
    x: MARGIN_X,
    y: FOOTER_Y,
    size: 8,
    font,
    color: palette.muted,
  });

  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_WIDTH - MARGIN_X - 60,
    y: FOOTER_Y,
    size: 8,
    font,
    color: palette.muted,
  });
}

function drawSectionHeader(page: PDFPage, title: string, y: number, bold: PDFFont) {
  page.drawText(title, {
    x: MARGIN_X,
    y,
    size: 16,
    font: bold,
    color: palette.heading,
  });

  page.drawRectangle({
    x: MARGIN_X,
    y: y - 7,
    width: 196,
    height: 2,
    color: rgb(0.71, 0.79, 0.88),
  });
}

function drawTraitSignalBar(
  page: PDFPage,
  label: string,
  signal: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const barX = MARGIN_X + 150;
  const barWidth = CONTENT_WIDTH - 165;
  const barHeight = 14;
  const segment = barWidth / 3;

  page.drawText(label, {
    x: MARGIN_X,
    y: y + 2,
    size: 11,
    font: bold,
    color: palette.heading,
  });

  page.drawRectangle({ x: barX, y, width: segment, height: barHeight, color: rgb(0.83, 0.92, 1) });
  page.drawRectangle({ x: barX + segment, y, width: segment, height: barHeight, color: rgb(1, 0.91, 0.76) });
  page.drawRectangle({ x: barX + segment * 2, y, width: segment, height: barHeight, color: rgb(0.79, 0.92, 0.81) });

  const clamped = Math.max(0, Math.min(100, signal));
  const markerX = barX + (barWidth * clamped) / 100;
  const band = bandLabel(toBand(clamped));
  const bandSize = 8;
  const bandWidth = font.widthOfTextAtSize(band, bandSize);
  const bandX = PAGE_WIDTH - MARGIN_X - bandWidth;

  page.drawCircle({
    x: markerX,
    y: y + barHeight / 2,
    size: 4.8,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.14, 0.19, 0.27),
    borderWidth: 1.4,
  });

  page.drawText(band, {
    x: bandX,
    y: y + 3,
    size: bandSize,
    font,
    color: palette.muted,
  });
}

function parseCompetencySignals(raw: unknown): CompetencySignal[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { name?: unknown; score?: unknown };
      if (typeof candidate.name !== "string") return null;
      if (typeof candidate.score !== "number" || !Number.isFinite(candidate.score)) return null;
      return {
        name: candidate.name,
        score: candidate.score,
      };
    })
    .filter((item): item is CompetencySignal => Boolean(item));
}

function normalizeCompetencySignals(signals: CompetencySignal[]) {
  const sorted = [...signals].sort((a, b) => b.score - a.score).slice(0, 6);
  if (sorted.length === 0) return [] as Array<CompetencySignal & { normalized: number; band: TraitBand }>;

  const min = Math.min(...sorted.map((item) => item.score));
  const max = Math.max(...sorted.map((item) => item.score));

  return sorted.map((item) => {
    const normalized =
      max === min ? 55 : Math.round(22 + ((item.score - min) / (max - min)) * 62);

    return {
      ...item,
      normalized,
      band: toBand(normalized),
    };
  });
}

function drawCompetencySignalBar(
  page: PDFPage,
  label: string,
  signal: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const barX = MARGIN_X + 170;
  const barWidth = CONTENT_WIDTH - 184;
  const barHeight = 11;
  const segment = barWidth / 3;

  page.drawText(label, {
    x: MARGIN_X,
    y: y + 1,
    size: 9,
    font,
    color: palette.body,
  });

  page.drawRectangle({ x: barX, y, width: segment, height: barHeight, color: rgb(0.85, 0.93, 1) });
  page.drawRectangle({ x: barX + segment, y, width: segment, height: barHeight, color: rgb(1, 0.93, 0.79) });
  page.drawRectangle({ x: barX + segment * 2, y, width: segment, height: barHeight, color: rgb(0.81, 0.93, 0.83) });

  const clamped = Math.max(0, Math.min(100, signal));
  const markerX = barX + (barWidth * clamped) / 100;
  const signalBandText = bandLabel(toBand(clamped));
  const bandSize = 7;
  const bandWidth = bold.widthOfTextAtSize(signalBandText, bandSize);
  const bandX = PAGE_WIDTH - MARGIN_X - bandWidth;

  page.drawCircle({
    x: markerX,
    y: y + barHeight / 2,
    size: 3.6,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.16, 0.22, 0.3),
    borderWidth: 1.2,
  });

  page.drawText(signalBandText, {
    x: bandX,
    y: y + 1,
    size: bandSize,
    font: bold,
    color: palette.muted,
  });
}

function drawVerticalBarChart(
  page: PDFPage,
  traits: TraitSignal[],
  x: number,
  y: number,
  width: number,
  height: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const colors = [palette.chartA, palette.chartB, palette.chartC, palette.chartD, palette.chartE];
  const shortLabels = ["OPN", "CON", "EXT", "AGR", "EMR"];

  page.drawText("Signal Bar Graph", {
    x: x + 10,
    y: y + height - 18,
    size: 9,
    font: bold,
    color: palette.heading,
  });

  const plotX = x + 12;
  const plotY = y + 20;
  const plotWidth = width - 24;
  const plotHeight = height - 42;

  page.drawLine({
    start: { x: plotX, y: plotY },
    end: { x: plotX + plotWidth, y: plotY },
    thickness: 1,
    color: rgb(0.78, 0.83, 0.9),
  });

  const gap = 8;
  const barWidth = Math.max(12, (plotWidth - gap * (traits.length - 1)) / traits.length);

  for (let i = 0; i < traits.length; i += 1) {
    const item = traits[i];
    const barHeight = Math.max(8, (plotHeight * item.value) / 100);
    const barX = plotX + i * (barWidth + gap);

    page.drawRectangle({
      x: barX,
      y: plotY,
      width: barWidth,
      height: barHeight,
      color: colors[i % colors.length],
      opacity: 0.9,
    });

    page.drawText(shortLabels[i] || item.label.slice(0, 3).toUpperCase(), {
      x: barX + 1,
      y: plotY - 10,
      size: 6.8,
      font,
      color: palette.muted,
    });
  }
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function pieSlicePath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarPoint(cx, cy, radius, startAngle);
  const end = polarPoint(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function drawTraitPieChart(
  page: PDFPage,
  traits: TraitSignal[],
  x: number,
  y: number,
  width: number,
  height: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const colors = [palette.chartA, palette.chartB, palette.chartC, palette.chartD, palette.chartE];
  const values = traits.map((item) => Math.max(2, item.value));
  const total = values.reduce((sum, value) => sum + value, 0);

  page.drawText("Trait Mix Pie", {
    x: x + 10,
    y: y + height - 18,
    size: 9,
    font: bold,
    color: palette.heading,
  });

  const cx = x + 52;
  const cy = y + 45;
  const radius = 30;

  if (total > 0) {
    let cursor = -Math.PI / 2;
    for (let i = 0; i < values.length; i += 1) {
      const ratio = values[i] / total;
      const next = cursor + ratio * Math.PI * 2;

      page.drawSvgPath(pieSlicePath(cx, cy, radius, cursor, next), {
        color: colors[i % colors.length],
        borderColor: rgb(1, 1, 1),
        borderWidth: 0.8,
      });

      cursor = next;
    }
  }

  page.drawCircle({
    x: cx,
    y: cy,
    size: 14,
    color: palette.white,
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 1,
  });

  let legendY = y + height - 30;
  for (let i = 0; i < traits.length; i += 1) {
    const item = traits[i];
    const lx = x + 96;

    page.drawRectangle({
      x: lx,
      y: legendY - 2,
      width: 7,
      height: 7,
      color: colors[i % colors.length],
    });

    page.drawText(item.label, {
      x: lx + 11,
      y: legendY - 1,
      size: 7.3,
      font,
      color: palette.body,
    });

    legendY -= 12;
  }
}

function drawScenarioThemeCard(
  page: PDFPage,
  theme: {
    name: string;
    category: "strength" | "focus";
    insight: string;
  },
  y: number,
  font: PDFFont,
  bold: PDFFont,
) {
  const tint = theme.category === "strength" ? palette.strengthTint : palette.focusTint;

  page.drawRectangle({
    x: MARGIN_X,
    y: y - 72,
    width: CONTENT_WIDTH,
    height: 64,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  page.drawRectangle({ x: MARGIN_X + 10, y: y - 26, width: 74, height: 14, color: tint });
  page.drawText(theme.category === "strength" ? "Strength" : "Focus", {
    x: MARGIN_X + 15,
    y: y - 21,
    size: 8,
    font: bold,
    color: palette.heading,
  });

  page.drawText(safeText(theme.name, 58), {
    x: MARGIN_X + 92,
    y: y - 20,
    size: 10,
    font: bold,
    color: palette.heading,
  });

  drawWrappedText(
    page,
    safeText(theme.insight, 360),
    MARGIN_X + 10,
    y - 40,
    CONTENT_WIDTH - 20,
    font,
    9.5,
    palette.body,
    3,
    2,
  );
}

function addPage(pdf: PDFDocument, pages: PDFPage[]) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawPageBackground(page, pages.length + 1);
  pages.push(page);
  return page;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { assessmentId } = await params;

  await runDueUnenrollJobs({
    assessmentId,
    userId: check.session.user.id,
  });

  const session = await db.quizSession.findUnique({
    where: {
      assessmentId_userId: {
        assessmentId,
        userId: check.session.user.id,
      },
    },
    include: {
      assessment: { include: { policy: true } },
      user: true,
    },
  });

  if (!session || session.status !== "SUBMITTED") {
    return NextResponse.json({ error: "No submitted report" }, { status: 404 });
  }

  const access = await resolveAssessmentAccess(check.session.user.id, assessmentId);
  if (!access.canViewAppReport) {
    return NextResponse.json(
      {
        error: access.canViewViaLinkOnly
          ? "App access to this report is disabled. Use your secure share link from email."
          : "Your access to this report has been revoked by your administrator.",
      },
      { status: 403 },
    );
  }

  const policy = session.assessment.policy;
  if (!policy?.showResultsToEmployee) {
    return NextResponse.json(
      { error: "Organization policy does not allow individual report export." },
      { status: 403 },
    );
  }

  if (session.submittedAt) {
    const releaseAt = addHours(session.submittedAt, policy.resultReleaseDelayHours);
    if (new Date() < releaseAt) {
      return NextResponse.json(
        { error: `Results will be available after ${releaseAt.toISOString()}.` },
        { status: 403 },
      );
    }
  }

  const report = await db.report.findUnique({
    where: {
      assessmentId_userId: {
        assessmentId,
        userId: check.session.user.id,
      },
    },
    include: {
      pdfAsset: true,
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not ready" }, { status: 404 });
  }

  if (report.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Report is still under review and has not been published yet." },
      { status: 403 },
    );
  }

  if (report.availableAt && new Date() < report.availableAt) {
    return NextResponse.json(
      { error: `Report will be available after ${report.availableAt.toISOString()}.` },
      { status: 403 },
    );
  }

  if (policy.reportWorkflow === "MANUAL_PDF_UPLOAD") {
    if (!report.pdfAsset?.pdfBytes?.length) {
      return NextResponse.json(
        { error: "Report PDF is not uploaded yet." },
        { status: 404 },
      );
    }

    const fallbackFileName = `report-${session.user.firstName}-${session.user.lastName}-${assessmentId}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return new Response(new Uint8Array(report.pdfAsset.pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${report.pdfAsset.fileName || `${fallbackFileName}.pdf`}\"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const score = await db.score.findUnique({
    where: {
      assessmentId_userId: {
        assessmentId,
        userId: check.session.user.id,
      },
    },
  });

  if (!score) {
    return NextResponse.json({ error: "Report not ready" }, { status: 404 });
  }

  let narrative: NarrativePayload = {};
  try {
    narrative = JSON.parse(report.narrativeJson || "{}");
  } catch {
    narrative = {};
  }

  const participantName =
    safeText(narrative.participantName, 100) ||
    safeText(`${session.user.firstName} ${session.user.lastName}`, 100) ||
    "Participant";
  const firstName = participantName.split(" ")[0] || "Participant";

  const assessmentTitle =
    safeText(narrative.assessmentTitle, 120) || safeText(session.assessment.title, 120);
  const takenAt = formatTakenAt(narrative.assessmentTakenAt || session.submittedAt);

  const summary =
    safeText(narrative.summary, 1300) ||
    "This report combines trait tendencies with workplace scenario choices to support practical growth in role impact, collaboration quality, and execution consistency.";

  const profileHeadline = safeText(narrative.profileHeadline, 100) || "Adaptive Contributor";

  const strengths =
    narrative.strengths?.length
      ? narrative.strengths
      : [
          "Your strongest patterns are visible in how you frame ambiguity, sustain accountability, and influence team momentum in high-priority work.",
        ];

  const growthAreas =
    narrative.growthAreas?.length
      ? narrative.growthAreas
      : [
          "Development opportunities focus on improving consistency under pressure and strengthening collaboration quality in difficult trade-offs.",
        ];

  const actions =
    narrative.actions?.length
      ? narrative.actions
      : [
          "Choose one high-impact strength behavior and apply it intentionally in your next visible project.",
          "Define one growth behavior and practice it weekly with clear examples.",
          "Request concise feedback from your leader after each key milestone.",
        ];

  const workplaceSignals = narrative.workplaceSignals || [];
  const reflectionPrompts = narrative.reflectionPrompts || [];
  const managerGuide = narrative.managerDiscussionGuide || [];
  const competencyThemes = narrative.competencyThemes || [];

  const traitSignals: TraitSignal[] = [
    { label: "Openness", value: Number(score.openness || 0) },
    { label: "Conscientiousness", value: Number(score.conscientiousness || 0) },
    { label: "Extraversion", value: Number(score.extraversion || 0) },
    { label: "Agreeableness", value: Number(score.agreeableness || 0) },
    { label: "Emotional Reactivity", value: Number(score.neuroticism || 0) },
  ].map((item) => ({
    ...item,
    value: Math.max(0, Math.min(100, item.value)),
  }));

  const competencySignals = normalizeCompetencySignals(
    parseCompetencySignals(score.competencyJson),
  );

  const extendedSections: Array<{ title: string; content: string }> = [
    {
      title: "Executive Perspective",
      content: safeText(narrative.aiNarrative?.executiveSummary, 1900),
    },
    {
      title: "Strength Narrative",
      content: safeText(narrative.aiNarrative?.strengthsNarrative, 1900),
    },
    {
      title: "Development Narrative",
      content: safeText(narrative.aiNarrative?.developmentNarrative, 1900),
    },
    {
      title: "Manager Coaching Cues",
      content: safeText(narrative.aiNarrative?.managerCoaching, 1900),
    },
  ].filter((section) => section.content);

  const roadmap = (narrative.aiNarrative?.improvementRoadmap || []).filter(Boolean);
  const cautionNotes = (narrative.aiNarrative?.cautionNotes || []).filter(Boolean);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];

  const page1 = addPage(pdf, pages);
  const page2 = addPage(pdf, pages);
  const page3 = addPage(pdf, pages);

  page1.drawRectangle({
    x: MARGIN_X,
    y: 636,
    width: CONTENT_WIDTH,
    height: 176,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  page1.drawText("OLQLAB Development Report", {
    x: MARGIN_X + 16,
    y: 777,
    size: 28,
    font: bold,
    color: palette.heading,
  });
  page1.drawText(assessmentTitle, {
    x: MARGIN_X + 16,
    y: 750,
    size: 12,
    font,
    color: palette.body,
  });

  page1.drawText(`Prepared for ${participantName}`, {
    x: MARGIN_X + 16,
    y: 726,
    size: 12,
    font,
    color: palette.body,
  });
  page1.drawText(`Test Taken: ${takenAt}`, {
    x: MARGIN_X + 16,
    y: 707,
    size: 12,
    font,
    color: palette.body,
  });

  page1.drawRectangle({
    x: MARGIN_X,
    y: 552,
    width: CONTENT_WIDTH,
    height: 70,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  drawWrappedText(
    page1,
    `${firstName}, ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`,
    MARGIN_X + 14,
    597,
    CONTENT_WIDTH - 28,
    font,
    11,
    palette.body,
    4,
    4,
  );

  drawSectionHeader(page1, "Trait Signal Map", 522, bold);
  page1.drawText("Visual indicators only. No numeric score display.", {
    x: MARGIN_X,
    y: 503,
    size: 9,
    font,
    color: palette.muted,
  });

  let traitY = 472;
  for (const trait of traitSignals) {
    drawTraitSignalBar(page1, trait.label, trait.value, traitY, font, bold);
    traitY -= 34;
  }

  page1.drawText("Emerging", { x: MARGIN_X + 150, y: 297, size: 8, font, color: palette.muted });
  page1.drawText("Balanced", {
    x: MARGIN_X + 150 + (CONTENT_WIDTH - 165) / 2 - 20,
    y: 297,
    size: 8,
    font,
    color: palette.muted,
  });
  page1.drawText("Strong", {
    x: MARGIN_X + CONTENT_WIDTH - 30,
    y: 297,
    size: 8,
    font,
    color: palette.muted,
  });

  drawSectionHeader(page1, "Profile Focus", 262, bold);
  page1.drawRectangle({
    x: MARGIN_X,
    y: 178,
    width: CONTENT_WIDTH,
    height: 72,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  page1.drawText(profileHeadline, {
    x: MARGIN_X + 14,
    y: 228,
    size: 14,
    font: bold,
    color: palette.heading,
  });

  drawWrappedText(
    page1,
    "Use your strongest signals intentionally in visible work and pair them with one deliberate growth behavior to increase reliability under pressure.",
    MARGIN_X + 14,
    206,
    CONTENT_WIDTH - 28,
    font,
    10.5,
    palette.body,
    4,
    2,
  );

  drawSectionHeader(page1, "Signal Visual Snapshot", 156, bold);
  const visualCardY = 58;
  const visualCardHeight = 88;
  const visualGap = 10;
  const visualCardWidth = (CONTENT_WIDTH - visualGap) / 2;

  page1.drawRectangle({
    x: MARGIN_X,
    y: visualCardY,
    width: visualCardWidth,
    height: visualCardHeight,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  page1.drawRectangle({
    x: MARGIN_X + visualCardWidth + visualGap,
    y: visualCardY,
    width: visualCardWidth,
    height: visualCardHeight,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  drawVerticalBarChart(
    page1,
    traitSignals,
    MARGIN_X,
    visualCardY,
    visualCardWidth,
    visualCardHeight,
    font,
    bold,
  );

  drawTraitPieChart(
    page1,
    traitSignals,
    MARGIN_X + visualCardWidth + visualGap,
    visualCardY,
    visualCardWidth,
    visualCardHeight,
    font,
    bold,
  );

  page2.drawText("Strengths, Development, and Role Signals", {
    x: MARGIN_X,
    y: 782,
    size: 24,
    font: bold,
    color: palette.heading,
  });

  page2.drawRectangle({
    x: MARGIN_X,
    y: 462,
    width: CONTENT_WIDTH / 2 - 8,
    height: 292,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });
  page2.drawRectangle({
    x: MARGIN_X + CONTENT_WIDTH / 2 + 8,
    y: 462,
    width: CONTENT_WIDTH / 2 - 8,
    height: 292,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  page2.drawRectangle({ x: MARGIN_X + 12, y: 726, width: 106, height: 18, color: palette.strengthTint });
  page2.drawText("Strengths", { x: MARGIN_X + 18, y: 732, size: 9, font: bold, color: palette.heading });

  page2.drawRectangle({
    x: MARGIN_X + CONTENT_WIDTH / 2 + 20,
    y: 726,
    width: 144,
    height: 18,
    color: palette.focusTint,
  });
  page2.drawText("Development Areas", {
    x: MARGIN_X + CONTENT_WIDTH / 2 + 28,
    y: 732,
    size: 9,
    font: bold,
    color: palette.heading,
  });

  drawBulletList(
    page2,
    strengths,
    MARGIN_X + 16,
    704,
    CONTENT_WIDTH / 2 - 34,
    font,
    10.5,
    { maxItems: 6, maxLinesPerItem: 3 },
  );

  drawBulletList(
    page2,
    growthAreas,
    MARGIN_X + CONTENT_WIDTH / 2 + 24,
    704,
    CONTENT_WIDTH / 2 - 34,
    font,
    10.5,
    { maxItems: 6, maxLinesPerItem: 3 },
  );

  drawSectionHeader(page2, "Competency Signal Bars", 436, bold);
  page2.drawText("Relative signal display only. No score values shown.", {
    x: MARGIN_X,
    y: 417,
    size: 8.5,
    font,
    color: palette.muted,
  });

  let competencyY = 388;
  if (competencySignals.length > 0) {
    for (const item of competencySignals) {
      drawCompetencySignalBar(page2, item.name, item.normalized, competencyY, font, bold);
      competencyY -= 28;
    }
  } else {
    drawWrappedText(
      page2,
      "Competency trend bars will appear here once scenario competency scoring data is available.",
      MARGIN_X,
      competencyY,
      CONTENT_WIDTH,
      font,
      10,
      palette.muted,
      4,
      3,
    );
    competencyY -= 60;
  }

  drawSectionHeader(page2, "Scenario Themes", competencyY + 8, bold);

  const visibleThemes = competencyThemes.slice(0, 6);
  let themeY = competencyY - 22;
  const themeStep = 78;
  const minThemeAnchorY = 120;
  const themeCapacity = Math.max(
    0,
    Math.floor((themeY - minThemeAnchorY) / themeStep) + 1,
  );
  const page2Themes = visibleThemes.slice(0, themeCapacity);
  const overflowThemes = visibleThemes.slice(themeCapacity);

  for (const theme of page2Themes) {
    drawScenarioThemeCard(page2, theme, themeY, font, bold);
    themeY -= themeStep;
  }

  page3.drawText("Action Plan and Development Support", {
    x: MARGIN_X,
    y: 782,
    size: 24,
    font: bold,
    color: palette.heading,
  });

  drawSectionHeader(page3, "Action Plan", 746, bold);
  page3.drawRectangle({
    x: MARGIN_X,
    y: 498,
    width: CONTENT_WIDTH,
    height: 228,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  drawBulletList(page3, actions, MARGIN_X + 16, 698, CONTENT_WIDTH - 30, font, 11, {
    maxItems: 8,
    maxLinesPerItem: 3,
  });

  drawSectionHeader(page3, "Workplace Signals", 472, bold);
  page3.drawRectangle({
    x: MARGIN_X,
    y: 336,
    width: CONTENT_WIDTH,
    height: 118,
    color: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
  });

  drawBulletList(
    page3,
    workplaceSignals.length > 0
      ? workplaceSignals
      : [
          "Performance is strongest when priorities, ownership, and decision boundaries are explicit.",
        ],
    MARGIN_X + 16,
    430,
    CONTENT_WIDTH - 30,
    font,
    10,
    { maxItems: 3, maxLinesPerItem: 2 },
  );

  const hasReflection = reflectionPrompts.length > 0;
  const hasManagerGuide = managerGuide.length > 0;

  if (hasReflection || hasManagerGuide) {
    const cardY = 118;
    const cardHeight = 196;

    if (hasReflection) {
      page3.drawRectangle({
        x: MARGIN_X,
        y: cardY,
        width: hasManagerGuide ? CONTENT_WIDTH / 2 - 8 : CONTENT_WIDTH,
        height: cardHeight,
        color: palette.white,
        borderColor: palette.border,
        borderWidth: 1,
      });

      page3.drawText("Reflection Prompts", {
        x: MARGIN_X + 12,
        y: cardY + cardHeight - 24,
        size: 12,
        font: bold,
        color: palette.heading,
      });

      drawBulletList(
        page3,
        reflectionPrompts,
        MARGIN_X + 14,
        cardY + cardHeight - 44,
        (hasManagerGuide ? CONTENT_WIDTH / 2 - 8 : CONTENT_WIDTH) - 26,
        font,
        9.5,
        { maxItems: 5, maxLinesPerItem: 2, itemGap: 4 },
      );
    }

    if (hasManagerGuide) {
      const x = hasReflection ? MARGIN_X + CONTENT_WIDTH / 2 + 8 : MARGIN_X;
      const width = hasReflection ? CONTENT_WIDTH / 2 - 8 : CONTENT_WIDTH;

      page3.drawRectangle({
        x,
        y: cardY,
        width,
        height: cardHeight,
        color: palette.white,
        borderColor: palette.border,
        borderWidth: 1,
      });

      page3.drawText("Manager Conversation Guide", {
        x: x + 12,
        y: cardY + cardHeight - 24,
        size: 12,
        font: bold,
        color: palette.heading,
      });

      drawBulletList(page3, managerGuide, x + 14, cardY + cardHeight - 44, width - 26, font, 9.5, {
        maxItems: 5,
        maxLinesPerItem: 2,
        itemGap: 4,
      });
    }
  }

  if (overflowThemes.length > 0) {
    const queue = [...overflowThemes];

    while (queue.length > 0) {
      const themePage = addPage(pdf, pages);
      themePage.drawText("Scenario Themes (continued)", {
        x: MARGIN_X,
        y: 782,
        size: 23,
        font: bold,
        color: palette.heading,
      });
      drawSectionHeader(themePage, "Scenario Themes", 748, bold);

      let overflowY = 716;
      while (queue.length > 0 && overflowY >= 130) {
        const theme = queue.shift();
        if (!theme) break;

        drawScenarioThemeCard(themePage, theme, overflowY, font, bold);
        overflowY -= 78;
      }
    }
  }

  const hasExtended = extendedSections.length > 0 || roadmap.length > 0 || cautionNotes.length > 0;
  if (hasExtended) {
    let page = addPage(pdf, pages);

    page.drawText("Extended Insights", {
      x: MARGIN_X,
      y: 782,
      size: 24,
      font: bold,
      color: palette.heading,
    });

    let y = 746;

    const ensureRoom = (requiredHeight: number) => {
      if (y - requiredHeight >= 64) return;
      page = addPage(pdf, pages);
      page.drawText("Extended Insights (continued)", {
        x: MARGIN_X,
        y: 782,
        size: 20,
        font: bold,
        color: palette.heading,
      });
      y = 746;
    };

    for (const section of extendedSections) {
      const lines = wrapLines(section.content, CONTENT_WIDTH - 26, font, 11);
      const lineHeight = 15;
      const contentHeight = Math.max(3, lines.length) * lineHeight;
      const blockHeight = 44 + contentHeight;

      ensureRoom(blockHeight + 12);

      page.drawRectangle({
        x: MARGIN_X,
        y: y - blockHeight,
        width: CONTENT_WIDTH,
        height: blockHeight,
        color: palette.white,
        borderColor: palette.border,
        borderWidth: 1,
      });

      page.drawText(section.title, {
        x: MARGIN_X + 12,
        y: y - 24,
        size: 13,
        font: bold,
        color: palette.heading,
      });

      drawTextLines(page, lines, MARGIN_X + 12, y - 46, font, 11, palette.body, 4);
      y -= blockHeight + 12;
    }

    if (roadmap.length > 0) {
      const estimatedHeight = 60 + Math.min(roadmap.length, 8) * 32;
      ensureRoom(estimatedHeight + 12);

      page.drawRectangle({
        x: MARGIN_X,
        y: y - estimatedHeight,
        width: CONTENT_WIDTH,
        height: estimatedHeight,
        color: palette.white,
        borderColor: palette.border,
        borderWidth: 1,
      });

      page.drawText("Roadmap", {
        x: MARGIN_X + 12,
        y: y - 24,
        size: 13,
        font: bold,
        color: palette.heading,
      });

      drawBulletList(page, roadmap, MARGIN_X + 14, y - 44, CONTENT_WIDTH - 28, font, 10.5, {
        maxItems: 8,
        maxLinesPerItem: 2,
      });

      y -= estimatedHeight + 12;
    }

    if (cautionNotes.length > 0) {
      const estimatedHeight = 56 + Math.min(cautionNotes.length, 6) * 28;
      ensureRoom(estimatedHeight + 12);

      page.drawRectangle({
        x: MARGIN_X,
        y: y - estimatedHeight,
        width: CONTENT_WIDTH,
        height: estimatedHeight,
        color: palette.white,
        borderColor: palette.border,
        borderWidth: 1,
      });

      page.drawText("Interpretation Notes", {
        x: MARGIN_X + 12,
        y: y - 24,
        size: 13,
        font: bold,
        color: palette.heading,
      });

      drawBulletList(page, cautionNotes, MARGIN_X + 14, y - 44, CONTENT_WIDTH - 28, font, 10, {
        maxItems: 6,
        maxLinesPerItem: 2,
      });
    }
  }

  const totalPages = pages.length;
  pages.forEach((page, index) => drawFooter(page, index + 1, totalPages, font));

  const bytes = await pdf.save();

  const filename = `report-${session.user.firstName}-${session.user.lastName}-${assessmentId}`
    .replace(/\s+/g, "-")
    .toLowerCase();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}.pdf\"`,
      "Cache-Control": "private, no-store",
    },
  });
}
