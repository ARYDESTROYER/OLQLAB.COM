import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import {
  parseAssessmentQuestionCsv,
  type CsvIssue,
} from "@/lib/assessment-question-csv";
import {
  applyAssessmentQuestionRows,
  findExistingQuestionCodeConflicts,
  type QuestionImportMode,
} from "@/lib/assessment-csv-import-persist";
import {
  assessmentHasAttemptHistory,
  lockAssessmentContent,
} from "@/lib/assessment-content-lock";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

function parseMode(raw: FormDataEntryValue | null): QuestionImportMode {
  if (typeof raw !== "string") return "REPLACE_ALL";
  return raw.trim().toUpperCase() === "APPEND" ? "APPEND" : "REPLACE_ALL";
}

function parseBoolean(input: FormDataEntryValue | null, fallback: boolean) {
  if (typeof input !== "string") return fallback;
  const normalized = input.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function fileSizeIssues(extra: CsvIssue[] = []): CsvIssue[] {
  return [
    {
      row: 1,
      column: "file",
      code: "FILE_LIMIT",
      message: `CSV file exceeds ${MAX_CSV_BYTES / (1024 * 1024)}MB limit.`,
    },
    ...extra,
  ];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId } = await params;

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, title: true },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid multipart payload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
  }

  if (file.size > MAX_CSV_BYTES) {
    return NextResponse.json(
      {
        error: "CSV file is too large.",
        issues: fileSizeIssues(),
      },
      { status: 400 },
    );
  }

  const mode = parseMode(formData.get("mode"));
  const dryRun =
    req.nextUrl.searchParams.get("dryRun") === "1" || parseBoolean(formData.get("dryRun"), false);

  const csvText = await file.text();
  const parsed = parseAssessmentQuestionCsv(csvText, { maxRows: 1000 });
  let issues = [...parsed.issues];

  if (issues.length === 0 && mode === "APPEND") {
    const conflictIssues = await db.$transaction((tx) =>
      findExistingQuestionCodeConflicts(tx, assessmentId, parsed.rows),
    );
    issues = [...issues, ...conflictIssues];
  }

  if (issues.length > 0) {
    return NextResponse.json(
      {
        error: "CSV validation failed.",
        issues,
        summary: parsed.summary,
      },
      { status: 400 },
    );
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      mode,
      summary: parsed.summary,
      preview: {
        firstQuestions: parsed.rows.slice(0, 5).map((row) => ({
          code: row.questionCode,
          prompt: row.prompt,
          type: row.questionType,
          section: row.sectionTitle,
        })),
      },
    });
  }

  const importOutcome = await db.$transaction(async (tx) => {
    await lockAssessmentContent(tx, assessmentId);
    if (await assessmentHasAttemptHistory(tx, assessmentId)) {
      return { conflict: true as const };
    }

    const importResult = await applyAssessmentQuestionRows(
      tx,
      assessmentId,
      parsed.rows,
      mode,
    );
    await recordAuditLog(
      {
        tenantId: check.liveUser.tenantId,
        actorId: check.liveUser.id,
        action: "ASSESSMENT_QUESTIONS_IMPORTED",
        metadata: {
          assessmentId,
          mode,
          rowCount: parsed.rows.length,
          importResult,
        },
      },
      tx,
    );
    return { conflict: false as const, importResult };
  });

  if (importOutcome.conflict) {
    return NextResponse.json(
      {
        error:
          "This assessment already has attempt history. Clone it before importing questions so historical responses remain interpretable.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    assessment: {
      id: assessment.id,
      title: assessment.title,
    },
    mode,
    summary: parsed.summary,
    importResult: importOutcome.importResult,
  });
}
