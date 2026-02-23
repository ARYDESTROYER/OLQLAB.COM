import { PrismaClient } from "@prisma/client";
import { recommendedTemplate40 } from "../src/lib/recommended-template";

const prisma = new PrismaClient();

function normalizeCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");
}

function parseImpacts(raw: string) {
  return raw
    .split(/[|,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((token) => {
      const [code, delta] = token.split(":");
      return {
        competencyCode: normalizeCode(code || ""),
        delta: Number(delta),
      };
    })
    .filter((item) => item.competencyCode && Number.isFinite(item.delta));
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "demo-tenant" },
    update: {
      name: "Demo Corp",
      seatLimit: 250,
    },
    create: {
      id: "demo-tenant",
      name: "Demo Corp",
      seatLimit: 250,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@democorp.com" },
    update: {
      role: "ADMIN",
      tenantId: tenant.id,
    },
    create: {
      email: "admin@democorp.com",
      firstName: "Demo",
      lastName: "Admin",
      role: "ADMIN",
      tenantId: tenant.id,
    },
  });

  await prisma.seat.upsert({
    where: { tenantId_userEmail: { tenantId: tenant.id, userEmail: admin.email } },
    update: { assigned: true },
    create: { tenantId: tenant.id, userEmail: admin.email, assigned: true },
  });

  const assessment = await prisma.assessment.upsert({
    where: { id: "demo-assessment" },
    update: {
      tenantId: tenant.id,
      title: recommendedTemplate40.title,
      isPublished: true,
    },
    create: {
      id: "demo-assessment",
      tenantId: tenant.id,
      title: recommendedTemplate40.title,
      isPublished: true,
    },
  });

  await prisma.assessmentPolicy.upsert({
    where: { assessmentId: assessment.id },
    update: {
      showResultsToEmployee: true,
      resultReleaseDelayHours: 0,
      postSubmitMessage: "Thanks for completing your assessment.",
      leaderCanViewFullReport: true,
    },
    create: {
      assessmentId: assessment.id,
      showResultsToEmployee: true,
      resultReleaseDelayHours: 0,
      postSubmitMessage: "Thanks for completing your assessment.",
      leaderCanViewFullReport: true,
    },
  });

  const competencyMap = new Map<string, string>();
  for (const competency of recommendedTemplate40.competencies) {
    const code = normalizeCode(competency.code);
    const saved = await prisma.competency.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code,
        },
      },
      create: {
        tenantId: tenant.id,
        code,
        name: competency.name,
        description: competency.description,
      },
      update: {
        name: competency.name,
        description: competency.description,
      },
    });
    competencyMap.set(code, saved.id);
  }

  await prisma.question.deleteMany({ where: { assessmentId: assessment.id } });
  await prisma.assessmentSection.deleteMany({ where: { assessmentId: assessment.id } });

  const sectionMap = new Map<string, string>();
  let sectionOrder = 0;
  for (const question of recommendedTemplate40.questions) {
    const key = `${question.sectionKind}::${question.sectionTitle}`;
    if (!sectionMap.has(key)) {
      const section = await prisma.assessmentSection.create({
        data: {
          assessmentId: assessment.id,
          title: question.sectionTitle,
          kind: question.sectionKind,
          sortOrder: sectionOrder,
        },
      });
      sectionMap.set(key, section.id);
      sectionOrder += 1;
    }
  }

  let questionOrder = 0;
  for (const templateQuestion of recommendedTemplate40.questions) {
    const sectionId = sectionMap.get(
      `${templateQuestion.sectionKind}::${templateQuestion.sectionTitle}`,
    );

    const savedQuestion = await prisma.question.create({
      data: {
        assessmentId: assessment.id,
        sectionId,
        code: templateQuestion.code,
        prompt: templateQuestion.prompt,
        questionType: templateQuestion.type,
        category: templateQuestion.category,
        trait: templateQuestion.trait || null,
        reverse: templateQuestion.reverse,
        scaleMin: templateQuestion.scaleMin,
        scaleMax: templateQuestion.scaleMax,
        sortOrder: questionOrder,
      },
    });

    questionOrder += 1;

    if (templateQuestion.type !== "SJT_SINGLE") continue;

    for (let idx = 0; idx < templateQuestion.options.length; idx += 1) {
      const option = templateQuestion.options[idx];
      const savedOption = await prisma.questionOption.create({
        data: {
          questionId: savedQuestion.id,
          code: `opt_${idx + 1}`,
          text: option.text,
          displayOrder: idx,
        },
      });

      const impacts = parseImpacts(option.impacts);
      for (const impact of impacts) {
        const competencyId = competencyMap.get(impact.competencyCode);
        if (!competencyId) continue;

        await prisma.optionImpact.create({
          data: {
            optionId: savedOption.id,
            competencyId,
            delta: impact.delta,
          },
        });
      }
    }
  }

  console.log({
    tenantId: tenant.id,
    adminEmail: admin.email,
    assessmentId: assessment.id,
    questionCount: recommendedTemplate40.questions.length,
    competencyCount: recommendedTemplate40.competencies.length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
