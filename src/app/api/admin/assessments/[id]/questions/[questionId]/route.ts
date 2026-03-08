import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

function normalizeQuestionImage(input: {
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
}) {
  if (typeof input.imageUrl !== "string") {
    return {
      imageUrl: undefined,
      imageAlt: undefined,
      imageCaption: undefined,
    };
  }

  const imageUrl = input.imageUrl.trim() || null;
  if (!imageUrl) {
    return {
      imageUrl: null,
      imageAlt: null,
      imageCaption: null,
    };
  }

  return {
    imageUrl,
    imageAlt: typeof input.imageAlt === "string" ? input.imageAlt.trim() || null : undefined,
    imageCaption:
      typeof input.imageCaption === "string" ? input.imageCaption.trim() || null : undefined,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id, questionId } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        prompt?: string;
        imageUrl?: string;
        imageAlt?: string;
        imageCaption?: string;
        trait?: string;
        reverse?: boolean;
        sectionId?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const existing = await db.question.findFirst({
    where: {
      id: questionId,
      assessmentId: id,
    },
    select: {
      id: true,
      sectionId: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  let sectionId = existing.sectionId;
  if (body.sectionId && body.sectionId !== existing.sectionId) {
    const section = await db.assessmentSection.findFirst({
      where: {
        id: body.sectionId,
        assessmentId: id,
      },
      select: { id: true },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found." }, { status: 404 });
    }
    sectionId = section.id;
  }

  const questionImage = normalizeQuestionImage(body);

  const question = await db.question.update({
    where: { id: questionId },
    data: {
      prompt: typeof body.prompt === "string" ? body.prompt.trim() : undefined,
      imageUrl: questionImage.imageUrl,
      imageAlt: questionImage.imageAlt,
      imageCaption: questionImage.imageCaption,
      trait: typeof body.trait === "string" ? body.trait.trim().toLowerCase() : undefined,
      reverse: typeof body.reverse === "boolean" ? body.reverse : undefined,
      sectionId,
    },
    include: {
      section: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return NextResponse.json({ question });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id, questionId } = await params;

  const question = await db.question.findFirst({
    where: {
      id: questionId,
      assessmentId: id,
    },
    select: {
      id: true,
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  await db.question.delete({ where: { id: questionId } });

  return NextResponse.json({ ok: true, deletedQuestionId: questionId });
}
