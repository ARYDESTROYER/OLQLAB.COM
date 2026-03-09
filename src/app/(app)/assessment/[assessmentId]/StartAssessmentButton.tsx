"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatDateTime(input: string | null | undefined) {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
}

export default function StartAssessmentButton({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
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
    <>
      <button
        className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50"
        onClick={startSession}
        disabled={loading}
      >
        {loading ? "Starting..." : "Begin Assessment"}
      </button>
      {error ? <p className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
    </>
  );
}