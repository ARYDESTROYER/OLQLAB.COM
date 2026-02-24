import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeReportShareToken } from "@/lib/unenroll-jobs";

function asText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function wrap(text: string, maxChars = 95) {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  return lines;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenRow = await consumeReportShareToken(token);

  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }

  const [report, session] = await Promise.all([
    db.report.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: tokenRow.assessmentId,
          userId: tokenRow.userId,
        },
      },
      select: {
        narrativeJson: true,
      },
    }),
    db.quizSession.findUnique({
      where: {
        assessmentId_userId: {
          assessmentId: tokenRow.assessmentId,
          userId: tokenRow.userId,
        },
      },
      select: {
        submittedAt: true,
      },
    }),
  ]);

  const narrative = report ? JSON.parse(report.narrativeJson || "{}") : {};

  const participantName =
    asText((narrative as { participantName?: unknown }).participantName) ||
    `${tokenRow.user.firstName} ${tokenRow.user.lastName}`.trim();
  const assessmentTitle =
    asText((narrative as { assessmentTitle?: unknown }).assessmentTitle) ||
    tokenRow.assessment.title;
  const summary =
    asText((narrative as { summary?: unknown }).summary) ||
    "This report is shared through a temporary secure link.";

  const strengths = Array.isArray((narrative as { strengths?: unknown }).strengths)
    ? ((narrative as { strengths: string[] }).strengths || []).slice(0, 4)
    : [];
  const growthAreas = Array.isArray((narrative as { growthAreas?: unknown }).growthAreas)
    ? ((narrative as { growthAreas: string[] }).growthAreas || []).slice(0, 4)
    : [];

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.98, 0.99, 1) });
  page.drawText("OLQLAB Shared Report", {
    x: 40,
    y: 790,
    size: 12,
    font: bold,
    color: rgb(0.2, 0.26, 0.35),
  });

  page.drawText(assessmentTitle, {
    x: 40,
    y: 755,
    size: 22,
    font: bold,
    color: rgb(0.08, 0.12, 0.2),
  });

  page.drawText(`Participant: ${participantName}`, {
    x: 40,
    y: 726,
    size: 11,
    font,
    color: rgb(0.22, 0.28, 0.36),
  });

  page.drawText(
    `Submitted: ${session?.submittedAt ? new Date(session.submittedAt).toLocaleString() : "Not available"}`,
    {
      x: 40,
      y: 708,
      size: 10,
      font,
      color: rgb(0.35, 0.42, 0.5),
    },
  );

  let cursorY = 675;
  page.drawText("Summary", {
    x: 40,
    y: cursorY,
    size: 14,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });

  cursorY -= 22;
  for (const line of wrap(summary, 92).slice(0, 8)) {
    page.drawText(line, {
      x: 40,
      y: cursorY,
      size: 10.5,
      font,
      color: rgb(0.2, 0.25, 0.33),
    });
    cursorY -= 15;
  }

  cursorY -= 8;
  page.drawText("Strength Signals", {
    x: 40,
    y: cursorY,
    size: 13,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });
  cursorY -= 20;

  const renderedStrengths = strengths.length > 0 ? strengths : ["No strengths narrative available."];
  for (const item of renderedStrengths) {
    for (const line of wrap(`• ${item}`, 92).slice(0, 3)) {
      page.drawText(line, {
        x: 44,
        y: cursorY,
        size: 10,
        font,
        color: rgb(0.2, 0.25, 0.33),
      });
      cursorY -= 14;
    }
    cursorY -= 4;
  }

  cursorY -= 6;
  page.drawText("Growth Priorities", {
    x: 40,
    y: cursorY,
    size: 13,
    font: bold,
    color: rgb(0.1, 0.15, 0.25),
  });
  cursorY -= 20;

  const renderedGrowth = growthAreas.length > 0 ? growthAreas : ["No growth narrative available."];
  for (const item of renderedGrowth) {
    for (const line of wrap(`• ${item}`, 92).slice(0, 3)) {
      page.drawText(line, {
        x: 44,
        y: cursorY,
        size: 10,
        font,
        color: rgb(0.2, 0.25, 0.33),
      });
      cursorY -= 14;
    }
    cursorY -= 4;
  }

  page.drawText("Delivered via secure temporary link", {
    x: 40,
    y: 30,
    size: 8,
    font,
    color: rgb(0.45, 0.51, 0.58),
  });

  const bytes = await pdf.save();

  const filename = `shared-report-${tokenRow.user.firstName}-${tokenRow.user.lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}.pdf\"`,
      "Cache-Control": "no-store",
    },
  });
}
