import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toCode(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");
}

function titleizeCode(input) {
  return input
    .split("_")
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(" ");
}

function pickQuestionType(input) {
  if (input === "FREE_TEXT") return "FREE_TEXT";
  return input === "SJT_SINGLE" ? "SJT_SINGLE" : "LIKERT_TRAIT";
}

function pickSectionKind(input) {
  return input === "SCENARIO" ? "SCENARIO" : "PERSONALITY";
}

async function main() {
  const args = process.argv.slice(2);
  const sourceArg = args[0];
  const publish = args.includes("--publish");

  if (!sourceArg) {
    throw new Error(
      "Usage: node prisma/scripts/import-assessment-payload.mjs <payload.json> [--publish]",
    );
  }

  const filePath = resolve(process.cwd(), sourceArg);
  const raw = readFileSync(filePath, "utf8");
  const payload = JSON.parse(raw);

  const title = payload?.title?.trim();
  if (!title) {
    throw new Error("Payload must include a non-empty title.");
  }

  if (!Array.isArray(payload.sections) || payload.sections.length === 0) {
    throw new Error("Payload must include at least one section.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        title,
        isPublished: publish,
        policy: {
          create: {
            showResultsToEmployee: payload.policy?.showResultsToEmployee ?? true,
            resultReleaseDelayHours: payload.policy?.resultReleaseDelayHours ?? 0,
            postSubmitMessage:
              payload.policy?.postSubmitMessage || "Thanks for completing your assessment.",
            leaderCanViewFullReport: payload.policy?.leaderCanViewFullReport ?? true,
            reportWorkflow: payload.policy?.reportWorkflow ?? "AI_STANDARD",
            randomizeQuestionOrder: payload.policy?.randomizeQuestionOrder ?? false,
            submissionAlertAdminIds: payload.policy?.submissionAlertAdminIds ?? [],
          },
        },
      },
      select: { id: true },
    });

    const competencyMap = new Map();

    for (const competency of payload.competencies || []) {
      const code = toCode(competency.code || "");
      if (!code) continue;

      const saved = await tx.assessmentCompetency.upsert({
        where: {
          assessmentId_code: {
            assessmentId: assessment.id,
            code,
          },
        },
        create: {
          assessmentId: assessment.id,
          code,
          name: competency.name?.trim() || titleizeCode(code),
          description: competency.description?.trim() || undefined,
        },
        update: {
          name: competency.name?.trim() || titleizeCode(code),
          description: competency.description?.trim() || undefined,
        },
      });

      competencyMap.set(code, saved.id);
    }

    let questionCount = 0;

    for (let sectionIndex = 0; sectionIndex < payload.sections.length; sectionIndex += 1) {
      const section = payload.sections[sectionIndex];
      const savedSection = await tx.assessmentSection.create({
        data: {
          assessmentId: assessment.id,
          title: section.title,
          description: section.description,
          kind: pickSectionKind(section.kind),
          sortOrder: sectionIndex,
        },
      });

      for (const question of section.questions || []) {
        const questionType = pickQuestionType(question.questionType);
        const savedQuestion = await tx.question.create({
          data: {
            assessmentId: assessment.id,
            sectionId: savedSection.id,
            code: question.code?.trim() || null,
            prompt: question.prompt,
            questionType,
            category: question.category?.trim() || null,
            trait: question.trait?.trim().toLowerCase() || null,
            reverse: Boolean(question.reverse),
            scaleMin: question.scaleMin ?? 1,
            scaleMax: question.scaleMax ?? 5,
            sortOrder: questionCount,
          },
          select: { id: true },
        });

        questionCount += 1;

        if (questionType !== "SJT_SINGLE") continue;

        const options = question.options || [];
        for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
          const option = options[optionIndex];
          const savedOption = await tx.questionOption.create({
            data: {
              questionId: savedQuestion.id,
              code: option.code?.trim() || `option_${optionIndex + 1}`,
              text: option.text,
              displayOrder: optionIndex,
            },
            select: { id: true },
          });

          for (const impact of option.impacts || []) {
            const impactCode = toCode(impact.competencyCode || "");
            if (!impactCode) continue;

            let assessmentCompetencyId = competencyMap.get(impactCode);
            if (!assessmentCompetencyId) {
              const autoCompetency = await tx.assessmentCompetency.upsert({
                where: {
                  assessmentId_code: {
                    assessmentId: assessment.id,
                    code: impactCode,
                  },
                },
                create: {
                  assessmentId: assessment.id,
                  code: impactCode,
                  name: titleizeCode(impactCode),
                },
                update: {},
                select: { id: true },
              });
              assessmentCompetencyId = autoCompetency.id;
              competencyMap.set(impactCode, assessmentCompetencyId);
            }

            await tx.optionImpact.create({
              data: {
                optionId: savedOption.id,
                assessmentCompetencyId,
                delta: Number(impact.delta) || 0,
              },
            });
          }
        }
      }
    }

    return {
      id: assessment.id,
      title,
      published: publish,
      sections: payload.sections.length,
      questions: questionCount,
      workflow: payload.policy?.reportWorkflow ?? "AI_STANDARD",
    };
  });

  console.log(created);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
