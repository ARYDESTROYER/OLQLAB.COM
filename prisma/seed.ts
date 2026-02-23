import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "demo-tenant" },
    update: {},
    create: {
      id: "demo-tenant",
      name: "Demo Corp",
      seatLimit: 50,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@democorp.com" },
    update: {},
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

  const assessment = await prisma.assessment.create({
    data: {
      tenantId: tenant.id,
      title: "Big Five Workplace Baseline",
      isPublished: true,
      policy: {
        create: {
          showResultsToEmployee: true,
          resultReleaseDelayHours: 0,
          postSubmitMessage: "Thanks for completing your assessment.",
          leaderCanViewFullReport: true,
        },
      },
    },
  });

  const questions = [
    ["openness", "I enjoy experimenting with new work methods."],
    ["openness", "I like exploring unfamiliar ideas."],
    ["conscientiousness", "I keep task lists and follow through."],
    ["conscientiousness", "I stay organized even under pressure."],
    ["extraversion", "I gain energy from group discussions."],
    ["extraversion", "I proactively start conversations at work."],
    ["agreeableness", "I try to understand coworkers before disagreeing."],
    ["agreeableness", "I offer help when teammates are overloaded."],
    ["neuroticism", "I feel stressed when priorities change suddenly."],
    ["neuroticism", "I worry about mistakes more than most people."],
  ] as const;

  await prisma.question.createMany({
    data: questions.map((q, idx) => ({
      assessmentId: assessment.id,
      trait: q[0],
      prompt: q[1],
      sortOrder: idx,
      reverse: false,
    })),
  });

  console.log({ tenantId: tenant.id, adminEmail: admin.email, assessmentId: assessment.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
