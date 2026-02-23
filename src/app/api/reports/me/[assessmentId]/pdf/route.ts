import { addHours } from "date-fns";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

function safeText(input: string, max = 1000) {
  return (input || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color = rgb(0.1, 0.1, 0.1),
) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= size + 4;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= size + 4;
  }
  return cursorY;
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

  const narrative = JSON.parse(report.narrativeJson || "{}") as {
    summary?: string;
    strengths?: string[];
    growthAreas?: string[];
    actions?: string[];
    competencyBreakdown?: Array<{ code: string; name: string; score: number }>;
    aiNarrative?: {
      executiveSummary?: string;
      strengthsNarrative?: string;
      developmentNarrative?: string;
      managerCoaching?: string;
      improvementRoadmap?: string[];
      cautionNotes?: string[];
    };
  };

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 805;

  page.drawRectangle({
    x: 30,
    y: 760,
    width: 535,
    height: 60,
    color: rgb(0.97, 0.92, 0.82),
  });

  page.drawText("Personality Development Report", {
    x: 42,
    y: 796,
    size: 20,
    font: bold,
    color: rgb(0.1, 0.15, 0.2),
  });
  page.drawText(safeText(session.assessment.title, 70), {
    x: 42,
    y: 776,
    size: 11,
    font,
    color: rgb(0.2, 0.25, 0.35),
  });

  y = 742;
  const personLine = `${session.user.firstName} ${session.user.lastName}  |  ${session.user.email}`;
  page.drawText(safeText(personLine, 120), {
    x: 40,
    y,
    size: 10,
    font,
    color: rgb(0.2, 0.25, 0.3),
  });
  y -= 22;

  page.drawText("Trait Profile", {
    x: 40,
    y,
    size: 13,
    font: bold,
  });
  y -= 18;

  const traits: Array<{ label: string; value: number }> = [
    { label: "Openness", value: Number(score.openness || 0) },
    { label: "Conscientiousness", value: Number(score.conscientiousness || 0) },
    { label: "Extraversion", value: Number(score.extraversion || 0) },
    { label: "Agreeableness", value: Number(score.agreeableness || 0) },
    { label: "Neuroticism", value: Number(score.neuroticism || 0) },
  ];

  for (const trait of traits) {
    page.drawText(trait.label, { x: 40, y, size: 10, font });
    page.drawRectangle({ x: 155, y: y - 2, width: 270, height: 8, color: rgb(0.92, 0.94, 0.97) });
    page.drawRectangle({
      x: 155,
      y: y - 2,
      width: Math.max(0, Math.min(270, (trait.value / 100) * 270)),
      height: 8,
      color: rgb(0.1, 0.28, 0.45),
    });
    page.drawText(`${trait.value}/100`, { x: 435, y: y - 1, size: 9, font });
    y -= 16;
  }

  y -= 6;
  if (narrative.summary) {
    page.drawText("Summary", { x: 40, y, size: 13, font: bold });
    y -= 16;
    y = drawWrappedText(page, safeText(narrative.summary, 520), 40, y, 515, font, 10);
    y -= 6;
  }

  const competencyRows = (
    narrative.competencyBreakdown ||
    ((score.competencyJson as Array<{ code: string; name: string; score: number }> | null) || [])
  ).slice(0, 8);

  if (competencyRows.length > 0) {
    page.drawText("Competency Indicators", { x: 40, y, size: 13, font: bold });
    y -= 16;

    for (const competency of competencyRows) {
      const rowText = `${competency.name}: ${competency.score >= 0 ? "+" : ""}${competency.score}`;
      page.drawText(safeText(rowText, 80), { x: 40, y, size: 10, font });
      y -= 14;
      if (y < 120) break;
    }
    y -= 6;
  }

  const listBlock = (title: string, items: string[] | undefined) => {
    if (!items || items.length === 0) return;
    page.drawText(title, { x: 40, y, size: 12, font: bold });
    y -= 14;
    for (const item of items.slice(0, 5)) {
      y = drawWrappedText(page, `- ${safeText(item, 240)}`, 44, y, 510, font, 10);
      if (y < 105) break;
    }
    y -= 5;
  };

  listBlock("Strengths", narrative.strengths);
  listBlock("Development Areas", narrative.growthAreas);
  listBlock("Action Plan", narrative.actions);

  if (y < 180) {
    y = 180;
  }

  if (narrative.aiNarrative) {
    page.drawText("AI-Assisted Development Insights", { x: 40, y, size: 13, font: bold });
    y -= 16;
    if (narrative.aiNarrative.executiveSummary) {
      y = drawWrappedText(
        page,
        safeText(narrative.aiNarrative.executiveSummary, 400),
        40,
        y,
        510,
        font,
        10,
      );
      y -= 4;
    }
    if (narrative.aiNarrative.managerCoaching) {
      y = drawWrappedText(
        page,
        `Manager guidance: ${safeText(narrative.aiNarrative.managerCoaching, 300)}`,
        40,
        y,
        510,
        font,
        10,
      );
    }
  }

  page.drawText("Generated for developmental use only. Not intended for clinical diagnosis.", {
    x: 40,
    y: 24,
    size: 8,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

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
