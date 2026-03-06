"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Section = {
  id: string;
  title: string;
  description?: string | null;
  kind: "PERSONALITY" | "SCENARIO";
  sortOrder: number;
};

type QuestionOption = {
  id: string;
  text: string;
};

type Question = {
  id: string;
  code?: string | null;
  sectionId?: string | null;
  prompt: string;
  questionType: "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";
  category?: string | null;
  scaleMin: number;
  scaleMax: number;
  options: QuestionOption[];
};

type Answer = {
  questionId: string;
  value: number | null;
  optionId: string | null;
  textValue?: string | null;
};

type AnswerState = {
  value?: number;
  optionId?: string;
  textValue?: string;
};

export default function SessionPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = typeof params?.sessionId === "string" ? params.sessionId : "";

  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [assessmentId, setAssessmentId] = useState<string>("");
  const [sessionStatus, setSessionStatus] = useState<"IN_PROGRESS" | "SUBMITTED">("IN_PROGRESS");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  useEffect(() => {
    if (!sessionId) {
      setLoadError("Invalid session id. Please start the assessment again.");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const res = await fetch(`/api/assessment/sessions/${sessionId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || "Could not load assessment session.");
        }
        if (!(data as { questions?: unknown[] }).questions) {
          throw new Error("Session data is incomplete.");
        }

        setAssessmentId((data as { assessmentId: string }).assessmentId);
        setSections((data as { sections?: Section[] }).sections || []);
        setQuestions((data as { questions: Question[] }).questions);
        setSessionStatus(
          (data as { status?: string }).status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS",
        );

        const next: Record<string, AnswerState> = {};
        for (const answer of (data as { answers?: Answer[] }).answers || []) {
          next[answer.questionId] = {
            value: typeof answer.value === "number" ? answer.value : undefined,
            optionId: answer.optionId || undefined,
            textValue: answer.textValue || undefined,
          };
        }
        setAnswers(next);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Could not load session.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [sessionId]);

  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const answer = answers[question.id];
        if (!answer) return false;
        if (question.questionType === "LIKERT_TRAIT") return typeof answer.value === "number";
        if (question.questionType === "SJT_SINGLE") return Boolean(answer.optionId);
        return Boolean(answer.textValue?.trim());
      }).length,
    [answers, questions],
  );
  const isReadOnly = sessionStatus === "SUBMITTED";

  const groupedSections = useMemo(() => {
    if (sections.length === 0) {
      return [
        {
          id: "general",
          title: "Assessment",
          kind: "PERSONALITY" as const,
          questions,
        },
      ];
    }

    return sections.map((section) => ({
      id: section.id,
      title: section.title,
      kind: section.kind,
      questions: questions.filter((question) => question.sectionId === section.id),
    }));
  }, [questions, sections]);

  async function answerLikert(questionId: string, value: number) {
    if (isReadOnly) return;
    setAnswers((prev) => ({ ...prev, [questionId]: { value } }));

    await fetch(`/api/assessment/sessions/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, value }),
    });
  }

  async function answerScenario(questionId: string, optionId: string) {
    if (isReadOnly) return;
    setAnswers((prev) => ({ ...prev, [questionId]: { optionId } }));

    await fetch(`/api/assessment/sessions/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, optionId }),
    });
  }

  async function answerText(questionId: string, textValue: string) {
    if (isReadOnly) return;

    await fetch(`/api/assessment/sessions/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, textValue }),
    });
  }

  async function submit() {
    if (isReadOnly) {
      router.push(`/reports/me/${assessmentId}`);
      return;
    }
    try {
      setSubmitting(true);
      const textSaves = questions
        .filter((question) => question.questionType === "FREE_TEXT")
        .map((question) =>
          fetch(`/api/assessment/sessions/${sessionId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: question.id,
              textValue: answers[question.id]?.textValue || "",
            }),
          }),
        );
      await Promise.all(textSaves);

      const res = await fetch(`/api/assessment/sessions/${sessionId}/submit`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Could not submit assessment.");
      }
      alert((data as { postSubmitMessage?: string }).postSubmitMessage || "Submitted");
      router.push(`/reports/me/${assessmentId}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not submit assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Loading assessment session...</h1>
          <p className="mt-2 text-sm text-slate-600">
            Preparing your questions and saved progress.
          </p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-rose-900">Could not load this session</h1>
          <p className="mt-2 text-sm text-rose-800">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/assessment/current"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Back to Assessment Center
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <header className="rounded-3xl bg-gradient-to-r from-cyan-100 via-sky-50 to-amber-100 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Personality & Behavior Assessment</h1>
        <p className="mt-2 text-sm text-slate-700">
          Progress: {answeredCount}/{questions.length}
        </p>
        {isReadOnly && (
          <p className="mt-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
            This session has already been submitted. Responses are read-only.
          </p>
        )}
        <div className="mt-3 h-2 rounded-full bg-white/80">
          <div
            className="h-2 rounded-full bg-slate-900"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      {groupedSections.map((section, sectionIndex) => (
        <section key={section.id} className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white">
              Section {sectionIndex + 1}
            </span>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{section.kind}</span>
          </div>

          <div className="space-y-4">
            {section.questions.map((question, idx) => (
              <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {question.code ? `${question.code}. ` : `${idx + 1}. `}
                    {question.prompt}
                  </p>
                  {question.category && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">
                      {question.category}
                    </span>
                  )}
                </div>

                {question.questionType === "LIKERT_TRAIT" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Array.from(
                      { length: question.scaleMax - question.scaleMin + 1 },
                      (_, index) => question.scaleMin + index,
                    ).map((value) => (
                      <button
                        key={value}
                        className={`rounded-lg border px-3 py-1 text-sm ${
                          answers[question.id]?.value === value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                        onClick={() => answerLikert(question.id, value)}
                        disabled={isReadOnly}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                ) : question.questionType === "SJT_SINGLE" ? (
                  <div className="mt-4 grid gap-2">
                    {question.options.map((option) => (
                      <button
                        key={option.id}
                        className={`rounded-xl border px-4 py-3 text-left text-sm ${
                          answers[question.id]?.optionId === option.id
                            ? "border-cyan-700 bg-cyan-50"
                            : "border-slate-300 bg-white"
                        }`}
                        onClick={() => answerScenario(question.id, option.id)}
                        disabled={isReadOnly}
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <textarea
                      className="min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none ring-offset-2 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      placeholder="Type your response"
                      value={answers[question.id]?.textValue || ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setAnswers((prev) => ({
                          ...prev,
                          [question.id]: {
                            textValue: nextValue,
                          },
                        }));
                      }}
                      onBlur={(event) => answerText(question.id, event.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <button
        className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50"
        disabled={submitting || (!isReadOnly && answeredCount !== questions.length)}
        onClick={submit}
      >
        {submitting ? "Submitting..." : isReadOnly ? "Go To Report" : "Submit Assessment"}
      </button>
    </main>
  );
}
