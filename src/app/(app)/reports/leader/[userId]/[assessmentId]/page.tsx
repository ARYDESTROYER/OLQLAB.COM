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
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-rose-900">Invalid report route</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Dashboard
            </Link>
            <Link href="/reports/current" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
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
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-rose-900">Could not load leader report</h1>
          <p className="mt-2 text-sm text-rose-800">{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Dashboard
            </Link>
            <Link href="/reports/current" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
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
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Loading leader report...</h1>
        </section>
      </main>
    );
  }
  if (data.error) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-amber-900">{data.error}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
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

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-9">
      <header className="rounded-[30px] border border-cyan-100 bg-gradient-to-r from-sky-100 via-cyan-50 to-lime-100 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Leader View
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          {data.employee?.firstName} {data.employee?.lastName}
        </h1>
        <p className="mt-1 text-sm text-slate-700">{data.employee?.email}</p>
        <p className="mt-4 text-sm text-slate-800">
          <span className="font-semibold">Assessment:</span>{" "}
          {data.assessment?.title || "Assessment"}
        </p>
        <p className="mt-1 text-sm text-slate-800">
          <span className="font-semibold">Test Taken:</span> {takenAt}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Dashboard
          </Link>
          <Link
            href="/reports/current"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            My Reports
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">
          {data.narrative?.profileHeadline || "Development Summary"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          {data.narrative?.summary ||
            "Use this report to coach for sustained behavior change through specific examples and weekly feedback cycles."}
        </p>
        {data.narrative?.aiNarrative?.executiveSummary && (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-7 text-slate-700">
            {data.narrative.aiNarrative.executiveSummary}
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-lg font-semibold text-emerald-950">Strength Signals</h3>
          <ul className="mt-3 space-y-3 text-sm leading-7 text-emerald-950">
            {strengths.length > 0 ? (
              strengths.map((item, index) => (
                <li key={`${index}-${item.slice(0, 48)}`} className="rounded-lg bg-white/70 px-3 py-2">
                  {item}
                </li>
              ))
            ) : (
              <li className="rounded-lg bg-white/70 px-3 py-2">No strength narrative available.</li>
            )}
          </ul>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-lg font-semibold text-amber-950">Coaching Priorities</h3>
          <ul className="mt-3 space-y-3 text-sm leading-7 text-amber-950">
            {growthAreas.length > 0 ? (
              growthAreas.map((item, index) => (
                <li key={`${index}-${item.slice(0, 48)}`} className="rounded-lg bg-white/70 px-3 py-2">
                  {item}
                </li>
              ))
            ) : (
              <li className="rounded-lg bg-white/70 px-3 py-2">No growth narrative available.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-xl font-semibold text-slate-900">Suggested Manager Actions</h3>
        <ol className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
          {actions.length > 0 ? (
            actions.map((item, index) => (
              <li key={`${index}-${item.slice(0, 48)}`} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))
          ) : (
            <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
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
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">Workplace Signals</h3>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
              {workplaceSignals.map((item, index) => (
                <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">Manager Conversation Guide</h3>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
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
