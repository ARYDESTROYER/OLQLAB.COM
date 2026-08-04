"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type ApiPayload = {
  assessment: {
    id: string;
    title: string;
  };
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  session: {
    id: string;
    status: string;
    startedAt: string | null;
    submittedAt: string | null;
    durationMs: number | null;
  };
  report: {
    id: string;
    status: string;
    availableAt: string | null;
    deliveryMethod: "DASHBOARD_ONLY" | "EMAIL_LINK" | null;
    hasManualPdf: boolean;
    manualPdf: {
      fileName: string;
      sizeBytes: number;
      updatedAt: string;
    } | null;
  } | null;
  responses: Array<{
    id: string;
    code: string | null;
    prompt: string;
    imageUrl: string | null;
    imageAlt: string | null;
    imageCaption: string | null;
    questionType: "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";
    section: {
      id: string;
      title: string;
    } | null;
    options: Array<{
      id: string;
      code: string;
      text: string;
      displayOrder: number;
    }>;
    answer: {
      value: number | null;
      optionId: string | null;
      optionCode: string | null;
      optionText: string | null;
      textValue: string | null;
    };
  }>;
};

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs <= 0) return "Not available";
  const totalMinutes = Math.round(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} hr ${minutes} min`;
}

export default function ParticipantResponsesPage() {
  const params = useParams<{ id: string; userId: string }>();
  const assessmentId = typeof params?.id === "string" ? params.id : "";
  const userId = typeof params?.userId === "string" ? params.userId : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ApiPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!assessmentId || !userId) {
      setError("Invalid route parameters.");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;
        setLoading(true);
        setError("");
        setData(null);
        const res = await fetch(
          `/api/admin/assessments/${assessmentId}/participants/${userId}/responses`,
          { signal: controller.signal },
        );
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || "Could not load responses.");
        }
        setData(payload as ApiPayload);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load responses.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [assessmentId, userId]);

  const participantName = useMemo(() => {
    if (!data?.participant) return "Participant";
    return `${data.participant.firstName} ${data.participant.lastName}`.trim();
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-900">Loading participant responses...</h1>
        </section>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-xl font-semibold text-rose-900">Could not load responses</h1>
          <p className="mt-2 text-sm text-rose-700">{error || "Unknown error"}</p>
          <Link
            href={`/admin/assessments/${assessmentId}`}
            className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Assessment
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Response Review</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{participantName}</h1>
            <p className="mt-1 text-sm text-slate-600">{data.participant.email}</p>
            <p className="mt-1 text-sm text-slate-600">Assessment: {data.assessment.title}</p>
          </div>
          <Link
            href={`/admin/assessments/${assessmentId}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back to Assessment
          </Link>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Started</p>
            <p>{data.session.startedAt ? new Date(data.session.startedAt).toLocaleString() : "-"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Submitted</p>
            <p>{data.session.submittedAt ? new Date(data.session.submittedAt).toLocaleString() : "-"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Time Taken</p>
            <p>{formatDuration(data.session.durationMs)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Report Status</p>
            <p>{data.report?.status || "Not created"}</p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        {data.responses.map((response, index) => (
          <article key={response.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {response.section?.title || "Assessment"}
                </p>
                <h2 className="mt-1 font-semibold text-slate-900">
                  {(response.code || `Q${index + 1}`)}. {response.prompt}
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {response.questionType}
              </span>
            </div>

            {response.imageUrl ? (
              <figure className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={response.imageUrl}
                  alt={response.imageAlt || "Question reference image"}
                  loading="lazy"
                  decoding="async"
                  crossOrigin={response.imageUrl.startsWith("https://") ? "anonymous" : undefined}
                  referrerPolicy="no-referrer"
                  className="max-h-[24rem] w-full object-contain bg-white"
                />
                {response.imageCaption ? (
                  <figcaption className="border-t border-slate-200 px-3 py-2 text-sm text-slate-600">
                    {response.imageCaption}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}

            {response.questionType === "SJT_SINGLE" ? (
              <div className="mt-4 space-y-2">
                {response.options.map((option) => {
                  const selected = response.answer.optionId === option.id;
                  return (
                    <div
                      key={option.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        selected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <span className="mr-2 font-semibold text-slate-600">{option.code}.</span>
                      {option.text}
                      {selected ? <span className="ml-2 text-xs font-semibold text-emerald-700">(Selected)</span> : null}
                    </div>
                  );
                })}
              </div>
            ) : response.questionType === "LIKERT_TRAIT" ? (
              <p className="mt-4 text-sm text-slate-700">
                Selected value: <strong>{response.answer.value ?? "-"}</strong>
              </p>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                {response.answer.textValue || "No response"}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
