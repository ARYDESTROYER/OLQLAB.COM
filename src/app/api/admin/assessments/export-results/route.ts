import { NextRequest, NextResponse } from "next/server";
import { QuestionType } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { listResolvedAssessmentUsers } from "@/lib/assessment-access";
import { buildCsv, type CsvRow } from "@/lib/csv";
import { db } from "@/lib/db";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

type ExportLayout = "WIDE" | "LONG";
type AttemptStatusFilter = "ALL" | "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
type ReportStatusFilter =
  | "ALL"
  | "NOT_UPLOADED_YET"
  | "UPLOADED"
  | "AWAITING_DELIVERY_TIMER"
  | "DELIVERED_TO_USER";

type ExportInclude = {
  participant: boolean;
  attempt: boolean;
  report: boolean;
  answers: boolean;
};

type ExportRequestBody = {
  assessmentIds?: string[];
  layout?: ExportLayout;
  attemptStatus?: AttemptStatusFilter;
  reportStatus?: ReportStatusFilter;
  include?: Partial<ExportInclude>;
};

type AssessmentWithQuestions = {
  id: string;
  title: string;
  isPublished: boolean;
  policy: {
    reportWorkflow: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
  } | null;
  questions: Array<{
    id: string;
    code: string | null;
    prompt: string;
    questionType: QuestionType;
    sortOrder: number;
    options: Array<{
      id: string;
      code: string;
      text: string;
    }>;
  }>;
};

type SessionRecord = {
  userId: string;
  status: "IN_PROGRESS" | "SUBMITTED";
  startedAt: Date;
  submittedAt: Date | null;
  answers: Array<{
    questionId: string;
    optionId: string | null;
    value: number | null;
    textValue: string | null;
  }>;
};

type ReportRecord = {
  userId: string;
  status: "DRAFT" | "PUBLISHED";
  availableAt: Date | null;
  deliveryMethod: "DASHBOARD_ONLY" | "EMAIL_LINK" | null;
  hasManualPdf: boolean;
};

type ExportRecord = {
  assessment: AssessmentWithQuestions;
  participant: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    tenantId: string;
    managerEmail: string | null;
  };
  tenant: {
    name: string;
    type: "ORGANIZATION" | "SOLO";
  } | null;
  session: SessionRecord | null;
  report: ReportRecord | null;
  answerByQuestionId: Map<string, SessionRecord["answers"][number]>;
  attemptStatus: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  reportStatus: ReportStatusFilter | null;
};

function normalizeAssessmentIds(input: string[] | undefined) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((item) => item.trim()).filter(Boolean)));
}

function normalizeLayout(input: string | undefined): ExportLayout {
  return input === "LONG" ? "LONG" : "WIDE";
}

function normalizeAttemptStatus(input: string | undefined): AttemptStatusFilter {
  if (input === "NOT_STARTED" || input === "IN_PROGRESS" || input === "SUBMITTED") {
    return input;
  }
  return "ALL";
}

function normalizeReportStatus(input: string | undefined): ReportStatusFilter {
  if (
    input === "NOT_UPLOADED_YET" ||
    input === "UPLOADED" ||
    input === "AWAITING_DELIVERY_TIMER" ||
    input === "DELIVERED_TO_USER"
  ) {
    return input;
  }
  return "ALL";
}

function normalizeInclude(input: Partial<ExportInclude> | undefined): ExportInclude {
  return {
    participant: input?.participant !== false,
    attempt: input?.attempt !== false,
    report: input?.report !== false,
    answers: input?.answers !== false,
  };
}

function matchesAttemptStatus(
  attemptStatus: ExportRecord["attemptStatus"],
  filter: AttemptStatusFilter,
) {
  return filter === "ALL" || attemptStatus === filter;
}

function resolveReportStatus(record: {
  session: SessionRecord | null;
  report: ReportRecord | null;
  now: Date;
}): ReportStatusFilter | null {
  if (!record.session || record.session.status !== "SUBMITTED") {
    return null;
  }

  if (!record.report) {
    return "NOT_UPLOADED_YET";
  }

  if (record.report.status !== "PUBLISHED") {
    return record.report.hasManualPdf ? "UPLOADED" : "NOT_UPLOADED_YET";
  }

  if (record.report.availableAt && record.report.availableAt > record.now) {
    return "AWAITING_DELIVERY_TIMER";
  }

  return "DELIVERED_TO_USER";
}

function matchesReportStatus(
  reportStatus: ExportRecord["reportStatus"],
  filter: ReportStatusFilter,
) {
  if (filter === "ALL") return true;
  return reportStatus === filter;
}

function formatReportStatusLabel(status: ExportRecord["reportStatus"]) {
  if (status === "NOT_UPLOADED_YET") return "Not uploaded yet";
  if (status === "UPLOADED") return "Uploaded";
  if (status === "AWAITING_DELIVERY_TIMER") return "Awaiting delivery timer";
  if (status === "DELIVERED_TO_USER") return "Delivered to user";
  return "";
}

function formatAttemptStatusLabel(status: ExportRecord["attemptStatus"]) {
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "SUBMITTED") return "Submitted";
  return "Not started";
}

