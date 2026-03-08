import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { db } from "@/lib/db";

function normalizeQuestionImage(input: {
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
}) {
  const imageUrl = input.imageUrl?.trim() || null;
  if (!imageUrl) {
    return {
      imageUrl: null,
      imageAlt: null,
      imageCaption: null,
    };
  }

  return {
    imageUrl,
    imageAlt: input.imageAlt?.trim() || null,
    imageCaption: input.imageCaption?.trim() || null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;

  const questions = await db.question.findMany({
    where: { assessmentId: id },
    include: {
      section: {
        select: {
          id: true,
          title: true,
        },
      },
      options: {
        orderBy: { displayOrder: "asc" },
        include: {
          impacts: {
            orderBy: { id: "asc" },
            include: {
              competency: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              assessmentCompetency: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const sections = await db.assessmentSection.findMany({
    where: { assessmentId: id },
    select: {
      id: true,
      title: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    questions,
    sections,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
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

  if (!body?.prompt?.trim()) {
    return NextResponse.json({ error: "Question prompt is required." }, { status: 400 });
  }

  const section = body.sectionId
    ? await db.assessmentSection.findFirst({
        where: {
          id: body.sectionId,
          assessmentId: id,
        },
        select: { id: true },
      })
    : await db.assessmentSection.findFirst({
        where: { assessmentId: id },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

  if (!section) {
    return NextResponse.json(
      { error: "No section found for this assessment. Add a section first." },
      { status: 400 },
    );
  }

  const questionImage = normalizeQuestionImage(body);

  const maxSort = await db.question.aggregate({
    where: { assessmentId: id },
    _max: { sortOrder: true },
  });

  const question = await db.question.create({
    data: {
      assessmentId: id,
      sectionId: section.id,
      prompt: body.prompt.trim(),
      imageUrl: questionImage.imageUrl,
      imageAlt: questionImage.imageAlt,
      imageCaption: questionImage.imageCaption,
      questionType: "LIKERT_TRAIT",
      trait: body.trait?.trim().toLowerCase() || null,
      reverse: Boolean(body.reverse),
      scaleMin: 1,
      scaleMax: 5,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
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

  return NextResponse.json({ question }, { status: 201 });
}
