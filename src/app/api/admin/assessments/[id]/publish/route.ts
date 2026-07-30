import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  DEFAULT_ASSESSMENT_INTRO_BULLETS,
  DEFAULT_ASSESSMENT_INTRO_DESCRIPTION,
  normalizeAssessmentIntroBullets,
  normalizeAssessmentIntroDescription,
} from "@/lib/assessment-intro";
import { recordAuditLog } from "@/lib/audit-log";

const validWorkflows = new Set(["AI_STANDARD", "MANUAL_PDF_UPLOAD"]);
const validQuestionPresentationModes = new Set(["ALL_AT_ONCE", "ONE_AT_A_TIME"]);
const DEFAULT_POST_SUBMIT_MESSAGE = "Thanks for completing your assessment.";

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  for (const field of [
    "isPublished",
    "showResultsToEmployee",
    "leaderCanViewFullReport",
    "randomizeQuestionOrder",
  ]) {
    if (hasOwn(body, field) && typeof body[field] !== "boolean") {
      return NextResponse.json({ error: `${field} must be a boolean.` }, { status: 422 });
    }
  }

  if (
    hasOwn(body, "resultReleaseDelayHours") &&
    (typeof body.resultReleaseDelayHours !== "number" ||
      !Number.isInteger(body.resultReleaseDelayHours) ||
      body.resultReleaseDelayHours < 0 ||
      body.resultReleaseDelayHours > 8760)
  ) {
    return NextResponse.json(
      { error: "resultReleaseDelayHours must be a whole number from 0 to 8760." },
      { status: 422 },
    );
  }

  if (
    hasOwn(body, "reportWorkflow") &&
    (typeof body.reportWorkflow !== "string" || !validWorkflows.has(body.reportWorkflow))
  ) {
    return NextResponse.json({ error: "Invalid reportWorkflow." }, { status: 422 });
  }
  if (
    hasOwn(body, "questionPresentationMode") &&
    (typeof body.questionPresentationMode !== "string" ||
      !validQuestionPresentationModes.has(body.questionPresentationMode))
  ) {
    return NextResponse.json(
      { error: "Invalid questionPresentationMode." },
      { status: 422 },
    );
  }
  if (
    hasOwn(body, "submissionAlertAdminIds") &&
    (!Array.isArray(body.submissionAlertAdminIds) || body.submissionAlertAdminIds.length > 100)
  ) {
    return NextResponse.json(
      { error: "submissionAlertAdminIds must be an array of at most 100 admin IDs." },
      { status: 422 },
    );
  }

  const requestedAlertAdminIds = Array.isArray(body.submissionAlertAdminIds)
    ? Array.from(
        new Set(
          body.submissionAlertAdminIds
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean),
        ),
      )
    : undefined;
  const validAlertAdminIds = requestedAlertAdminIds
    ? (
        await db.user.findMany({
          where: { id: { in: requestedAlertAdminIds }, role: "ADMIN" },
          select: { id: true },
        })
      ).map((row) => row.id)
    : undefined;
  if (
    requestedAlertAdminIds &&
    validAlertAdminIds &&
    validAlertAdminIds.length !== requestedAlertAdminIds.length
  ) {
    return NextResponse.json(
      { error: "One or more submission alert recipients are not valid admins." },
      { status: 422 },
    );
  }

  const admin = await db.user.findUnique({
    where: { id: check.session.user.id },
    select: { id: true, tenantId: true },
  });
  if (!admin) return NextResponse.json({ error: "Admin not found." }, { status: 404 });

  const policyUpdate: Prisma.AssessmentPolicyUpdateWithoutAssessmentInput = {};
  if (hasOwn(body, "showResultsToEmployee")) {
    policyUpdate.showResultsToEmployee = body.showResultsToEmployee as boolean;
  }
  if (hasOwn(body, "resultReleaseDelayHours")) {
    policyUpdate.resultReleaseDelayHours = body.resultReleaseDelayHours as number;
  }
  if (hasOwn(body, "introDescription")) {
    policyUpdate.introDescription = normalizeAssessmentIntroDescription(body.introDescription);
  }
  if (hasOwn(body, "introBullets")) {
    policyUpdate.introBullets = normalizeAssessmentIntroBullets(body.introBullets);
  }
  if (hasOwn(body, "postSubmitMessage")) {
    if (typeof body.postSubmitMessage !== "string" || body.postSubmitMessage.length > 2000) {
      return NextResponse.json(
        { error: "postSubmitMessage must be text no longer than 2000 characters." },
        { status: 422 },
      );
    }
    policyUpdate.postSubmitMessage = body.postSubmitMessage.trim() || DEFAULT_POST_SUBMIT_MESSAGE;
  }
  if (hasOwn(body, "leaderCanViewFullReport")) {
    policyUpdate.leaderCanViewFullReport = body.leaderCanViewFullReport as boolean;
  }
  if (hasOwn(body, "reportWorkflow")) {
    policyUpdate.reportWorkflow = body.reportWorkflow as "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
  }
  if (hasOwn(body, "questionPresentationMode")) {
    policyUpdate.questionPresentationMode = body.questionPresentationMode as
      | "ALL_AT_ONCE"
      | "ONE_AT_A_TIME";
  }
  if (hasOwn(body, "randomizeQuestionOrder")) {
    policyUpdate.randomizeQuestionOrder = body.randomizeQuestionOrder as boolean;
  }
  if (validAlertAdminIds) policyUpdate.submissionAlertAdminIds = validAlertAdminIds;

  const policyCreate: Prisma.AssessmentPolicyCreateWithoutAssessmentInput = {
    showResultsToEmployee:
      (body.showResultsToEmployee as boolean | undefined) ?? true,
    resultReleaseDelayHours:
      (body.resultReleaseDelayHours as number | undefined) ?? 0,
    introDescription: hasOwn(body, "introDescription")
      ? normalizeAssessmentIntroDescription(body.introDescription)
      : DEFAULT_ASSESSMENT_INTRO_DESCRIPTION,
    introBullets: hasOwn(body, "introBullets")
      ? normalizeAssessmentIntroBullets(body.introBullets)
      : [...DEFAULT_ASSESSMENT_INTRO_BULLETS],
    postSubmitMessage:
      typeof body.postSubmitMessage === "string" && body.postSubmitMessage.trim()
        ? body.postSubmitMessage.trim()
        : DEFAULT_POST_SUBMIT_MESSAGE,
    leaderCanViewFullReport:
      (body.leaderCanViewFullReport as boolean | undefined) ?? true,
    reportWorkflow:
      (body.reportWorkflow as "AI_STANDARD" | "MANUAL_PDF_UPLOAD" | undefined) ||
      "AI_STANDARD",
    questionPresentationMode:
      (body.questionPresentationMode as
        | "ALL_AT_ONCE"
        | "ONE_AT_A_TIME"
        | undefined) || "ALL_AT_ONCE",
    randomizeQuestionOrder:
      (body.randomizeQuestionOrder as boolean | undefined) ?? false,
    submissionAlertAdminIds: validAlertAdminIds || [],
  };

  const result = await db.$transaction(async (tx) => {
    const before = await tx.assessment.findUnique({
      where: { id },
      select: { id: true, isPublished: true },
    });
    if (!before) return null;

    const updated = await tx.assessment.update({
      where: { id },
      data: {
        isPublished: hasOwn(body, "isPublished")
          ? (body.isPublished as boolean)
          : undefined,
        policy: { upsert: { create: policyCreate, update: policyUpdate } },
      },
      include: { policy: true },
    });
    await recordAuditLog(
      {
        tenantId: admin.tenantId,
        actorId: admin.id,
        action: "ASSESSMENT_POLICY_UPDATED",
        metadata: {
          assessmentId: id,
          changedFields: Object.keys(body).sort(),
          publishedBefore: before.isPublished,
          publishedAfter: updated.isPublished,
        },
      },
      tx,
    );
    return updated;
  });

  if (!result) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  return NextResponse.json(result);
}
