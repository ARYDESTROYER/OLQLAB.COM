"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AssessmentStartPage({ params }: { params: { assessmentId: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function startSession() {
    setLoading(true);
    const res = await fetch("/api/assessment/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId: params.assessmentId }),
    });
    const data = await res.json();
    if (data.sessionId) {
      router.push(`/assessment/session/${data.sessionId}`);
    }
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Personality Assessment</h1>
      <p className="mt-2 text-slate-600">Complete all statements from 1 (strongly disagree) to 5 (strongly agree).</p>
      <button
        className="mt-6 rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        onClick={startSession}
        disabled={loading}
      >
        {loading ? "Starting..." : "Start"}
      </button>
    </main>
  );
}
