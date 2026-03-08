import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  deleteManagedQuestionImage,
  uploadQuestionImage,
} from "@/lib/question-image-storage";

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

  const question = await db.question.findFirst({
    where: {
      id: questionId,
      assessmentId,
    },
    select: {
      id: true,
      imageUrl: true,
      imageAlt: true,
      imageCaption: true,
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }

  try {
    const uploaded = await uploadQuestionImage({
      assessmentId,
      questionId,
      file,
    });

    const imageAlt = normalizeOptionalText(formData.get("imageAlt"));
    const imageCaption = normalizeOptionalText(formData.get("imageCaption"));

    const updatedQuestion = await db.question.update({
      where: { id: questionId },
      data: {
        imageUrl: uploaded.url,
        imageAlt: imageAlt === undefined ? question.imageAlt : imageAlt,
        imageCaption: imageCaption === undefined ? question.imageCaption : imageCaption,
      },
      select: {
        id: true,
        imageUrl: true,
        imageAlt: true,
        imageCaption: true,
      },
    });

    if (question.imageUrl && question.imageUrl !== updatedQuestion.imageUrl) {
      try {
        await deleteManagedQuestionImage(question.imageUrl);
      } catch (error) {
        console.error("Failed to delete previous question image:", error);
      }
    }

    return NextResponse.json({
      ok: true,
      question: updatedQuestion,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload question image.",
      },
      { status: 400 },
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

  const question = await db.question.findFirst({
    where: {
      id: questionId,
      assessmentId,
    },
    select: {
      id: true,
      imageUrl: true,
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  const updatedQuestion = await db.question.update({
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

  if (question.imageUrl) {
    try {
      await deleteManagedQuestionImage(question.imageUrl);
    } catch (error) {
      console.error("Failed to delete question image from Blob:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    question: updatedQuestion,
  });
}