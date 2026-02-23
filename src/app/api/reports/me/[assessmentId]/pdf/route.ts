import { addHours, format } from "date-fns";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

type TraitKey =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

type TraitNarrative = {
  key: TraitKey;
  name: string;
  band: "high" | "moderate" | "emerging";
  summary: string;
  leverage: string;
  developmentFocus: string;
};

type NarrativePayload = {
  profileHeadline?: string;
  summary?: string;
  strengths?: string[];
  growthAreas?: string[];
  actions?: string[];
  workplaceSignals?: string[];
  reflectionPrompts?: string[];
  managerDiscussionGuide?: string[];
  traitNarratives?: TraitNarrative[];
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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const SIDE_MARGIN = 40;

const theme = {
  title: rgb(0.09, 0.14, 0.2),
  body: rgb(0.16, 0.2, 0.26),
  muted: rgb(0.34, 0.4, 0.47),
  border: rgb(0.86, 0.89, 0.93),
  chip: rgb(0.94, 0.96, 0.99),
  chipText: rgb(0.24, 0.29, 0.35),
};

function safeText(input: string | undefined, max = 1000) {
  return (input || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function formatTakenAt(input?: string | null) {
  if (!input) return "Not available";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Not available";
  return format(date, "MMMM d, yyyy 'at' h:mm a");
}

function toBand(value: number): "high" | "moderate" | "emerging" {
  if (value < 35) return "emerging";
  if (value < 70) return "moderate";
  return "high";
}

function fallbackTraitNarrative(key: TraitKey, value: number): TraitNarrative {
  const band = toBand(value);

  const labels: Record<TraitKey, string> = {
    openness: "Openness",
    conscientiousness: "Conscientiousness",
    extraversion: "Extraversion",
    agreeableness: "Agreeableness",
    neuroticism: "Emotional Reactivity",
  };

  if (key === "neuroticism") {
    if (band === "high") {
      return {
        key,
        name: labels[key],
        band,
        summary: "Pressure sensitivity appears elevated and may influence choices in uncertain moments.",
        leverage: "This can help with early risk detection when important signals begin to shift.",
        developmentFocus:
          "Use clear reset habits and escalation paths to preserve consistency in high-pressure decisions.",
      };
    }
    if (band === "moderate") {
      return {
        key,
        name: labels[key],
        band,
        summary: "Pressure response appears balanced, with some context-dependent variability.",
        leverage: "This can support both empathy and practical focus during team execution.",
        developmentFocus:
          "Track trigger patterns and pre-agree recovery routines before major delivery events.",
      };
    }
    return {
      key,
      name: labels[key],
      band,
      summary: "Emotional steadiness appears strong in ambiguous or high-tempo conditions.",
      leverage: "This helps stabilize team decision quality during disruption.",
      developmentFocus:
        "Signal urgency clearly so calm communication is not interpreted as low intensity.",
    };
  }

  if (band === "high") {
    return {
      key,
      name: labels[key],
      band,
      summary: `${labels[key]} is high and likely visible in day-to-day behavior and decisions.`,
      leverage:
        "Use this deliberately in cross-functional projects where your natural tendency can create momentum.",
      developmentFocus:
        "Check for overuse so this strength remains productive across different team contexts.",
    };
  }

  if (band === "moderate") {
    return {
      key,
      name: labels[key],
      band,
      summary: `${labels[key]} is moderate, providing balance across structured and changing environments.`,
      leverage: "This supports flexible contribution across varied project demands.",
      developmentFocus:
        "Increase impact by deciding when this trait should be made more visible in key moments.",
    };
  }

  return {
    key,
    name: labels[key],
    band,
    summary: `${labels[key]} is emerging and represents a meaningful development opportunity.`,
    leverage:
      "You can still create value by pairing adjacent strengths with intentional behavioral practice.",
    developmentFocus:
      "Choose one weekly behavior to grow capability and track evidence of improvement over time.",
  };
}

function wrapLines(text: string, maxWidth: number, font: PDFFont, size: number) {
  const words = safeText(text, 4000).split(" ").filter(Boolean);
  if (words.length === 0) return [] as string[];

  const lines: string[] = [];
  let line = "";

  for (const word of words) {
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

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = theme.body,
  lineGap = 4,
  maxLines = 999,
) {
  const lines = wrapLines(text, maxWidth, font, size);
  const applied = lines.slice(0, maxLines);

  if (lines.length > maxLines && applied.length > 0) {
    const last = applied.length - 1;
    applied[last] = applied[last].replace(/[\s.,;:!?]+$/g, "") + "...";
  }

  let cursorY = y;
  for (const line of applied) {
    page.drawText(line, {
      x,
      y: cursorY,
      size,
      font,
      color,
    });
    cursorY -= size + lineGap;
  }

  return cursorY;
}

function drawSectionHeading(page: PDFPage, text: string, y: number, font: PDFFont) {
  page.drawText(text, {
    x: SIDE_MARGIN,
    y,
    size: 14,
    font,
    color: theme.title,
  });
  page.drawRectangle({
    x: SIDE_MARGIN,
    y: y - 6,
    width: 160,
    height: 2,
    color: rgb(0.75, 0.82, 0.91),
  });
}

function drawBulletList(
  page: PDFPage,
  items: string[],
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  maxItems = 6,
  maxLinesPerItem = 3,
) {
  let cursor = y;
  for (const item of items.slice(0, maxItems)) {
    page.drawCircle({
      x,
      y: cursor + size / 2 - 1,
      size: 1.8,
      color: theme.body,
    });
    cursor = drawWrappedText(
      page,
      safeText(item, 340),
      x + 8,
      cursor,
      maxWidth - 8,
      font,
      size,
      theme.body,
      3,
      maxLinesPerItem,
    );
    cursor -= 3;
  }
  return cursor;
}

function drawFooter(page: PDFPage, pageNumber: number, totalPages: number, font: PDFFont) {
  page.drawLine({
    start: { x: SIDE_MARGIN, y: 34 },
    end: { x: PAGE_WIDTH - SIDE_MARGIN, y: 34 },
    thickness: 1,
    color: rgb(0.9, 0.92, 0.95),
  });

  page.drawText("Generated for developmental use in workplace contexts.", {
    x: SIDE_MARGIN,
    y: 22,
    size: 8,
    font,
    color: theme.muted,
  });

  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_WIDTH - SIDE_MARGIN - 58,
    y: 22,
    size: 8,
    font,
    color: theme.muted,
  });
}

function drawBackground(page: PDFPage, variant: 1 | 2 | 3) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(0.985, 0.989, 0.996),
  });

  if (variant === 1) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 170, width: PAGE_WIDTH, height: 170, color: rgb(0.94, 0.97, 1) });
    page.drawEllipse({ x: 505, y: 805, xScale: 88, yScale: 56, color: rgb(1, 0.95, 0.86), opacity: 0.7 });
    page.drawEllipse({ x: 120, y: 94, xScale: 80, yScale: 48, color: rgb(0.86, 0.95, 1), opacity: 0.5 });
    return;
  }

  if (variant === 2) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 120, width: PAGE_WIDTH, height: 120, color: rgb(0.95, 0.97, 1) });
    page.drawEllipse({ x: 470, y: 95, xScale: 88, yScale: 54, color: rgb(0.98, 0.95, 0.87), opacity: 0.6 });
    return;
  }

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 135, width: PAGE_WIDTH, height: 135, color: rgb(0.95, 0.98, 0.98) });
  page.drawEllipse({ x: 82, y: 110, xScale: 68, yScale: 42, color: rgb(0.88, 0.95, 0.97), opacity: 0.7 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const check = await requireSession();
  if ("error" in check) return check.error;
  const { assessmentId } = await params;

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

  const score = await db.score.findUnique({
    where: { assessmentId_userId: { assessmentId, userId: check.session.user.id } },
  });
  const report = await db.report.findUnique({
    where: { assessmentId_userId: { assessmentId, userId: check.session.user.id } },
  });

  if (!score || !report) {
    return NextResponse.json({ error: "Report not ready" }, { status: 404 });
  }

  const narrative = JSON.parse(report.narrativeJson || "{}") as NarrativePayload;

  const traitNarratives = (narrative.traitNarratives || []).length
    ? (narrative.traitNarratives || [])
    : [
        fallbackTraitNarrative("openness", Number(score.openness || 0)),
        fallbackTraitNarrative("conscientiousness", Number(score.conscientiousness || 0)),
        fallbackTraitNarrative("extraversion", Number(score.extraversion || 0)),
        fallbackTraitNarrative("agreeableness", Number(score.agreeableness || 0)),
        fallbackTraitNarrative("neuroticism", Number(score.neuroticism || 0)),
      ];

  const strengths =
    narrative.strengths?.length
      ? narrative.strengths
      : ["Report strengths are being finalized. Please revisit after regeneration."];

  const growthAreas =
    narrative.growthAreas?.length
      ? narrative.growthAreas
      : ["Report development areas are being finalized. Please revisit after regeneration."];

  const actions =
    narrative.actions?.length
      ? narrative.actions
      : [
          "Select one visible strength behavior to apply weekly in cross-team work.",
          "Select one development behavior and track it for 4 weeks.",
          "Review progress with your manager in concrete project examples.",
        ];

  const workplaceSignals = narrative.workplaceSignals || [];
  const reflectionPrompts = narrative.reflectionPrompts || [];
  const managerGuide = narrative.managerDiscussionGuide || [];
  const competencyThemes = narrative.competencyThemes || [];

  const extendedInsight = [
    narrative.aiNarrative?.executiveSummary,
    narrative.aiNarrative?.strengthsNarrative,
    narrative.aiNarrative?.developmentNarrative,
    narrative.aiNarrative?.managerCoaching,
  ].filter((item): item is string => Boolean(item));

  const takenAt = formatTakenAt(narrative.assessmentTakenAt || session.submittedAt?.toISOString());
  const participant =
    safeText(narrative.participantName, 80) ||
    safeText(`${session.user.firstName} ${session.user.lastName}`, 80);
  const assessmentTitle =
    safeText(narrative.assessmentTitle, 90) || safeText(session.assessment.title, 90);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page1 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const page2 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const page3 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  drawBackground(page1, 1);
  drawBackground(page2, 2);
  drawBackground(page3, 3);

  page1.drawRectangle({
    x: SIDE_MARGIN,
    y: 734,
    width: PAGE_WIDTH - SIDE_MARGIN * 2,
    height: 88,
    color: rgb(0.99, 0.95, 0.86),
    borderColor: rgb(0.94, 0.86, 0.69),
    borderWidth: 1,
  });

  page1.drawText("OLQLAB Development Report", {
    x: SIDE_MARGIN + 14,
    y: 792,
    size: 22,
    font: bold,
    color: theme.title,
  });
  page1.drawText(assessmentTitle, {
    x: SIDE_MARGIN + 14,
    y: 772,
    size: 12,
    font,
    color: theme.chipText,
  });

  page1.drawRectangle({
    x: SIDE_MARGIN,
    y: 654,
    width: PAGE_WIDTH - SIDE_MARGIN * 2,
    height: 64,
    color: rgb(1, 1, 1),
    borderColor: theme.border,
    borderWidth: 1,
  });

  page1.drawText(`Participant: ${participant}`, {
    x: SIDE_MARGIN + 14,
    y: 695,
    size: 10,
    font,
    color: theme.body,
  });
  page1.drawText(`Email: ${safeText(session.user.email, 80)}`, {
    x: SIDE_MARGIN + 14,
    y: 678,
    size: 10,
    font,
    color: theme.body,
  });
  page1.drawText(`Test Taken: ${takenAt}`, {
    x: SIDE_MARGIN + 14,
    y: 661,
    size: 10,
    font,
    color: theme.body,
  });

  let y1 = 630;
  drawSectionHeading(page1, safeText(narrative.profileHeadline, 60) || "Workstyle Development Profile", y1, bold);
  y1 -= 24;
  y1 = drawWrappedText(
    page1,
    safeText(narrative.summary, 900) ||
      "This report combines personality tendencies and scenario behavior patterns to highlight strengths, development priorities, and practical next steps.",
    SIDE_MARGIN,
    y1,
    PAGE_WIDTH - SIDE_MARGIN * 2,
    font,
    11,
    theme.body,
    4,
    6,
  );

  y1 -= 8;
  drawSectionHeading(page1, "Strength Snapshot", y1, bold);
  y1 -= 20;
  y1 = drawBulletList(
    page1,
    strengths,
    SIDE_MARGIN + 2,
    y1,
    PAGE_WIDTH - SIDE_MARGIN * 2,
    font,
    10,
    3,
    2,
  );

  y1 -= 6;
  drawSectionHeading(page1, "Development Snapshot", y1, bold);
  y1 -= 20;
  y1 = drawBulletList(
    page1,
    growthAreas,
    SIDE_MARGIN + 2,
    y1,
    PAGE_WIDTH - SIDE_MARGIN * 2,
    font,
    10,
    3,
    2,
  );

  y1 -= 4;
  drawSectionHeading(page1, "How to Use This Report", y1, bold);
  y1 -= 20;
  drawWrappedText(
    page1,
    "Use strengths intentionally in visible work while practicing one growth behavior in real project situations. Weekly reflection and short feedback loops will compound outcomes faster than occasional broad adjustments.",
    SIDE_MARGIN,
    y1,
    PAGE_WIDTH - SIDE_MARGIN * 2,
    font,
    10,
    theme.body,
    3,
    4,
  );

  let y2 = 785;
  page2.drawText("Trait Context and Workplace Application", {
    x: SIDE_MARGIN,
    y: y2,
    size: 19,
    font: bold,
    color: theme.title,
  });
  y2 -= 20;
  page2.drawText(
    "Each trait is described with practical context so strengths are used intentionally and development stays specific.",
    {
      x: SIDE_MARGIN,
      y: y2,
      size: 10,
      font,
      color: theme.muted,
    },
  );

  y2 -= 24;
  const bandLabel: Record<TraitNarrative["band"], string> = {
    high: "High signal",
    moderate: "Moderate signal",
    emerging: "Emerging signal",
  };

  for (const trait of traitNarratives.slice(0, 5)) {
    const cardTop = y2;
    const cardHeight = 118;

    page2.drawRectangle({
      x: SIDE_MARGIN,
      y: cardTop - cardHeight,
      width: PAGE_WIDTH - SIDE_MARGIN * 2,
      height: cardHeight,
      color: rgb(1, 1, 1),
      borderColor: theme.border,
      borderWidth: 1,
    });

    page2.drawText(`${trait.name}`, {
      x: SIDE_MARGIN + 12,
      y: cardTop - 20,
      size: 12,
      font: bold,
      color: theme.title,
    });

    const chipLabel = bandLabel[trait.band] || "Signal";
    const chipWidth = Math.max(78, font.widthOfTextAtSize(chipLabel, 8) + 14);

    page2.drawRectangle({
      x: PAGE_WIDTH - SIDE_MARGIN - chipWidth - 12,
      y: cardTop - 24,
      width: chipWidth,
      height: 14,
      color: theme.chip,
      borderColor: theme.border,
      borderWidth: 1,
    });
    page2.drawText(chipLabel, {
      x: PAGE_WIDTH - SIDE_MARGIN - chipWidth - 5,
      y: cardTop - 20,
      size: 8,
      font,
      color: theme.chipText,
    });

    let cardY = cardTop - 36;
    cardY = drawWrappedText(
      page2,
      safeText(trait.summary, 220),
      SIDE_MARGIN + 12,
      cardY,
      PAGE_WIDTH - SIDE_MARGIN * 2 - 24,
      font,
      9,
      theme.body,
      3,
      2,
    );
    cardY = drawWrappedText(
      page2,
      `Value focus: ${safeText(trait.leverage, 170)}`,
      SIDE_MARGIN + 12,
      cardY,
      PAGE_WIDTH - SIDE_MARGIN * 2 - 24,
      font,
      9,
      theme.body,
      3,
      2,
    );
    drawWrappedText(
      page2,
      `Development edge: ${safeText(trait.developmentFocus, 170)}`,
      SIDE_MARGIN + 12,
      cardY,
      PAGE_WIDTH - SIDE_MARGIN * 2 - 24,
      font,
      9,
      theme.body,
      3,
      2,
    );

    y2 -= cardHeight + 8;
  }

  if (competencyThemes.length > 0 && y2 > 130) {
    drawSectionHeading(page2, "Scenario Behavior Themes", y2, bold);
    y2 -= 20;

    drawBulletList(
      page2,
      competencyThemes.map((themeRow) => `${themeRow.name}: ${themeRow.insight}`),
      SIDE_MARGIN + 2,
      y2,
      PAGE_WIDTH - SIDE_MARGIN * 2,
      font,
      9,
      3,
      2,
    );
  }

  let y3 = 785;
  page3.drawText("Development Plan and Coaching Guide", {
    x: SIDE_MARGIN,
    y: y3,
    size: 19,
    font: bold,
    color: theme.title,
  });

  y3 -= 28;
  drawSectionHeading(page3, "12-Week Action Plan", y3, bold);
  y3 -= 22;

  for (const [index, action] of actions.slice(0, 6).entries()) {
    page3.drawCircle({
      x: SIDE_MARGIN + 7,
      y: y3 + 5,
      size: 7.5,
      color: rgb(0.14, 0.2, 0.27),
    });
    page3.drawText(String(index + 1), {
      x: SIDE_MARGIN + 4.6,
      y: y3 + 2.2,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
    });

    y3 = drawWrappedText(
      page3,
      safeText(action, 320),
      SIDE_MARGIN + 20,
      y3,
      PAGE_WIDTH - SIDE_MARGIN * 2 - 20,
      font,
      10,
      theme.body,
      3,
      3,
    );
    y3 -= 4;
  }

  if (workplaceSignals.length > 0) {
    y3 -= 4;
    drawSectionHeading(page3, "Workplace Signals", y3, bold);
    y3 -= 20;
    y3 = drawBulletList(
      page3,
      workplaceSignals,
      SIDE_MARGIN + 2,
      y3,
      PAGE_WIDTH - SIDE_MARGIN * 2,
      font,
      9,
      3,
      2,
    );
  }

  if (reflectionPrompts.length > 0 && y3 > 180) {
    y3 -= 2;
    drawSectionHeading(page3, "Reflection Prompts", y3, bold);
    y3 -= 20;
    y3 = drawBulletList(
      page3,
      reflectionPrompts,
      SIDE_MARGIN + 2,
      y3,
      PAGE_WIDTH - SIDE_MARGIN * 2,
      font,
      9,
      3,
      2,
    );
  }

  if (managerGuide.length > 0 && y3 > 120) {
    y3 -= 2;
    drawSectionHeading(page3, "Manager Discussion Guide", y3, bold);
    y3 -= 20;
    y3 = drawBulletList(
      page3,
      managerGuide,
      SIDE_MARGIN + 2,
      y3,
      PAGE_WIDTH - SIDE_MARGIN * 2,
      font,
      9,
      3,
      2,
    );
  }

  if (extendedInsight.length > 0 && y3 > 82) {
    y3 -= 2;
    drawSectionHeading(page3, "Extended Context", y3, bold);
    y3 -= 20;
    drawBulletList(
      page3,
      extendedInsight,
      SIDE_MARGIN + 2,
      y3,
      PAGE_WIDTH - SIDE_MARGIN * 2,
      font,
      9,
      2,
      2,
    );
  }

  drawFooter(page1, 1, 3, font);
  drawFooter(page2, 2, 3, font);
  drawFooter(page3, 3, 3, font);

  const bytes = await pdf.save();

  const filename = `report-${session.user.firstName}-${session.user.lastName}-${assessmentId}.pdf`
    .replace(/\s+/g, "-")
    .toLowerCase();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "private, no-store",
    },
  });
}