function formatDurationMinutes(startedAt: Date | null, submittedAt: Date | null) {
  if (!startedAt || !submittedAt) return "";
  const durationMs = submittedAt.getTime() - startedAt.getTime();
  if (durationMs <= 0) return "";
  return Math.round(durationMs / 60000);
}

function buildQuestionHeader(
  assessment: AssessmentWithQuestions,
  question: AssessmentWithQuestions["questions"][number],
) {
  const questionCode = question.code?.trim() || `Question ${question.sortOrder + 1}`;
  return `${assessment.title} | ${questionCode} | ${question.prompt}`;
}

function formatAnswerValue(
  question: AssessmentWithQuestions["questions"][number],
  answer: SessionRecord["answers"][number] | undefined,
) {
  if (!answer) return "";

  if (question.questionType === "FREE_TEXT") {
    return answer.textValue || "";
  }

  if (question.questionType === "SJT_SINGLE") {
    const selectedOption = answer.optionId
      ? question.options.find((option) => option.id === answer.optionId) || null
      : null;
    if (!selectedOption) return "";
    return selectedOption.code
      ? `${selectedOption.code}. ${selectedOption.text}`
      : selectedOption.text;
  }

  return typeof answer.value === "number" ? String(answer.value) : "";
}

async function findReports(
  assessmentId: string,
  userIds: string[],
): Promise<ReportRecord[]> {
  if (userIds.length === 0) return [];

  try {
    const reports = await db.report.findMany({
      where: {
        assessmentId,
        userId: { in: userIds },
      },
      select: {
        userId: true,
        status: true,
        availableAt: true,
        deliveryMethod: true,
        pdfAsset: {
          select: {
            id: true,
          },
        },
      },
    });

    return reports.map((report) => ({
      userId: report.userId,
      status: report.status,
      availableAt: report.availableAt,
      deliveryMethod: report.deliveryMethod,
      hasManualPdf: Boolean(report.pdfAsset),
    }));
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const reports = await db.report.findMany({
      where: {
        assessmentId,
        userId: { in: userIds },
      },
      select: {
        userId: true,
        status: true,
        availableAt: true,
        deliveryMethod: true,
      },
    });

    return reports.map((report) => ({
      userId: report.userId,
      status: report.status,
      availableAt: report.availableAt,
      deliveryMethod: report.deliveryMethod,
      hasManualPdf: false,
    }));
  }
}

function buildBaseHeaders(include: ExportInclude) {
  const headers = ["assessmentId", "assessmentTitle", "assessmentPublished"];

  if (include.participant) {
    headers.push(
      "userId",
      "firstName",
      "lastName",
      "email",
      "organisation",
      "organisationType",
      "managerEmail",
    );
  }

  if (include.attempt) {
    headers.push("attemptStatus", "startedAt", "submittedAt", "durationMinutes");
  }

  if (include.report) {
    headers.push(
      "reportStatus",
      "reportStatusRaw",
      "reportWorkflow",
      "reportDeliveryMethod",
      "reportAvailableAt",
      "manualPdfUploaded",
    );
  }

  return headers;
}

