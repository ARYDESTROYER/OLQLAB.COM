"use client";

import { useEffect, useState } from "react";

type Data = {
  error?: string;
  employee?: { firstName: string; lastName: string; email: string };
  score?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    competencyJson?: Array<{ code: string; name: string; score: number }>;
  };
  narrative?: {
    summary?: string;
    strengths?: string[];
    growthAreas?: string[];
    actions?: string[];
  };
};

export default function LeaderReportPage({ params }: { params: { userId: string; assessmentId: string } }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch(`/api/reports/leader/${params.userId}/${params.assessmentId}`)
      .then((r) => r.json())
      .then(setData);
  }, [params.userId, params.assessmentId]);

  if (!data) return <main className="p-8">Loading...</main>;
  if (data.error) return <main className="p-8">{data.error}</main>;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <header className="rounded-3xl bg-gradient-to-r from-sky-100 via-cyan-50 to-lime-100 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Leader View</h1>
        <p className="mt-1 text-sm text-slate-700">
          {data.employee?.firstName} {data.employee?.lastName} ({data.employee?.email})
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Trait Snapshot</h2>
        <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(data.score, null, 2)}</pre>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="font-semibold">Strength Signals</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {(data.narrative?.strengths || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold">Coaching Opportunities</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {(data.narrative?.growthAreas || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Suggested Manager Actions</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {(data.narrative?.actions || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
