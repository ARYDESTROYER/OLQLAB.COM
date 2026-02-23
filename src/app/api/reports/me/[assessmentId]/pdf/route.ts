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

type CompetencyTheme = {
  code: string;
  name: string;
  category: "strength" | "focus";
  insight: string;
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
  competencyThemes?: CompetencyTheme[];
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
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const palette = {
  navy: rgb(0.09, 0.13, 0.2),
  slate: rgb(0.23, 0.28, 0.35),
  muted: rgb(0.44, 0.49, 0.57),
  border: rgb(0.86, 0.9, 0.94),
  card: rgb(1, 1, 1),
  tintA: rgb(0.93, 0.98, 1),
  tintB: rgb(1, 0.96, 0.9),
  tintC: rgb(0.93, 0.98, 0.95),
  strength: rgb(0.88, 0.96, 0.91),
  focus: rgb(1, 0.94, 0.84),
};

function safeText(input: string | undefined, max = 900) {
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

function wrapLines(text: string, maxWidth: number, font: PDFFont, size: number) {
  const words = safeText(text, 5000).split(" ").filter(Boolean);
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
  color = palette.slate,
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
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= size + lineGap;
  }
  return cursorY;
}

function drawBackground(page: PDFPage, variant: 1 | 2 | 3 | 4) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(0.988, 0.992, 0.997),
  });

  if (variant === 1) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 210, width: PAGE_WIDTH, height: 210, color: palette.tintA });
    page.drawEllipse({ x: 500, y: 792, xScale: 92, yScale: 58, color: palette.tintB, opacity: 0.7 });
    return;
  }

  if (variant === 2) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 145, width: PAGE_WIDTH, height: 145, color: palette.tintB });
    page.drawEllipse({ x: 96, y: 94, xScale: 70, yScale: 44, color: palette.tintA, opacity: 0.65 });
    return;
  }

  if (variant === 3) {
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 145, width: PAGE_WIDTH, height: 145, color: palette.tintC });
    page.drawEllipse({ x: 515, y: 106, xScale: 78, yScale: 48, color: palette.tintA, opacity: 0.6 });
    return;
  }

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 165, width: PAGE_WIDTH, height: 165, color: palette.tintA });
  page.drawEllipse({ x: 470, y: 785, xScale: 74, yScale: 42, color: palette.tintB, opacity: 0.7 });
}

function drawFooter(page: PDFPage, pageNumber: number, totalPages: number, font: PDFFont) {
  page.drawLine({
    start: { x: MARGIN, y: 34 },
    end: { x: PAGE_WIDTH - MARGIN, y: 34 },
    thickness: 1,
    color: rgb(0.89, 0.92, 0.95),
  });

  page.drawText("OLQLAB report for workplace development use.", {
    x: MARGIN,
    y: 21,
    size: 8,
    font,
    color: palette.muted,
  });

  page.drawText(`Page ${pageNumber} of ${totalPages}`, {
    x: PAGE_WIDTH - MARGIN - 58,
    y: 21,
    size: 8,
    font,
    color: palette.muted,
  });
}

function drawSectionTitle(page: PDFPage, title: string, y: number, bold: PDFFont) {
  page.drawText(title, {
    x: MARGIN,
    y,
    size: 15,
    font: bold,
    color: palette.navy,
  });

  page.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: 178,
    height: 2,
    color: rgb(0.73, 0.8, 0.89),
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
  maxItems = 5,
  maxLinesPerItem = 3,
) {
  let cursor = y;
  for (const item of items.slice(0, maxItems)) {
    page.drawCircle({
      x,
      y: cursor + size / 2 - 1,
      size: 1.8,
      color: palette.slate,
    });

    cursor = drawWrappedText(
      page,
      safeText(item, 360),
      x + 8,
      cursor,
      maxWidth - 8,
      font,
      size,
      palette.slate,
      3,
      maxLinesPerItem,
    );
    cursor -= 4;
  }
  return cursor;
}