function buildBaseRow(record: ExportRecord, include: ExportInclude): CsvRow {
  const row: CsvRow = [
    record.assessment.id,
    record.assessment.title,
    record.assessment.isPublished ? "PUBLISHED" : "DRAFT",
  ];

  if (include.participant) {
    row.push(
      record.participant.userId,
      record.participant.firstName,
      record.participant.lastName,
      record.participant.email,
      record.tenant?.type === "ORGANIZATION" ? record.tenant.name : "Solo",
      record.tenant?.type || "SOLO",
      record.participant.managerEmail || "",
    );
  }

  if (include.attempt) {
    row.push(
      formatAttemptStatusLabel(record.attemptStatus),
      record.session?.startedAt || null,
      record.session?.submittedAt || null,
      formatDurationMinutes(record.session?.startedAt || null, record.session?.submittedAt || null),
    );
  }

  if (include.report) {
    row.push(
      formatReportStatusLabel(record.reportStatus),
      record.report?.status || "",
      record.assessment.policy?.reportWorkflow || "AI_STANDARD",
      record.report?.deliveryMethod || "",
      record.report?.availableAt || null,
      record.report?.hasManualPdf || false,
    );
  }

  return row;
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = (await req.json().catch(() => null)) as ExportRequestBody | null;
  const assessmentIds = normalizeAssessmentIds(body?.assessmentIds);
  const layout = normalizeLayout(body?.layout);
  const attemptStatusFilter = normalizeAttemptStatus(body?.attemptStatus);
  const reportStatusFilter = normalizeReportStatus(body?.reportStatus);
  const include = normalizeInclude(body?.include);

  if (assessmentIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one assessment to export." },
      { status: 400 },
    );
  }

  if (!include.participant && !include.attempt && !include.report && !include.answers) {
    return NextResponse.json(
      { error: "Select at least one export field group." },
      { status: 400 },
    );
  }

  const assessmentOrder = new Map(assessmentIds.map((id, index) => [id, index]));
  const assessments = await db.assessment.findMany({
    where: {
      id: { in: assessmentIds },
    },
    select: {
      id: true,
      title: true,
      isPublished: true,
      policy: {
        select: {
          reportWorkflow: true,
        },
      },
      questions: {
        orderBy: {
          sortOrder: "asc",
        },
        select: {
          id: true,
          code: true,
          prompt: true,
          questionType: true,
          sortOrder: true,
          options: {
            orderBy: {
              displayOrder: "asc",
            },
            select: {
              id: true,
              code: true,
              text: true,
            },
          },
        },
      },
    },
  });

  const orderedAssessments = assessments.sort(
    (a, b) => (assessmentOrder.get(a.id) ?? 0) - (assessmentOrder.get(b.id) ?? 0),
  );

  if (orderedAssessments.length === 0) {
    return NextResponse.json({ error: "No matching assessments found." }, { status: 404 });
  }

  const participantSnapshots = await Promise.all(
    orderedAssessments.map(async (assessment) => {
      const participants = await listResolvedAssessmentUsers(assessment.id);
      const userIds = participants.map((participant) => participant.userId);

      const [sessions, reports] = await Promise.all([
        userIds.length
          ? db.quizSession.findMany({
              where: {
                assessmentId: assessment.id,
                userId: { in: userIds },
              },
              select: {
                userId: true,
                status: true,
                startedAt: true,
                submittedAt: true,
                answers: {
                  select: {
                    questionId: true,
                    optionId: true,
                    value: true,
                    textValue: true,
                  },
                },
              },
            })
          : Promise.resolve([]),
        findReports(assessment.id, userIds),
      ]);

      return {
        assessment,
        participants,
        sessions,
        reports,
      };
    }),
  );

  const tenantIds = Array.from(
    new Set(
      participantSnapshots.flatMap((snapshot) =>
        snapshot.participants.map((participant) => participant.tenantId),
      ),
    ),
  );

  const tenants = tenantIds.length
    ? await db.tenant.findMany({
        where: {
          id: { in: tenantIds },
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
      })
    : [];

  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const now = new Date();

  const records: ExportRecord[] = [];

  for (const snapshot of participantSnapshots) {
    const sessionByUserId = new Map(snapshot.sessions.map((session) => [session.userId, session]));
    const reportByUserId = new Map(snapshot.reports.map((report) => [report.userId, report]));

    for (const participant of snapshot.participants) {
      const session = sessionByUserId.get(participant.userId) || null;
      const report = reportByUserId.get(participant.userId) || null;
      const attemptStatus = session?.status || "NOT_STARTED";
      const reportStatus = resolveReportStatus({ session, report, now });

      if (!matchesAttemptStatus(attemptStatus, attemptStatusFilter)) continue;
      if (!matchesReportStatus(reportStatus, reportStatusFilter)) continue;

      records.push({
        assessment: snapshot.assessment,
        participant: {
          userId: participant.userId,
          firstName: participant.firstName,
          lastName: participant.lastName,
          email: participant.email,
          tenantId: participant.tenantId,
          managerEmail: participant.managerEmail,
        },
        tenant: tenantById.get(participant.tenantId) || null,
        session,
        report,
        answerByQuestionId: new Map(
          (session?.answers || []).map((answer) => [answer.questionId, answer]),
        ),
        attemptStatus,
        reportStatus,
      });
    }
  }

  const baseHeaders = buildBaseHeaders(include);
  let headers = [...baseHeaders];
  const rows: CsvRow[] = [];

  if (include.answers && layout === "WIDE") {
    const questionColumns = orderedAssessments.flatMap((assessment) =>
      assessment.questions.map((question) => ({
        assessmentId: assessment.id,
        header: buildQuestionHeader(assessment, question),
        question,
      })),
    );

    headers = [...headers, ...questionColumns.map((column) => column.header)];

    for (const record of records) {
      const row = buildBaseRow(record, include);
      for (const column of questionColumns) {
        if (column.assessmentId !== record.assessment.id) {
          row.push("");
          continue;
        }
        row.push(formatAnswerValue(column.question, record.answerByQuestionId.get(column.question.id)));
      }
      rows.push(row);
    }
  } else if (include.answers && layout === "LONG") {
    headers = [
      ...headers,
      "questionOrder",
      "questionId",
      "questionCode",
      "questionPrompt",
      "questionType",
      "selectedOptionCode",
      "selectedOptionText",
      "answerValue",
      "answerText",
    ];

    for (const record of records) {
      for (const question of record.assessment.questions) {
        const answer = record.answerByQuestionId.get(question.id);
        const selectedOption = answer?.optionId
          ? question.options.find((option) => option.id === answer.optionId) || null
          : null;

        rows.push([
          ...buildBaseRow(record, include),
          question.sortOrder + 1,
          question.id,
          question.code || "",
          question.prompt,
          question.questionType,
          selectedOption?.code || "",
          selectedOption?.text || "",
          typeof answer?.value === "number" ? answer.value : "",
          answer?.textValue || "",
        ]);
      }
    }
  } else {
    for (const record of records) {
      rows.push(buildBaseRow(record, include));
    }
  }

  const csv = buildCsv(headers, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="assessment-results-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}