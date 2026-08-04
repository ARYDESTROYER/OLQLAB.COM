"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ASSESSMENT_RESPONSE_ACKNOWLEDGEMENT } from "@/lib/assessment-response-acknowledgement";

function formatDateTime(input: string | null | undefined) {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(undefined, { timeZoneName: "short" });
}

export default function StartAssessmentButton({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  async function startSession() {
    if (!assessmentId) {
      setError("Missing assessment ID. Please return to Assessment Center and try again.");
      return;
    }
    if (!acknowledged) {
      setError("Please acknowledge response processing before starting.");
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
        body: JSON.stringify({ assessmentId, acknowledged: true }),
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
    <div className="mt-6 space-y-4">
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300 accent-slate-900"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>{ASSESSMENT_RESPONSE_ACKNOWLEDGEMENT.text}</span>
      </label>
      <p className="text-xs text-slate-500">You can leave this page without starting the assessment.</p>
      <button
        type="button"
        className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={startSession}
        disabled={loading || !acknowledged}
      >
        {loading ? "Starting..." : "Begin Assessment"}
      </button>
      {error ? <p className="text-sm font-medium text-rose-700" role="alert">{error}</p> : null}
    </div>
  );
}
