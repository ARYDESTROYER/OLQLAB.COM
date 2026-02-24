import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BACKFILL_TAG = "backfill_20260224100000_global_assessment_enrollments";

async function main() {
  const deleteEnrollments = await prisma.assessmentTenantEnrollment.deleteMany({
    where: {
      createdByAdminId: BACKFILL_TAG,
    },
  });

  const competencies = await prisma.assessmentCompetency.findMany({
    where: {
      backfillTag: BACKFILL_TAG,
    },
    select: {
      id: true,
    },
  });

  const competencyIds = competencies.map((item) => item.id);

  let detachedImpactsCount = 0;
  let deletedCompetenciesCount = 0;

  if (competencyIds.length > 0) {
    const detachedImpacts = await prisma.optionImpact.updateMany({
      where: {
        assessmentCompetencyId: {
          in: competencyIds,
        },
      },
      data: {
        assessmentCompetencyId: null,
      },
    });

    detachedImpactsCount = detachedImpacts.count;

    const deletedCompetencies = await prisma.assessmentCompetency.deleteMany({
      where: {
        id: {
          in: competencyIds,
        },
      },
    });

    deletedCompetenciesCount = deletedCompetencies.count;
  }

  console.log({
    backfillTag: BACKFILL_TAG,
    deletedEnrollments: deleteEnrollments.count,
    detachedImpacts: detachedImpactsCount,
    deletedCompetencies: deletedCompetenciesCount,
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
