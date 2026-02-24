import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BACKFILL_TAG = "backfill_20260224100000_global_assessment_enrollments";

async function main() {
  await prisma.$executeRawUnsafe(`
    UPDATE "Assessment"
    SET "ownerTenantId" = "tenantId"
    WHERE "ownerTenantId" IS NULL
      AND "tenantId" IS NOT NULL
  `);

  const assessmentsWithTenant = await prisma.assessment.findMany({
    where: {
      tenantId: { not: null },
    },
    select: {
      id: true,
      tenantId: true,
    },
  });

  let enrollmentCount = 0;
  for (const assessment of assessmentsWithTenant) {
    if (!assessment.tenantId) continue;
    await prisma.assessmentTenantEnrollment.upsert({
      where: {
        assessmentId_tenantId: {
          assessmentId: assessment.id,
          tenantId: assessment.tenantId,
        },
      },
      create: {
        assessmentId: assessment.id,
        tenantId: assessment.tenantId,
        includeFutureUsers: true,
        active: true,
        createdByAdminId: BACKFILL_TAG,
      },
      update: {
        active: true,
      },
    });
    enrollmentCount += 1;
  }

  const impacts = await prisma.optionImpact.findMany({
    where: {
      assessmentCompetencyId: null,
      competencyId: { not: null },
    },
    select: {
      id: true,
      competency: {
        select: {
          code: true,
          name: true,
          description: true,
        },
      },
      option: {
        select: {
          question: {
            select: {
              assessmentId: true,
            },
          },
        },
      },
    },
  });

  let competencyCount = 0;
  let mappedImpactCount = 0;

  for (const impact of impacts) {
    const competency = impact.competency;
    const assessmentId = impact.option.question.assessmentId;
    if (!competency) continue;

    const saved = await prisma.assessmentCompetency.upsert({
      where: {
        assessmentId_code: {
          assessmentId,
          code: competency.code,
        },
      },
      create: {
        assessmentId,
        code: competency.code,
        name: competency.name,
        description: competency.description,
        backfillTag: BACKFILL_TAG,
      },
      update: {},
      select: {
        id: true,
      },
    });

    await prisma.optionImpact.update({
      where: { id: impact.id },
      data: {
        assessmentCompetencyId: saved.id,
      },
    });

    mappedImpactCount += 1;
    competencyCount += 1;
  }

  console.log({
    backfillTag: BACKFILL_TAG,
    assessmentsSeen: assessmentsWithTenant.length,
    enrollmentsUpserted: enrollmentCount,
    impactsSeen: impacts.length,
    impactsMapped: mappedImpactCount,
    competenciesTouched: competencyCount,
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
