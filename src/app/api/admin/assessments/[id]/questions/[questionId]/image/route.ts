import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import { db } from "@/lib/db";
import {
  deleteManagedQuestionImage,
  MAX_QUESTION_IMAGE_ALT_CHARS,
  MAX_QUESTION_IMAGE_CAPTION_CHARS,
  MAX_QUESTION_IMAGE_REQUEST_BYTES,
  QuestionImageInputError,
  uploadQuestionImage,
} from "@/lib/question-image-storage";
import { lockQuestionImageMutation } from "@/lib/question-image-lock";
import {
  ASSESSMENT_CONTENT_HISTORY_ERROR,
  assessmentHasAttemptHistory,
  lockAssessmentContent,
} from "@/lib/assessment-content-lock";

function normalizeOptionalText(input: FormDataEntryValue | null) {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  return trimmed ? trimmed : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId, questionId } = await params;
  const contentLength = Number(req.headers.get("content-length") || "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_QUESTION_IMAGE_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "Image upload request exceeds the 4 MB file limit." },
      { status: 413 },
    );
  }

  const questionExists = await db.question.findFirst({
    where: {
      id: questionId,
      assessmentId,
    },
    select: {
      id: true,
    },
  });

  if (!questionExists) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  if (await assessmentHasAttemptHistory(db, assessmentId)) {
    return NextResponse.json(
      { error: ASSESSMENT_CONTENT_HISTORY_ERROR },
      { status: 409 },
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }

  const imageAlt = normalizeOptionalText(formData.get("imageAlt"));
  const imageCaption = normalizeOptionalText(formData.get("imageCaption"));

  if (typeof imageAlt === "string" && imageAlt.length > MAX_QUESTION_IMAGE_ALT_CHARS) {
    return NextResponse.json(
      { error: `Image alt text must be ${MAX_QUESTION_IMAGE_ALT_CHARS} characters or fewer.` },
      { status: 400 },
    );
  }
  if (typeof imageCaption === "string" && imageCaption.length > MAX_QUESTION_IMAGE_CAPTION_CHARS) {
    return NextResponse.json(
      { error: `Image caption must be ${MAX_QUESTION_IMAGE_CAPTION_CHARS} characters or fewer.` },
      { status: 400 },
    );
  }

  let uploadedUrl: string | null = null;

  try {
    const uploaded = await uploadQuestionImage({
      assessmentId,
      questionId,
      file,
    });
    uploadedUrl = uploaded.url;

    const mutation = await db.$transaction(async (tx) => {
      await lockAssessmentContent(tx, assessmentId);
      if (await assessmentHasAttemptHistory(tx, assessmentId)) {
        return { ok: false as const, reason: "HAS_HISTORY" as const };
      }
      await lockQuestionImageMutation(tx, questionId);
      const currentQuestion = await tx.question.findFirst({
        where: { id: questionId, assessmentId },
        select: {
          id: true,
          imageUrl: true,
          imageAlt: true,
          imageCaption: true,
        },
      });
      if (!currentQuestion) {
        return { ok: false as const, reason: "NOT_FOUND" as const };
      }

      const updated = await tx.question.update({
        where: { id: questionId },
        data: {
          imageUrl: uploaded.url,
          imageAlt:
            imageAlt === undefined ? currentQuestion.imageAlt : imageAlt,
          imageCaption:
            imageCaption === undefined
              ? currentQuestion.imageCaption
              : imageCaption,
        },
        select: {
          id: true,
          imageUrl: true,
          imageAlt: true,
          imageCaption: true,
        },
      });
      await recordAuditLog(
        {
          tenantId: check.liveUser.tenantId,
          actorId: check.liveUser.id,
          action: currentQuestion.imageUrl
            ? "ASSESSMENT_QUESTION_IMAGE_REPLACED"
            : "ASSESSMENT_QUESTION_IMAGE_UPLOADED",
          metadata: { assessmentId, questionId },
        },
        tx,
      );
      return {
        ok: true as const,
        updated,
        displacedUrl: currentQuestion.imageUrl,
      };
    });

    if (!mutation.ok) {
      await deleteManagedQuestionImage(uploadedUrl);
      uploadedUrl = null;
      if (mutation.reason === "HAS_HISTORY") {
        return NextResponse.json(
          { error: ASSESSMENT_CONTENT_HISTORY_ERROR },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Question not found." },
        { status: 404 },
      );
    }

    if (
      mutation.displacedUrl &&
      mutation.displacedUrl !== mutation.updated.imageUrl
    ) {
      try {
        await deleteManagedQuestionImage(mutation.displacedUrl);
      } catch (error) {
        console.error("Failed to delete previous question image:", error);
      }
    }

    return NextResponse.json({
      ok: true,
      question: mutation.updated,
    });
  } catch (error) {
    if (uploadedUrl) {
      try {
        await deleteManagedQuestionImage(uploadedUrl);
      } catch (cleanupError) {
        console.error("Failed to delete orphaned question image:", cleanupError);
      }
    }

    if (!(error instanceof QuestionImageInputError)) {
      console.error("Failed to store question image:", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof QuestionImageInputError
            ? error.message
            : "Failed to upload question image.",
      },
      { status: error instanceof QuestionImageInputError ? 400 : 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id: assessmentId, questionId } = await params;

  const mutation = await db.$transaction(async (tx) => {
    await lockAssessmentContent(tx, assessmentId);
    if (await assessmentHasAttemptHistory(tx, assessmentId)) {
      return { ok: false as const, reason: "HAS_HISTORY" as const };
    }
    await lockQuestionImageMutation(tx, questionId);
    const currentQuestion = await tx.question.findFirst({
      where: { id: questionId, assessmentId },
      select: { id: true, imageUrl: true },
    });
    if (!currentQuestion) {
      return { ok: false as const, reason: "NOT_FOUND" as const };
    }

    const updated = await tx.question.update({
      where: { id: questionId },
      data: {
        imageUrl: null,
        imageAlt: null,
        imageCaption: null,
      },
      select: {
        id: true,
        imageUrl: true,
        imageAlt: true,
        imageCaption: true,
      },
    });
    await recordAuditLog(
      {
        tenantId: check.liveUser.tenantId,
        actorId: check.liveUser.id,
        action: "ASSESSMENT_QUESTION_IMAGE_REMOVED",
        metadata: { assessmentId, questionId },
      },
      tx,
    );
    return {
      ok: true as const,
      updated,
      displacedUrl: currentQuestion.imageUrl,
    };
  });

  if (!mutation.ok) {
    if (mutation.reason === "HAS_HISTORY") {
      return NextResponse.json(
        { error: ASSESSMENT_CONTENT_HISTORY_ERROR },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  if (mutation.displacedUrl) {
    try {
      await deleteManagedQuestionImage(mutation.displacedUrl);
    } catch (error) {
      console.error("Failed to delete question image from Blob:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    question: mutation.updated,
  });
}
