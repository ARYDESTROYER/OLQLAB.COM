import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";
import {
  parseAssessmentQuestionCsv,
  type CsvIssue,
} from "@/lib/assessment-question-csv";
import { applyAssessmentQuestionRows } from "@/lib/assessment-csv-import-persist";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const validWorkflows = new Set(["AI_STANDARD", "MANUAL_PDF_UPLOAD"] as const);

function parseBoolean(input: FormDataEntryValue | null, fallback: boolean) {
  if (typeof input !== "string") return fallback;
  const normalized = input.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function parseInteger(input: FormDataEntryValue | null, fallback: number) {
  if (typeof input !== "string") return fallback;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function parseAdminIds(input: FormData) {
  const raw = [input.get("submissionAlertAdminIds"), ...input.getAll("submissionAlertAdminIds[]")]
    .filter((item): item is string => typeof item === "string")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(raw));
}

function withFileSizeIssue(issue: CsvIssue[]): CsvIssue[] {
  return [
    {
      row: 1,
      column: "file",
      code: "FILE_LIMIT",
      message: `CSV file exceeds ${MAX_CSV_BYTES / (1024 * 1024)}MB limit.`,
    },
    ...issue,
  ];
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid multipart payload." }, { status: 400 });
  }

  const titleInput = formData.get("title");
  const title = typeof titleInput === "string" ? titleInput.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
  }

  if (file.size > MAX_CSV_BYTES) {
    return NextResponse.json(
      {
        error: "CSV file is too large.",
        issues: withFileSizeIssue([]),
      },
      { status: 400 },
    );
  }

  const csvText = await file.text();
  const parsed = parseAssessmentQuestionCsv(csvText, { maxRows: 1000 });
  if (parsed.issues.length > 0) {
    return NextResponse.json(
      {
        error: "CSV validation failed.",
        issues: parsed.issues,
        summary: parsed.summary,
      },
      { status: 400 },
    );
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1" ||
    parseBoolean(formData.get("dryRun"), false);

  const ownerTenantIdRaw = formData.get("ownerTenantId");
  const ownerTenantId = typeof ownerTenantIdRaw === "string" ? ownerTenantIdRaw.trim() || null : null;

  if (ownerTenantId) {
    const tenant = await db.tenant.findUnique({ where: { id: ownerTenantId }, select: { id: true } });
    if (!tenant) {
      return NextResponse.json({ error: "ownerTenantId references an unknown tenant." }, { status: 404 });
    }
  }

  const requestedWorkflowRaw = formData.get("reportWorkflow");
  const requestedWorkflow =
    typeof requestedWorkflowRaw === "string" && validWorkflows.has(requestedWorkflowRaw as "AI_STANDARD" | "MANUAL_PDF_UPLOAD")
      ? (requestedWorkflowRaw as "AI_STANDARD" | "MANUAL_PDF_UPLOAD")
      : "AI_STANDARD";

  const requestedAlertAdminIds = parseAdminIds(formData);
  const validAlertAdminIds = requestedAlertAdminIds.length
    ? (
        await db.user.findMany({
          where: {
            id: { in: requestedAlertAdminIds },
            role: "ADMIN",
          },
          select: { id: true },
        })
      ).map((row) => row.id)
    : [];

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
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

  const postSubmitMessageInput = formData.get("postSubmitMessage");
  const postSubmitMessage =
    typeof postSubmitMessageInput === "string" && postSubmitMessageInput.trim()
      ? postSubmitMessageInput.trim()
      : "Thanks for completing your assessment.";

  try {
    const created = await db.$transaction(async (tx) => {
      const assessment = await tx.assessment.create({
        data: {
          title,
          ownerTenantId,
          tenantId: ownerTenantId,
          policy: {
            create: {
              showResultsToEmployee: parseBoolean(formData.get("showResultsToEmployee"), true),
              resultReleaseDelayHours: parseInteger(formData.get("resultReleaseDelayHours"), 0),
              postSubmitMessage,
              leaderCanViewFullReport: parseBoolean(formData.get("leaderCanViewFullReport"), true),
              reportWorkflow: requestedWorkflow,
              randomizeQuestionOrder: parseBoolean(formData.get("randomizeQuestionOrder"), false),
              submissionAlertAdminIds: validAlertAdminIds,
            },
          },
        },
        select: {
          id: true,
          title: true,
        },
      });

      const importResult = await applyAssessmentQuestionRows(
        tx,
        assessment.id,
        parsed.rows,
        "REPLACE_ALL",
      );

      return {
        assessment,
        importResult,
      };
    });

    return NextResponse.json({
      ok: true,
      assessment: created.assessment,
      summary: parsed.summary,
      importResult: created.importResult,
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    return NextResponse.json(
      {
        error:
          "Database migration is required before CSV assessment import can run. Apply latest migrations and retry.",
      },
      { status: 409 },
    );
  }
}
