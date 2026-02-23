"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  sectionId?: string | null;
  prompt: string;
  questionType: "LIKERT_TRAIT" | "SJT_SINGLE";
  category?: string | null;
  scaleMin: number;
  scaleMax: number;
  options: QuestionOption[];
};

type Answer = {
  questionId: string;
  value: number | null;
  optionId: string | null;
};

type AnswerState = {
  value?: number;
  optionId?: string;
};

export default function SessionPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();

  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [assessmentId, setAssessmentId] = useState<string>("");
  const [sessionStatus, setSessionStatus] = useState<"IN_PROGRESS" | "SUBMITTED">("IN_PROGRESS");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/assessment/sessions/${params.sessionId}`);
      const data = await res.json();
      if (!data.questions) return;

      setAssessmentId(data.assessmentId);
      setSections(data.sections || []);
      setQuestions(data.questions);
      setSessionStatus(data.status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS");

      const next: Record<string, AnswerState> = {};
      for (const answer of data.answers as Answer[]) {
        next[answer.questionId] = {
          value: typeof answer.value === "number" ? answer.value : undefined,
          optionId: answer.optionId || undefined,
        };
      }
      setAnswers(next);
      setLoading(false);
    };

    run();
  }, [params.sessionId]);

  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const answer = answers[question.id];
        if (!answer) return false;
        if (question.questionType === "LIKERT_TRAIT") return typeof answer.value === "number";
        return Boolean(answer.optionId);
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

    await fetch(`/api/assessment/sessions/${params.sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, value }),
    });
  }

  async function answerScenario(questionId: string, optionId: string) {
    if (isReadOnly) return;
    setAnswers((prev) => ({ ...prev, [questionId]: { optionId } }));

    await fetch(`/api/assessment/sessions/${params.sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, optionId }),
    });
  }

  async function submit() {
    if (isReadOnly) {
      router.push(`/reports/me/${assessmentId}`);
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/assessment/sessions/${params.sessionId}/submit`, {
      method: "POST",
    });
    const data = await res.json();
    alert(data.postSubmitMessage || "Submitted");
    router.push(`/reports/me/${assessmentId}`);
  }

  if (loading) return <main className="p-8">Loading session...</main>;

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
                    {idx + 1}. {question.prompt}
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
                ) : (
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
