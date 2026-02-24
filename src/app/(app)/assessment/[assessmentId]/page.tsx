"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

function formatDateTime(input: string | null | undefined) {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
}

export default function AssessmentStartPage() {
  const router = useRouter();
  const params = useParams<{ assessmentId: string }>();
  const assessmentId =
    typeof params?.assessmentId === "string" ? params.assessmentId : "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startSession() {
    if (!assessmentId) {
      setError("Missing assessment ID. Please return to Assessment Center and try again.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/assessment/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Could not start session.");
      }

      if ((data as { alreadySubmitted?: boolean }).alreadySubmitted) {
        const retestEligibleAt = formatDateTime(
          (data as { retestEligibleAt?: string | null }).retestEligibleAt,
        );

        if (retestEligibleAt) {
          alert(
            `You already submitted this assessment. Retest becomes available on ${retestEligibleAt}. Opening your current report.`,
          );
        } else {
          alert("You already submitted this assessment. Opening your current report.");
        }
        router.push(`/reports/me/${assessmentId}`);
        return;
      }
      if ((data as { sessionId?: string }).sessionId) {
        router.push(`/assessment/session/${(data as { sessionId: string }).sessionId}`);
        return;
      }

      setError("Could not start session. Please try again.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not start session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <section className="rounded-3xl bg-gradient-to-r from-cyan-100 via-sky-50 to-amber-100 p-8">
        <div className="mb-4">
          <Link
            href="/assessment/current"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Back to Assessment Center
          </Link>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">OLQLAB Workstyle Assessment</h1>
        <p className="mt-3 text-slate-700">
          You will answer personality items and practical workplace scenarios. There are no &quot;wrong&quot;
          answers. Choose what best reflects your natural style.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Before you start</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Set aside 10-15 minutes without interruption.</li>
          <li>Respond honestly to maximize insight quality.</li>
          <li>You can complete in one sitting and submit once all questions are answered.</li>
        </ul>

        <button
          className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50"
          onClick={startSession}
          disabled={loading}
        >
          {loading ? "Starting..." : "Begin Assessment"}
        </button>
        {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
      </section>
    </main>
  );
}
