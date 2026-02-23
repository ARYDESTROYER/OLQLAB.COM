import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function CurrentAssessmentPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.tenantId) redirect("/signin");

  const assessment = await db.assessment.findFirst({
    where: {
      tenantId: session.user.tenantId,
      isPublished: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!assessment) {
    return <main className="p-8">No published assessment is available.</main>;
  }

  redirect(`/assessment/${assessment.id}`);
}