function drawTraitSignalBar(
  page: PDFPage,
  label: string,
  signal: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
  bandLabel: string,
) {
  const barX = MARGIN + 136;
  const barWidth = CONTENT_WIDTH - 146;
  const segment = barWidth / 3;

  page.drawText(label, {
    x: MARGIN,
    y: y + 1,
    size: 10,
    font: bold,
    color: palette.navy,
  });

  page.drawRectangle({ x: barX, y, width: segment, height: 10, color: rgb(0.84, 0.93, 1) });
  page.drawRectangle({ x: barX + segment, y, width: segment, height: 10, color: rgb(1, 0.92, 0.78) });
  page.drawRectangle({ x: barX + segment * 2, y, width: segment, height: 10, color: rgb(0.8, 0.93, 0.82) });

  const clamped = Math.max(0, Math.min(100, signal));
  const markerX = barX + (barWidth * clamped) / 100;
  page.drawCircle({
    x: markerX,
    y: y + 5,
    size: 4.1,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.16, 0.21, 0.28),
    borderWidth: 1.3,
  });

  page.drawText(bandLabel, {
    x: barX + barWidth + 8,
    y: y + 1,
    size: 8,
    font,
    color: palette.muted,
  });
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

  const participantName =
    safeText(narrative.participantName, 80) ||
    safeText(`${session.user.firstName} ${session.user.lastName}`, 80);
  const firstName = participantName.split(" ")[0] || "Participant";

  const assessmentTitle =
    safeText(narrative.assessmentTitle, 100) || safeText(session.assessment.title, 100);
  const takenAt = formatTakenAt(narrative.assessmentTakenAt || session.submittedAt?.toISOString());

  const summary =
    safeText(narrative.summary, 1100) ||
    "This report combines personality tendencies and scenario behavior patterns to guide practical development decisions.";

  const strengths =
    narrative.strengths?.length
      ? narrative.strengths
      : ["No strengths narrative available yet. Please regenerate report."];
  const growthAreas =
    narrative.growthAreas?.length
      ? narrative.growthAreas
      : ["No development narrative available yet. Please regenerate report."];
  const actions =
    narrative.actions?.length
      ? narrative.actions
      : ["Choose one strength and one growth behavior to practice each week."];

  const workplaceSignals = narrative.workplaceSignals || [];
  const reflectionPrompts = narrative.reflectionPrompts || [];
  const managerGuide = narrative.managerDiscussionGuide || [];
  const competencyThemes = narrative.competencyThemes || [];

  const extendedInsights = [
    narrative.aiNarrative?.executiveSummary,
    narrative.aiNarrative?.strengthsNarrative,
    narrative.aiNarrative?.developmentNarrative,
    narrative.aiNarrative?.managerCoaching,
  ].filter((item): item is string => Boolean(item));

  const roadmap = narrative.aiNarrative?.improvementRoadmap || [];
  const cautionNotes = narrative.aiNarrative?.cautionNotes || [];

  const traitSignals: Array<{ label: string; value: number; bandLabel: string }> = [
    { label: "Openness", value: Number(score.openness || 0), bandLabel: toBand(Number(score.openness || 0)) },
    {
      label: "Conscientiousness",
      value: Number(score.conscientiousness || 0),
      bandLabel: toBand(Number(score.conscientiousness || 0)),
    },
    { label: "Extraversion", value: Number(score.extraversion || 0), bandLabel: toBand(Number(score.extraversion || 0)) },
    { label: "Agreeableness", value: Number(score.agreeableness || 0), bandLabel: toBand(Number(score.agreeableness || 0)) },
    {
      label: "Emotional Reactivity",
      value: Number(score.neuroticism || 0),
      bandLabel: toBand(Number(score.neuroticism || 0)),
    },
  ].map((item) => ({
    ...item,
    bandLabel:
      item.bandLabel === "high"
        ? "Strong signal"
        : item.bandLabel === "moderate"
          ? "Balanced signal"
          : "Emerging signal",
  }));

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const hasExtendedPage = extendedInsights.length > 0 || roadmap.length > 0 || cautionNotes.length > 0;
  const totalPages = hasExtendedPage ? 4 : 3;

  const page1 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const page2 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const page3 = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const page4 = hasExtendedPage ? pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]) : null;

  drawBackground(page1, 1);
  drawBackground(page2, 2);
  drawBackground(page3, 3);
  if (page4) drawBackground(page4, 4);

  // Page 1: Personalized cover + trait bars
  page1.drawRectangle({
    x: MARGIN,
    y: 700,
    width: CONTENT_WIDTH,
    height: 120,
    color: palette.card,
    borderColor: palette.border,
    borderWidth: 1,
  });

  page1.drawText("OLQLAB Development Report", {
    x: MARGIN + 16,
    y: 790,
    size: 23,
    font: bold,
    color: palette.navy,
  });
  page1.drawText(assessmentTitle, {
    x: MARGIN + 16,
    y: 770,
    size: 11,
    font,
    color: palette.slate,
  });

  page1.drawText(`Prepared for ${participantName}`, {
    x: MARGIN + 16,
    y: 748,
    size: 11,
    font,
    color: palette.slate,
  });
  page1.drawText(`Test Taken: ${takenAt}`, {
    x: MARGIN + 16,
    y: 731,
    size: 11,
    font,
    color: palette.slate,
  });

  page1.drawRectangle({
    x: MARGIN,
    y: 610,
    width: CONTENT_WIDTH,
    height: 76,
    color: rgb(1, 1, 1),
    borderColor: palette.border,
    borderWidth: 1,
  });

  drawWrappedText(
    page1,
    `${firstName}, ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`,
    MARGIN + 14,
    666,
    CONTENT_WIDTH - 28,
    font,
    10,
    palette.slate,
    4,
    4,
  );

  drawSectionTitle(page1, "Trait Signal Map", 582, bold);
  page1.drawText("Visual indicators only. No numeric score display.", {
    x: MARGIN,
    y: 564,
    size: 9,
    font,
    color: palette.muted,
  });

  let traitY = 535;
  for (const trait of traitSignals) {
    drawTraitSignalBar(page1, trait.label, trait.value, traitY, font, bold, trait.bandLabel);
    traitY -= 30;
  }

  page1.drawText("Emerging", { x: MARGIN + 136, y: 382, size: 8, font, color: palette.muted });
  page1.drawText("Balanced", { x: MARGIN + 136 + (CONTENT_WIDTH - 146) / 2 - 20, y: 382, size: 8, font, color: palette.muted });
  page1.drawText("Strong", { x: MARGIN + CONTENT_WIDTH - 40, y: 382, size: 8, font, color: palette.muted });

  drawSectionTitle(page1, "Profile Focus", 348, bold);
  drawWrappedText(
    page1,
    safeText(narrative.profileHeadline, 80) || "Adaptive Contributor",
    MARGIN,
    330,
    CONTENT_WIDTH,
    bold,
    12,
    palette.navy,
    4,
    2,
  );

  drawWrappedText(
    page1,
    "Use your strongest signals intentionally in visible work, and pair that with one deliberate growth behavior to increase consistency under pressure.",
    MARGIN,
    300,
    CONTENT_WIDTH,
    font,
    10,
    palette.slate,
    3,
    4,
  );

  // Page 2: Strengths + development + scenario themes
  page2.drawText("Strengths and Development Insights", {
    x: MARGIN,
    y: 784,
    size: 20,
    font: bold,
    color: palette.navy,
  });

  page2.drawRectangle({ x: MARGIN, y: 444, width: CONTENT_WIDTH / 2 - 8, height: 316, color: palette.card, borderColor: palette.border, borderWidth: 1 });
  page2.drawRectangle({ x: MARGIN + CONTENT_WIDTH / 2 + 8, y: 444, width: CONTENT_WIDTH / 2 - 8, height: 316, color: palette.card, borderColor: palette.border, borderWidth: 1 });

  page2.drawRectangle({ x: MARGIN + 12, y: 730, width: 98, height: 16, color: palette.strength });
  page2.drawText("Strengths", { x: MARGIN + 18, y: 735, size: 9, font: bold, color: palette.navy });

  page2.drawRectangle({ x: MARGIN + CONTENT_WIDTH / 2 + 20, y: 730, width: 128, height: 16, color: palette.focus });
  page2.drawText("Development Areas", { x: MARGIN + CONTENT_WIDTH / 2 + 26, y: 735, size: 9, font: bold, color: palette.navy });

  drawBulletList(
    page2,
    strengths,
    MARGIN + 16,
    708,
    CONTENT_WIDTH / 2 - 30,
    font,
    10,
    5,
    3,
  );

  drawBulletList(
    page2,
    growthAreas,
    MARGIN + CONTENT_WIDTH / 2 + 22,
    708,
    CONTENT_WIDTH / 2 - 30,
    font,
    10,
    5,
    3,
  );

  drawSectionTitle(page2, "Scenario Themes", 416, bold);

  const visibleThemes = competencyThemes.slice(0, 4);
  let themeY = 390;
  for (const theme of visibleThemes) {
    const color = theme.category === "strength" ? palette.strength : palette.focus;

    page2.drawRectangle({
      x: MARGIN,
      y: themeY - 68,
      width: CONTENT_WIDTH,
      height: 62,
      color: palette.card,
      borderColor: palette.border,
      borderWidth: 1,
    });

    page2.drawRectangle({ x: MARGIN + 10, y: themeY - 26, width: 72, height: 14, color });
    page2.drawText(theme.category === "strength" ? "Strength" : "Focus", {
      x: MARGIN + 15,
      y: themeY - 21,
      size: 8,
      font: bold,
      color: palette.navy,
    });

    page2.drawText(theme.name, {
      x: MARGIN + 92,
      y: themeY - 20,
      size: 10,
      font: bold,
      color: palette.navy,
    });

    drawWrappedText(
      page2,
      safeText(theme.insight, 260),
      MARGIN + 10,
      themeY - 39,
      CONTENT_WIDTH - 20,
      font,
      9,
      palette.slate,
      3,
      2,
    );

    themeY -= 74;
  }

  // Page 3: Action plan and coaching cues
  page3.drawText("Action Plan and Coaching Cues", {
    x: MARGIN,
    y: 784,
    size: 20,
    font: bold,
    color: palette.navy,
  });

  drawSectionTitle(page3, "Action Plan", 752, bold);
  let y3 = drawBulletList(
    page3,
    actions,
    MARGIN + 2,
    730,
    CONTENT_WIDTH,
    font,
    10,
    8,
    2,
  );

  y3 -= 2;
  drawSectionTitle(page3, "Workplace Signals", y3, bold);
  y3 = drawBulletList(
    page3,
    workplaceSignals,
    MARGIN + 2,
    y3 - 22,
    CONTENT_WIDTH,
    font,
    9,
    4,
    2,
  );

  if (reflectionPrompts.length > 0 && y3 > 196) {
    y3 -= 2;
    drawSectionTitle(page3, "Reflection Prompts", y3, bold);
    y3 = drawBulletList(
      page3,
      reflectionPrompts,
      MARGIN + 2,
      y3 - 22,
      CONTENT_WIDTH,
      font,
      9,
      3,
      2,
    );
  }

  if (managerGuide.length > 0 && y3 > 112) {
    y3 -= 2;
    drawSectionTitle(page3, "Manager Conversation Guide", y3, bold);
    drawBulletList(
      page3,
      managerGuide,
      MARGIN + 2,
      y3 - 22,
      CONTENT_WIDTH,
      font,
      9,
      3,
      2,
    );
  }

  // Page 4: Extended insights
  if (page4) {
    page4.drawText("Extended Insights", {
      x: MARGIN,
      y: 784,
      size: 21,
      font: bold,
      color: palette.navy,
    });

    let y4 = 748;

    for (const insight of extendedInsights.slice(0, 4)) {
      page4.drawRectangle({
        x: MARGIN,
        y: y4 - 98,
        width: CONTENT_WIDTH,
        height: 90,
        color: palette.card,
        borderColor: palette.border,
        borderWidth: 1,
      });

      y4 = drawWrappedText(
        page4,
        safeText(insight, 500),
        MARGIN + 12,
        y4 - 22,
        CONTENT_WIDTH - 24,
        font,
        10,
        palette.slate,
        4,
        5,
      );

      y4 -= 22;
    }

    if (roadmap.length > 0 && y4 > 220) {
      drawSectionTitle(page4, "Roadmap", y4, bold);
      y4 = drawBulletList(
        page4,
        roadmap,
        MARGIN + 2,
        y4 - 22,
        CONTENT_WIDTH,
        font,
        10,
        5,
        2,
      );
    }

    if (cautionNotes.length > 0 && y4 > 130) {
      drawSectionTitle(page4, "Interpretation Notes", y4, bold);
      drawBulletList(
        page4,
        cautionNotes,
        MARGIN + 2,
        y4 - 22,
        CONTENT_WIDTH,
        font,
        9,
        4,
        2,
      );
    }
  }

  drawFooter(page1, 1, totalPages, font);
  drawFooter(page2, 2, totalPages, font);
  drawFooter(page3, 3, totalPages, font);
  if (page4) drawFooter(page4, 4, totalPages, font);

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
