"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Data = {
  error?: string;
  submittedAt?: string | null;
  assessment?: {
    id: string;
    title: string;
  };
  employee?: { firstName: string; lastName: string; email: string };
  narrative?: {
    profileHeadline?: string;
    summary?: string;
    strengths?: string[];
    growthAreas?: string[];
    actions?: string[];
    workplaceSignals?: string[];
    managerDiscussionGuide?: string[];
    assessmentTakenAt?: string;
    adminEditedHtml?: string;
    aiNarrative?: {
      executiveSummary?: string;
      managerCoaching?: string;
      improvementRoadmap?: string[];
    };
  };
};

function formatDateTime(input?: string | null) {
  if (!input) return "Not available";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default function LeaderReportPage() {
  const params = useParams<{ userId: string; assessmentId: string }>();
  const userId = typeof params?.userId === "string" ? params.userId : "";
  const assessmentId =
    typeof params?.assessmentId === "string" ? params.assessmentId : "";
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId || !assessmentId) return;
    const run = async () => {
      try {
        const res = await fetch(`/api/reports/leader/${userId}/${assessmentId}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || "Could not load leader report.");
        }
        setData(payload as Data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load leader report.");
      }
    };
    run();
  }, [userId, assessmentId]);

  if (!userId || !assessmentId) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-[#101114]/20 bg-[#F4EEE0] p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#101114]">Invalid report route</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl bg-[#101114] px-4 py-2 text-sm font-semibold text-white">
              Dashboard
            </Link>
            <Link href="/reports/current" className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-4 py-2 text-sm font-semibold text-[#101114]/82">
              My Reports
            </Link>
          </div>
        </section>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-[#101114]/20 bg-[#F4EEE0] p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#101114]">Could not load leader report</h1>
          <p className="mt-2 text-sm text-[#101114]">{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl bg-[#101114] px-4 py-2 text-sm font-semibold text-white">
              Dashboard
            </Link>
            <Link href="/reports/current" className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-4 py-2 text-sm font-semibold text-[#101114]/82">
              My Reports
            </Link>
          </div>
        </section>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#101114]">Loading leader report...</h1>
        </section>
      </main>
    );
  }
  if (data.error) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-[#B5803C]/40 bg-[#F4EEE0] p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#B5803C]">{data.error}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl bg-[#101114] px-4 py-2 text-sm font-semibold text-white">
              Dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const strengths = data.narrative?.strengths || [];
  const growthAreas = data.narrative?.growthAreas || [];
  const actions = data.narrative?.actions || [];
  const workplaceSignals = data.narrative?.workplaceSignals || [];
  const managerGuide = data.narrative?.managerDiscussionGuide || [];

  const takenAt = formatDateTime(
    data.narrative?.assessmentTakenAt || data.submittedAt || null,
  );

  const adminEditedHtml = data.narrative?.adminEditedHtml?.trim() || "";
  if (adminEditedHtml) {
    return (
      <main className="mx-auto max-w-5xl p-5 md:p-9 space-y-5">
        <header className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-[#101114]">
            {data.employee?.firstName} {data.employee?.lastName}
          </h1>
          <p className="mt-1 text-sm text-[#101114]/82">{data.assessment?.title || "Assessment"}</p>
          <p className="mt-1 text-sm text-[#101114]/72">Test Taken: {takenAt}</p>
        </header>
        <section className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-6 md:p-10 shadow-sm prose prose-sm sm:prose-base lg:prose-lg max-w-none text-[#101114]">
          <div dangerouslySetInnerHTML={{ __html: adminEditedHtml }} />
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-9">
      <header className="rounded-[30px] border border-[#B5803C]/40 bg-gradient-to-r from-sky-100 via-cyan-50 to-lime-100 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#101114]/55">
          Leader View
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#101114]">
          {data.employee?.firstName} {data.employee?.lastName}
        </h1>
        <p className="mt-1 text-sm text-[#101114]/82">{data.employee?.email}</p>
        <p className="mt-4 text-sm text-[#101114]">
          <span className="font-semibold">Assessment:</span>{" "}
          {data.assessment?.title || "Assessment"}
        </p>
        <p className="mt-1 text-sm text-[#101114]">
          <span className="font-semibold">Test Taken:</span> {takenAt}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-3 py-2 text-xs font-semibold text-[#101114]/82"
          >
            Dashboard
          </Link>
          <Link
            href="/reports/current"
            className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-3 py-2 text-xs font-semibold text-[#101114]/82"
          >
            My Reports
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-6">
        <h2 className="text-xl font-semibold text-[#101114]">
          {data.narrative?.profileHeadline || "Development Summary"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#101114]/82">
          {data.narrative?.summary ||
            "Use this report to coach for sustained behavior change through specific examples and weekly feedback cycles."}
        </p>
        {data.narrative?.aiNarrative?.executiveSummary && (
          <p className="mt-3 rounded-xl bg-[#F4EEE0]/60 px-3 py-2 text-sm leading-7 text-[#101114]/82">
            {data.narrative.aiNarrative.executiveSummary}
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[#B5803C]/40 bg-[#F4EEE0] p-5">
          <h3 className="text-lg font-semibold text-[#B5803C]">Strength Signals</h3>
          <ul className="mt-3 space-y-3 text-sm leading-7 text-[#B5803C]">
            {strengths.length > 0 ? (
              strengths.map((item, index) => (
                <li key={`${index}-${item.slice(0, 48)}`} className="rounded-lg bg-[#F4EEE0]/70 px-3 py-2">
                  {item}
                </li>
              ))
            ) : (
              <li className="rounded-lg bg-[#F4EEE0]/70 px-3 py-2">No strength narrative available.</li>
            )}
          </ul>
        </article>

        <article className="rounded-2xl border border-[#B5803C]/40 bg-[#F4EEE0] p-5">
          <h3 className="text-lg font-semibold text-[#B5803C]">Coaching Priorities</h3>
          <ul className="mt-3 space-y-3 text-sm leading-7 text-[#B5803C]">
            {growthAreas.length > 0 ? (
              growthAreas.map((item, index) => (
                <li key={`${index}-${item.slice(0, 48)}`} className="rounded-lg bg-[#F4EEE0]/70 px-3 py-2">
                  {item}
                </li>
              ))
            ) : (
              <li className="rounded-lg bg-[#F4EEE0]/70 px-3 py-2">No growth narrative available.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-6">
        <h3 className="text-xl font-semibold text-[#101114]">Suggested Manager Actions</h3>
        <ol className="mt-3 space-y-3 text-sm leading-7 text-[#101114]/82">
          {actions.length > 0 ? (
            actions.map((item, index) => (
              <li key={`${index}-${item.slice(0, 48)}`} className="flex gap-3 rounded-lg border border-[#101114]/12 bg-[#F4EEE0]/60 px-3 py-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#101114] text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))
          ) : (
            <li className="rounded-lg border border-[#101114]/12 bg-[#F4EEE0]/60 px-3 py-2">
              No manager action plan available.
            </li>
          )}
        </ol>

        {data.narrative?.aiNarrative?.managerCoaching && (
          <p className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm leading-7 text-indigo-950">
            <span className="font-semibold">Coaching note:</span>{" "}
            {data.narrative.aiNarrative.managerCoaching}
          </p>
        )}

        {data.narrative?.aiNarrative?.improvementRoadmap?.length ? (
          <ul className="mt-4 space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm leading-7 text-indigo-950">
            {data.narrative.aiNarrative.improvementRoadmap.map((item, index) => (
              <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {(workplaceSignals.length > 0 || managerGuide.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-5">
            <h3 className="text-lg font-semibold text-[#101114]">Workplace Signals</h3>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-[#101114]/82">
              {workplaceSignals.map((item, index) => (
                <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-5">
            <h3 className="text-lg font-semibold text-[#101114]">Manager Conversation Guide</h3>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-[#101114]/82">
              {managerGuide.length > 0 ? (
                managerGuide.map((item, index) => (
                  <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
                ))
              ) : (
                <li>
                  Use concrete examples from recent projects, agree one weekly behavior target, and
                  revisit in a fixed coaching cadence.
                </li>
              )}
            </ul>
          </article>
        </section>
      )}
    </main>
  );
}
