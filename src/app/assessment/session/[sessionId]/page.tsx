"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Question = { id: string; prompt: string };
type Answer = { questionId: string; value: number };

export default function SessionPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [assessmentId, setAssessmentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/assessment/sessions/${params.sessionId}`);
      const data = await res.json();
      if (!data.questions) return;
      setQuestions(data.questions);
      setAssessmentId(data.assessmentId);
      const next: Record<string, number> = {};
      for (const a of data.answers as Answer[]) next[a.questionId] = a.value;
      setAnswers(next);
      setLoading(false);
    };
    run();
  }, [params.sessionId]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v >= 1 && v <= 5).length,
    [answers],
  );

  async function setAnswer(questionId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    await fetch(`/api/assessment/sessions/${params.sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, value }),
    });
  }

  async function submit() {
    setSubmitting(true);
    const res = await fetch(`/api/assessment/sessions/${params.sessionId}/submit`, {
      method: "POST",
    });
    const data = await res.json();
    alert(data.postSubmitMessage || "Submitted");
    router.push(`/reports/me/${assessmentId}`);
  }

  if (loading) return <main className="p-8">Loading...</main>;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Assessment Session</h1>
      <p className="mt-2 text-sm text-slate-600">Answered {answeredCount} of {questions.length}</p>
      <div className="mt-6 space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="rounded border bg-white p-4">
            <p className="font-medium">{idx + 1}. {q.prompt}</p>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`rounded border px-3 py-1 ${answers[q.id] === n ? "bg-slate-900 text-white" : "bg-white"}`}
                  onClick={() => setAnswer(q.id, n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        className="mt-6 rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
        disabled={submitting || answeredCount !== questions.length}
        onClick={submit}
      >
        Submit Assessment
      </button>
    </main>
  );
}
