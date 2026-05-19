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
    if (!assessmentId || !userId) {
      setError("Invalid route parameters.");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const res = await fetch(
          `/api/admin/assessments/${assessmentId}/participants/${userId}/responses`,
        );
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || "Could not load responses.");
        }
        setData(payload as ApiPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load responses.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [assessmentId, userId]);

  const participantName = useMemo(() => {
    if (!data?.participant) return "Participant";
    return `${data.participant.firstName} ${data.participant.lastName}`.trim();
  }, [data]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6 md:p-10">
        <section className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-6">
          <h1 className="text-xl font-semibold text-[#101114]">Loading participant responses...</h1>
        </section>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-5xl p-6 md:p-10">
        <section className="rounded-2xl border border-[#101114]/20 bg-[#F4EEE0] p-6">
          <h1 className="text-xl font-semibold text-[#101114]">Could not load responses</h1>
          <p className="mt-2 text-sm text-[#101114]">{error || "Unknown error"}</p>
          <Link
            href={`/admin/assessments/${assessmentId}`}
            className="mt-4 inline-block rounded-xl bg-[#101114] px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Assessment
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <header className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#101114]/55">Response Review</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#101114]">{participantName}</h1>
            <p className="mt-1 text-sm text-[#101114]/72">{data.participant.email}</p>
            <p className="mt-1 text-sm text-[#101114]/72">Assessment: {data.assessment.title}</p>
          </div>
          <Link
            href={`/admin/assessments/${assessmentId}`}
            className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-4 py-2 text-sm font-semibold text-[#101114]/82"
          >
            Back to Assessment
          </Link>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-[#101114]/82 md:grid-cols-4">
          <div className="rounded-lg bg-[#F4EEE0]/60 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#101114]/55">Started</p>
            <p>{data.session.startedAt ? new Date(data.session.startedAt).toLocaleString() : "-"}</p>
          </div>
          <div className="rounded-lg bg-[#F4EEE0]/60 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#101114]/55">Submitted</p>
            <p>{data.session.submittedAt ? new Date(data.session.submittedAt).toLocaleString() : "-"}</p>
          </div>
          <div className="rounded-lg bg-[#F4EEE0]/60 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#101114]/55">Time Taken</p>
            <p>{formatDuration(data.session.durationMs)}</p>
          </div>
          <div className="rounded-lg bg-[#F4EEE0]/60 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-[#101114]/55">Report Status</p>
            <p>{data.report?.status || "Not created"}</p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        {data.responses.map((response, index) => (
          <article key={response.id} className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#101114]/55">
                  {response.section?.title || "Assessment"}
                </p>
                <h2 className="mt-1 font-semibold text-[#101114]">
                  {(response.code || `Q${index + 1}`)}. {response.prompt}
                </h2>
              </div>
              <span className="rounded-full bg-[#F4EEE0] px-2.5 py-1 text-[11px] font-semibold text-[#101114]/72">
                {response.questionType}
              </span>
            </div>

            {response.imageUrl ? (
              <figure className="mt-4 overflow-hidden rounded-xl border border-[#101114]/12 bg-[#F4EEE0]/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={response.imageUrl}
                  alt={response.imageAlt || "Question reference image"}
                  className="max-h-[24rem] w-full object-contain bg-[#F4EEE0]"
                />
                {response.imageCaption ? (
                  <figcaption className="border-t border-[#101114]/12 px-3 py-2 text-sm text-[#101114]/72">
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
                        selected ? "border-[#B5803C]/55 bg-[#F4EEE0]" : "border-[#101114]/12 bg-[#F4EEE0]/60"
                      }`}
                    >
                      <span className="mr-2 font-semibold text-[#101114]/72">{option.code}.</span>
                      {option.text}
                      {selected ? <span className="ml-2 text-xs font-semibold text-[#B5803C]">(Selected)</span> : null}
                    </div>
                  );
                })}
              </div>
            ) : response.questionType === "LIKERT_TRAIT" ? (
              <p className="mt-4 text-sm text-[#101114]/82">
                Selected value: <strong>{response.answer.value ?? "-"}</strong>
              </p>
            ) : (
              <div className="mt-4 rounded-xl border border-[#101114]/12 bg-[#F4EEE0]/60 p-3 text-sm text-[#101114]/82 whitespace-pre-wrap">
                {response.answer.textValue || "No response"}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
