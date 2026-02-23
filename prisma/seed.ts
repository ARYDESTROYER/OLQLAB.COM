import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "demo-tenant" },
    update: {
      name: "Demo Corp",
      seatLimit: 50,
    },
    create: {
      id: "demo-tenant",
      name: "Demo Corp",
      seatLimit: 50,
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

  const competencyInputs = [
    {
      code: "emotional_intelligence",
      name: "Emotional Intelligence",
      description: "Recognizes and responds effectively to emotions.",
    },
    {
      code: "collaboration",
      name: "Collaboration",
      description: "Builds productive working relationships.",
    },
    {
      code: "adaptability",
      name: "Adaptability",
      description: "Adjusts well to changing priorities and contexts.",
    },
  ];

  const competencyByCode = new Map<string, string>();
  for (const competency of competencyInputs) {
    const saved = await prisma.competency.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: competency.code,
        },
      },
      update: {
        name: competency.name,
        description: competency.description,
      },
      create: {
        tenantId: tenant.id,
        code: competency.code,
        name: competency.name,
        description: competency.description,
      },
    });
    competencyByCode.set(saved.code, saved.id);
  }

  const assessment = await prisma.assessment.upsert({
    where: { id: "demo-assessment" },
    update: {
      tenantId: tenant.id,
      title: "Workstyle & Personality Baseline",
      isPublished: true,
    },
    create: {
      id: "demo-assessment",
      tenantId: tenant.id,
      title: "Workstyle & Personality Baseline",
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

  await prisma.question.deleteMany({ where: { assessmentId: assessment.id } });
  await prisma.assessmentSection.deleteMany({ where: { assessmentId: assessment.id } });

  const personalitySection = await prisma.assessmentSection.create({
    data: {
      assessmentId: assessment.id,
      title: "Personality Profile",
      kind: "PERSONALITY",
      sortOrder: 0,
    },
  });

  const scenarioSection = await prisma.assessmentSection.create({
    data: {
      assessmentId: assessment.id,
      title: "Workplace Scenarios",
      kind: "SCENARIO",
      sortOrder: 1,
    },
  });

  const personalityQuestions = [
    ["openness", "I enjoy experimenting with new work methods."],
    ["openness", "I like exploring unfamiliar ideas."],
    ["conscientiousness", "I keep task lists and follow through."],
    ["conscientiousness", "I stay organized even under pressure."],
    ["extraversion", "I proactively start conversations at work."],
    ["agreeableness", "I try to understand coworkers before disagreeing."],
    ["neuroticism", "I worry about mistakes more than most people."],
  ] as const;

  let sortOrder = 0;
  for (const [trait, prompt] of personalityQuestions) {
    await prisma.question.create({
      data: {
        assessmentId: assessment.id,
        sectionId: personalitySection.id,
        questionType: "LIKERT_TRAIT",
        category: "Personality",
        trait,
        prompt,
        reverse: false,
        scaleMin: 1,
        scaleMax: 5,
        sortOrder,
      },
    });
    sortOrder += 1;
  }

  const scenarioQuestion = await prisma.question.create({
    data: {
      assessmentId: assessment.id,
      sectionId: scenarioSection.id,
      questionType: "SJT_SINGLE",
      category: "Emotional Intelligence",
      prompt: "Your colleague tells you they are emotionally distressed. What do you do first?",
      sortOrder,
    },
  });

  const optionA = await prisma.questionOption.create({
    data: {
      questionId: scenarioQuestion.id,
      code: "option_a",
      text: "Console them, listen actively, and help them find support.",
      displayOrder: 0,
    },
  });
  const optionB = await prisma.questionOption.create({
    data: {
      questionId: scenarioQuestion.id,
      code: "option_b",
      text: "Tell them to toughen up and continue working.",
      displayOrder: 1,
    },
  });

  await prisma.optionImpact.createMany({
    data: [
      {
        optionId: optionA.id,
        competencyId: competencyByCode.get("emotional_intelligence")!,
        delta: 1,
      },
      {
        optionId: optionA.id,
        competencyId: competencyByCode.get("collaboration")!,
        delta: 1,
      },
      {
        optionId: optionB.id,
        competencyId: competencyByCode.get("emotional_intelligence")!,
        delta: -1,
      },
      {
        optionId: optionB.id,
        competencyId: competencyByCode.get("collaboration")!,
        delta: -1,
      },
    ],
  });

  console.log({
    tenantId: tenant.id,
    adminEmail: admin.email,
    assessmentId: assessment.id,
    competencyCount: competencyInputs.length,
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
