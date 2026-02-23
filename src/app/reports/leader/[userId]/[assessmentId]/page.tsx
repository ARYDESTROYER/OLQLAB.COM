"use client";

import { useEffect, useState } from "react";

export default function LeaderReportPage({ params }: { params: { userId: string; assessmentId: string } }) {
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    fetch(`/api/reports/leader/${params.userId}/${params.assessmentId}`).then((r) => r.json()).then(setData);
  }, [params.userId, params.assessmentId]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Leader View</h1>
      <pre className="mt-4 overflow-auto rounded border bg-white p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
