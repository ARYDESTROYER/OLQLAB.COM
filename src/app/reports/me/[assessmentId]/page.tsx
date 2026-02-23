"use client";

import { useEffect, useMemo, useState } from "react";

type CompetencyRow = {
  code: string;
  name: string;
  score: number;
};

type TraitKey =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

type Data = {
  message?: string;
  score?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    competencyJson?: CompetencyRow[];
  };
  narrative?: {
    summary: string;
    strengths: string[];
    growthAreas: string[];
    actions: string[];
    competencyBreakdown?: CompetencyRow[];
    aiNarrative?: {
      executiveSummary?: string;
      strengthsNarrative?: string;
      developmentNarrative?: string;
      managerCoaching?: string;
      improvementRoadmap?: string[];
      cautionNotes?: string[];
    };
  };
};

const traitLabels: Array<{ key: TraitKey; label: string }> = [
  { key: "openness", label: "Openness" },
  { key: "conscientiousness", label: "Conscientiousness" },
  { key: "extraversion", label: "Extraversion" },
  { key: "agreeableness", label: "Agreeableness" },
  { key: "neuroticism", label: "Neuroticism" },
];

export default function MyReportPage({ params }: { params: { assessmentId: string } }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch(`/api/reports/me/${params.assessmentId}`).then((r) => r.json()).then(setData);
  }, [params.assessmentId]);

  const competencies = useMemo(() => {
    const fromNarrative = data?.narrative?.competencyBreakdown || [];
    const fromScore = data?.score?.competencyJson || [];
    return (fromNarrative.length > 0 ? fromNarrative : fromScore).slice(0, 10);
  }, [data]);

  if (!data) return <main className="p-8">Loading report...</main>;
  if (data.message) return <main className="p-8">{data.message}</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="rounded-3xl bg-gradient-to-r from-amber-100 via-orange-50 to-cyan-100 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Your Personality Report</h1>
        <p className="mt-2 text-slate-700">{data.narrative?.summary}</p>
        <a
          href={`/api/reports/me/${params.assessmentId}/pdf`}
          className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Download PDF Report
        </a>
      </header>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        {traitLabels.map(({ key, label }) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{label}</span>
              <span>{data.score?.[key] ?? 0}/100</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-slate-800"
                style={{ width: `${Math.max(0, Math.min(100, Number(data.score?.[key] || 0)))}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-lg font-semibold">Strengths</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {data.narrative?.strengths?.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold">Development Areas</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {data.narrative?.growthAreas?.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>
      </section>

      {competencies.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Scenario Competency Scores</h2>
          <div className="mt-4 grid gap-3">
            {competencies.map((item) => (
              <div key={item.code} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{item.name}</span>
                <span className={item.score >= 0 ? "text-emerald-700" : "text-rose-700"}>
                  {item.score >= 0 ? "+" : ""}
                  {item.score}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Action Plan</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {data.narrative?.actions?.map((item) => <li key={item}>{item}</li>)}
        </ol>
      </section>

      {data.narrative?.aiNarrative && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="text-lg font-semibold">AI-Assisted Insight</h2>
          {data.narrative.aiNarrative.executiveSummary && (
            <p className="mt-2 text-sm text-slate-700">{data.narrative.aiNarrative.executiveSummary}</p>
          )}
          {data.narrative.aiNarrative.strengthsNarrative && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Strength context:</span>{" "}
              {data.narrative.aiNarrative.strengthsNarrative}
            </p>
          )}
          {data.narrative.aiNarrative.developmentNarrative && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Development context:</span>{" "}
              {data.narrative.aiNarrative.developmentNarrative}
            </p>
          )}
          {data.narrative.aiNarrative.managerCoaching && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Manager coaching:</span>{" "}
              {data.narrative.aiNarrative.managerCoaching}
            </p>
          )}
          {data.narrative.aiNarrative.improvementRoadmap && (
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
              {data.narrative.aiNarrative.improvementRoadmap.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
