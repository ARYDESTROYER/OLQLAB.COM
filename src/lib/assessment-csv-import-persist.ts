import { Prisma, SectionKind } from "@prisma/client";
import type { CsvIssue, ImportedQuestionRow } from "@/lib/assessment-question-csv";

export type QuestionImportMode = "REPLACE_ALL" | "APPEND";

export async function findExistingQuestionCodeConflicts(
  tx: Prisma.TransactionClient,
  assessmentId: string,
  rows: ImportedQuestionRow[],
): Promise<CsvIssue[]> {
  const existing = await tx.question.findMany({
    where: {
      assessmentId,
      code: {
        not: null,
      },
    },
    select: {
      code: true,
    },
  });

  const existingCodes = new Set(
    existing
      .map((question) => question.code)
      .filter((code): code is string => Boolean(code))
      .map((code) => code.toLowerCase()),
  );

  return rows
    .filter((row) => existingCodes.has(row.questionCode.toLowerCase()))
    .map((row) => ({
      row: row.rowNumber,
      column: "question_code",
      code: "DUPLICATE_CODE" as const,
      message: `question_code "${row.questionCode}" already exists in this assessment.`,
    }));
}

function sectionKey(sectionKind: SectionKind, sectionTitle: string) {
  return `${sectionKind}::${sectionTitle}`;
}

export async function applyAssessmentQuestionRows(
  tx: Prisma.TransactionClient,
  assessmentId: string,
  rows: ImportedQuestionRow[],
  mode: QuestionImportMode,
) {
  if (mode === "REPLACE_ALL") {
    await tx.question.deleteMany({ where: { assessmentId } });
    await tx.assessmentSection.deleteMany({ where: { assessmentId } });
    await tx.assessmentCompetency.deleteMany({ where: { assessmentId } });
  }

  const [existingSections, maxQuestionSort] = await Promise.all([
    tx.assessmentSection.findMany({
      where: { assessmentId },
      select: { id: true, title: true, kind: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
    tx.question.aggregate({
      where: { assessmentId },
      _max: { sortOrder: true },
    }),
  ]);

  const sectionsByKey = new Map<string, { id: string; sortOrder: number }>();
  for (const section of existingSections) {
    sectionsByKey.set(sectionKey(section.kind, section.title), {
      id: section.id,
      sortOrder: section.sortOrder,
    });
  }

  let nextSectionSortOrder =
    existingSections.reduce((max, section) => Math.max(max, section.sortOrder), -1) + 1;
  let nextQuestionSortOrder = (maxQuestionSort._max.sortOrder ?? -1) + 1;
  let createdSections = 0;
  let createdOptions = 0;
  const competencyCodesTouched = new Set<string>();

  for (const row of rows) {
    const sectionIdentifier = sectionKey(row.sectionKind, row.sectionTitle);
    let resolvedSection = sectionsByKey.get(sectionIdentifier);

    if (!resolvedSection) {
      const createdSection = await tx.assessmentSection.create({
        data: {
          assessmentId,
          title: row.sectionTitle,
          kind: row.sectionKind,
          sortOrder: nextSectionSortOrder,
        },
        select: {
          id: true,
          sortOrder: true,
        },
      });
      nextSectionSortOrder += 1;
      createdSections += 1;
      resolvedSection = createdSection;
      sectionsByKey.set(sectionIdentifier, createdSection);
    }

    const question = await tx.question.create({
      data: {
        assessmentId,
        sectionId: resolvedSection.id,
        code: row.questionCode,
        prompt: row.prompt,
        imageUrl: row.imageUrl,
        imageAlt: row.imageAlt,
        imageCaption: row.imageCaption,
        questionType: row.questionType,
        category: row.category,
        trait: row.trait,
        reverse: row.reverse,
        scaleMin: Math.round(row.scaleMin),
        scaleMax: Math.round(row.scaleMax),
        sortOrder: nextQuestionSortOrder,
      },
      select: {
        id: true,
      },
    });
    nextQuestionSortOrder += 1;

    for (let optionIndex = 0; optionIndex < row.options.length; optionIndex += 1) {
      const option = row.options[optionIndex];
      const createdOption = await tx.questionOption.create({
        data: {
          questionId: question.id,
          code: option.code,
          text: option.text,
          displayOrder: optionIndex,
        },
        select: {
          id: true,
        },
      });
      createdOptions += 1;

      for (const impact of option.impacts) {
        const competency = await tx.assessmentCompetency.upsert({
          where: {
            assessmentId_code: {
              assessmentId,
              code: impact.competencyCode,
            },
          },
          create: {
            assessmentId,
            code: impact.competencyCode,
            name: impact.competencyCode
              .split("_")
              .filter(Boolean)
              .map((token) => token[0].toUpperCase() + token.slice(1))
              .join(" "),
          },
          update: {},
          select: {
            id: true,
          },
        });

        competencyCodesTouched.add(impact.competencyCode);

        await tx.optionImpact.create({
          data: {
            optionId: createdOption.id,
            assessmentCompetencyId: competency.id,
            delta: impact.delta,
          },
        });
      }
    }
  }

  return {
    createdSections,
    createdQuestions: rows.length,
    createdOptions,
    createdCompetencies: competencyCodesTouched.size,
  };
}
