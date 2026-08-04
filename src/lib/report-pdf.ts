import "regenerator-runtime/runtime";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const BODY_SIZE = 10.5;
const LINE_HEIGHT = 16;
export const MAX_REPORT_PDF_TEXT_CHARACTERS = 100_000;
export const MAX_REPORT_PDF_PAGES = 50;

export class ReportPdfInputLimitError extends Error {
  constructor(message = "Report content exceeds the PDF rendering limit.") {
    super(message);
    this.name = "ReportPdfInputLimitError";
  }
}

export function isReportPdfInputLimitError(
  error: unknown,
): error is ReportPdfInputLimitError {
  return error instanceof ReportPdfInputLimitError;
}

export function normalizePdfText(input: string) {
  return Array.from(input.normalize("NFC"), (character) => {
    const codePoint = character.codePointAt(0) || 0;
    if (codePoint === 0xfe0f || codePoint === 0x200d) return "";
    if (/\p{Extended_Pictographic}/u.test(character)) return "□";
    const supported =
      codePoint === 0x0a ||
      codePoint === 0x09 ||
      (codePoint >= 0x20 && codePoint <= 0x024f) ||
      (codePoint >= 0x0900 && codePoint <= 0x097f) ||
      (codePoint >= 0x2000 && codePoint <= 0x206f) ||
      codePoint === 0x20b9;
    return supported ? character : "□";
  }).join("");
}

function isDevanagari(input: string) {
  return /[\u0900-\u097f]/.test(input);
}

function splitFontRuns(input: string) {
  const runs: Array<{ text: string; devanagari: boolean }> = [];
  for (const character of Array.from(input)) {
    const devanagari = isDevanagari(character);
    const previous = runs.at(-1);
    if (previous && previous.devanagari === devanagari) previous.text += character;
    else runs.push({ text: character, devanagari });
  }
  return runs;
}

function lineWidth(input: string, size: number, latin: PDFFont, devanagari: PDFFont) {
  return splitFontRuns(input).reduce(
    (width, run) =>
      width + (run.devanagari ? devanagari : latin).widthOfTextAtSize(run.text, size),
    0,
  );
}

function wrapLine(input: string, maxWidth: number, latin: PDFFont, devanagari: PDFFont) {
  if (!input.trim()) return [""];
  const words = input.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (lineWidth(candidate, BODY_SIZE, latin, devanagari) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (lineWidth(word, BODY_SIZE, latin, devanagari) <= maxWidth) {
      current = word;
      continue;
    }
    let fragment = "";
    let fragmentWidth = 0;
    for (const character of Array.from(word)) {
      const characterWidth = lineWidth(
        character,
        BODY_SIZE,
        latin,
        devanagari,
      );
      if (fragment && fragmentWidth + characterWidth > maxWidth) {
        lines.push(fragment);
        fragment = character;
        fragmentWidth = characterWidth;
      } else {
        fragment += character;
        fragmentWidth += characterWidth;
      }
    }
    current = fragment;
  }
  if (current) lines.push(current);
  return lines;
}

function drawRuns(
  page: PDFPage,
  input: string,
  options: { x: number; y: number; size: number; latin: PDFFont; devanagari: PDFFont },
) {
  let x = options.x;
  for (const run of splitFontRuns(input)) {
    const font = run.devanagari ? options.devanagari : options.latin;
    page.drawText(run.text, {
      x,
      y: options.y,
      size: options.size,
      font,
      color: rgb(0.1, 0.13, 0.18),
    });
    x += font.widthOfTextAtSize(run.text, options.size);
  }
}

export async function renderCanonicalReportPdf(input: {
  assessmentTitle: string;
  participantName: string;
  submittedAt?: Date | string | null;
  canonicalText: string;
}) {
  const boundedTextLength =
    input.assessmentTitle.length +
    input.participantName.length +
    input.canonicalText.length;
  if (boundedTextLength > MAX_REPORT_PDF_TEXT_CHARACTERS) {
    throw new ReportPdfInputLimitError();
  }

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [latinBytes, devanagariBytes] = await Promise.all([
    readFile(
      path.join(
        process.cwd(),
        "node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff",
      ),
    ),
    readFile(
      path.join(
        process.cwd(),
        "node_modules/@fontsource/noto-sans/files/noto-sans-devanagari-400-normal.woff",
      ),
    ),
  ]);
  const [latin, devanagari] = await Promise.all([
    pdf.embedFont(latinBytes, { subset: true }),
    pdf.embedFont(devanagariBytes, { subset: true }),
  ]);

  pdf.setTitle(`${input.assessmentTitle} — OLQ Lab report`);
  pdf.setAuthor("OLQ Lab");
  pdf.setSubject("Leadership development report");
  pdf.setCreator("OLQ Lab");

  const title = normalizePdfText(input.assessmentTitle || "Leadership Development Report");
  const participant = normalizePdfText(input.participantName || "Participant");
  const dateValue = input.submittedAt ? new Date(input.submittedAt) : null;
  const completedAt =
    dateValue && !Number.isNaN(dateValue.getTime())
      ? `${dateValue.toISOString().replace("T", " ").slice(0, 16)} UTC`
      : "";
  const paragraphs = normalizePdfText(input.canonicalText)
    .split(/\n+/)
    .map((line) => line.trim());

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  let pageNumber = 1;

  const decoratePage = () => {
    page.drawText("OLQ LAB", {
      x: MARGIN,
      y: PAGE_HEIGHT - 34,
      size: 9,
      font: latin,
      color: rgb(0.08, 0.35, 0.38),
    });
    page.drawText(`Leadership development report  •  ${pageNumber}`, {
      x: MARGIN,
      y: 28,
      size: 7.5,
      font: latin,
      color: rgb(0.4, 0.45, 0.5),
    });
  };
  const nextPage = () => {
    if (pageNumber >= MAX_REPORT_PDF_PAGES) {
      throw new ReportPdfInputLimitError(
        `Report content exceeds the ${MAX_REPORT_PDF_PAGES}-page PDF limit.`,
      );
    }
    decoratePage();
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensureSpace = (height: number) => {
    if (y - height < MARGIN) nextPage();
  };

  ensureSpace(90);
  drawRuns(page, "OLQ Lab Leadership Development Report", {
    x: MARGIN,
    y,
    size: 18,
    latin,
    devanagari,
  });
  y -= 28;
  for (const line of wrapLine(title, PAGE_WIDTH - MARGIN * 2, latin, devanagari)) {
    ensureSpace(21);
    drawRuns(page, line, { x: MARGIN, y, size: 14, latin, devanagari });
    y -= 21;
  }
  drawRuns(page, `Participant: ${participant}`, { x: MARGIN, y, size: 10, latin, devanagari });
  y -= 17;
  if (completedAt) {
    drawRuns(page, `Assessment completed: ${completedAt}`, {
      x: MARGIN,
      y,
      size: 9,
      latin,
      devanagari,
    });
    y -= 24;
  }
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.8,
    color: rgb(0.75, 0.8, 0.82),
  });
  y -= 24;

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      y -= 7;
      continue;
    }
    const lines = wrapLine(paragraph, PAGE_WIDTH - MARGIN * 2, latin, devanagari);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      drawRuns(page, line, { x: MARGIN, y, size: BODY_SIZE, latin, devanagari });
      y -= LINE_HEIGHT;
    }
    y -= 7;
  }
  decoratePage();
  return pdf.save();
}
