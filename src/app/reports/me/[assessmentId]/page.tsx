"use client";

import { useEffect, useState } from "react";

type Data = {
  message?: string;
  score?: Record<string, number>;
  narrative?: {
    summary: string;
    strengths: string[];
    growthAreas: string[];
    actions: string[];
  };
};

export default function MyReportPage({ params }: { params: { assessmentId: string } }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch(`/api/reports/me/${params.assessmentId}`).then((r) => r.json()).then(setData);
  }, [params.assessmentId]);

  if (!data) return <main className="p-8">Loading report...</main>;
  if (data.message) return <main className="p-8">{data.message}</main>;

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Your Personality Report</h1>
      <div className="rounded border bg-white p-4">
        <pre className="text-sm">{JSON.stringify(data.score, null, 2)}</pre>
      </div>
      <div className="rounded border bg-white p-4">
        <p>{data.narrative?.summary}</p>
        <h2 className="mt-3 font-semibold">Strengths</h2>
        <ul className="list-disc pl-5">{data.narrative?.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        <h2 className="mt-3 font-semibold">Growth Areas</h2>
        <ul className="list-disc pl-5">{data.narrative?.growthAreas.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
    </main>
  );
}
