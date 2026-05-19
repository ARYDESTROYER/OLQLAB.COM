import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DEFAULT_ASSESSMENT_INTRO_BULLETS,
  DEFAULT_ASSESSMENT_INTRO_DESCRIPTION,
} from "@/lib/assessment-intro";
import { resolveAssessmentAccess } from "@/lib/assessment-access";
import { runDueUnenrollJobs } from "@/lib/unenroll-jobs";
import StartAssessmentButton from "./StartAssessmentButton";

export default async function AssessmentStartPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/signin");

  const { assessmentId } = await params;

  await runDueUnenrollJobs({ userId: session.user.id });

  const access = await resolveAssessmentAccess(session.user.id, assessmentId);
  if (!access.canStartAssessment) {
    redirect("/assessment/current");
  }

  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      policy: {
        select: {
          introDescription: true,
          introBullets: true,
        },
      },
    },
  });

  if (!assessment) {
    redirect("/assessment/current");
  }

  const introDescription =
    assessment.policy?.introDescription || DEFAULT_ASSESSMENT_INTRO_DESCRIPTION;
  const introBullets =
    assessment.policy?.introBullets?.length
      ? assessment.policy.introBullets
      : DEFAULT_ASSESSMENT_INTRO_BULLETS;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <section className="rounded-3xl bg-gradient-to-r from-cyan-100 via-sky-50 to-amber-100 p-8">
        <div className="mb-4">
          <Link
            href="/assessment/current"
            className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-3 py-2 text-xs font-semibold text-[#101114]/82"
          >
            Back to Assessment Center
          </Link>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{assessment.title}</h1>
        <p className="mt-3 text-[#101114]/82">{introDescription}</p>
      </section>

      <section className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-6">
        <h2 className="text-lg font-semibold">Before you start</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#101114]/82">
          {introBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <StartAssessmentButton assessmentId={assessmentId} />
      </section>
    </main>
  );
}
