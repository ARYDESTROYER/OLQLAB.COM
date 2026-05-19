"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type QuestionPresentationMode = "ALL_AT_ONCE" | "ONE_AT_A_TIME";

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
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
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

function isQuestionAnswered(question: Question, answer?: AnswerState) {
  if (!answer) return false;
  if (question.questionType === "LIKERT_TRAIT") return typeof answer.value === "number";
  if (question.questionType === "SJT_SINGLE") return Boolean(answer.optionId);
  return Boolean(answer.textValue?.trim());
}

function findInitialQuestionIndex(questions: Question[], answers: Record<string, AnswerState>) {
  const firstUnansweredIndex = questions.findIndex((question) => !isQuestionAnswered(question, answers[question.id]));
  if (firstUnansweredIndex >= 0) return firstUnansweredIndex;
  return Math.max(questions.length - 1, 0);
}

function renderQuestionImage(question: Question) {
  if (!question.imageUrl) return null;

  return (
    <figure className="mt-4 overflow-hidden rounded-2xl border border-[#101114]/12 bg-[#F4EEE0]/60">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={question.imageUrl}
        alt={question.imageAlt || "Question reference image"}
        className="max-h-[28rem] w-full object-contain bg-[#F4EEE0]"
      />
      {question.imageCaption ? (
        <figcaption className="border-t border-[#101114]/12 px-4 py-3 text-sm text-[#101114]/72">
          {question.imageCaption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ sessionId: string }>();
  const sessionId = typeof params?.sessionId === "string" ? params.sessionId : "";
  const isPreviewMode = searchParams.get("preview") === "1";
  const previewReturnTo = searchParams.get("returnTo") || "/admin/assessments";

  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [assessmentId, setAssessmentId] = useState<string>("");
  const [questionPresentationMode, setQuestionPresentationMode] =
    useState<QuestionPresentationMode>("ALL_AT_ONCE");
  const [sessionStatus, setSessionStatus] = useState<"IN_PROGRESS" | "SUBMITTED">("IN_PROGRESS");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [loadError, setLoadError] = useState<string>("");
  const [actionError, setActionError] = useState<string>("");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

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
        setQuestionPresentationMode(
          (data as { questionPresentationMode?: QuestionPresentationMode }).questionPresentationMode ||
            "ALL_AT_ONCE",
        );
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
        setActiveQuestionIndex(findInitialQuestionIndex((data as { questions: Question[] }).questions, next));
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
      questions.filter((question) => isQuestionAnswered(question, answers[question.id])).length,
    [answers, questions],
  );
  const isReadOnly = sessionStatus === "SUBMITTED";
  const isOneQuestionAtATime = questionPresentationMode === "ONE_AT_A_TIME";
  const defaultBackHref = isPreviewMode ? previewReturnTo : "/assessment/current";
  const readOnlyTarget = isPreviewMode
    ? previewReturnTo
    : assessmentId
      ? `/reports/me/${assessmentId}`
      : "/assessment/current";

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

  const activeQuestion = questions[activeQuestionIndex] || null;
  const activeSection = activeQuestion?.sectionId
    ? sections.find((section) => section.id === activeQuestion.sectionId) || null
    : null;

  useEffect(() => {
    if (questions.length === 0) {
      setActiveQuestionIndex(0);
      return;
    }

    setActiveQuestionIndex((prev) => Math.min(prev, questions.length - 1));
  }, [questions.length]);

  async function persistAnswer(payload: {
    questionId: string;
    value?: number;
    optionId?: string;
    textValue?: string;
  }) {
    const res = await fetch(`/api/assessment/sessions/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || "Could not save your answer.");
    }
  }

  async function answerLikert(questionId: string, value: number) {
    if (isReadOnly) return;
    setActionError("");
    setAnswers((prev) => ({ ...prev, [questionId]: { value } }));
    try {
      await persistAnswer({ questionId, value });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save your answer.");
    }
  }

  async function answerScenario(questionId: string, optionId: string) {
    if (isReadOnly) return;
    setActionError("");
    setAnswers((prev) => ({ ...prev, [questionId]: { optionId } }));
    try {
      await persistAnswer({ questionId, optionId });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save your answer.");
    }
  }

  async function answerText(questionId: string, textValue: string) {
    if (isReadOnly) return;
    setActionError("");

    try {
      await persistAnswer({ questionId, textValue });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save your answer.");
      throw error;
    }
  }

  async function flushTextAnswer(question: Question | null) {
    if (!question || question.questionType !== "FREE_TEXT" || isReadOnly) return true;

    const textValue = answers[question.id]?.textValue?.trim() || "";
    if (!textValue) return true;

    try {
      await answerText(question.id, textValue);
      return true;
    } catch {
      return false;
    }
  }

  async function navigateToQuestion(nextIndex: number) {
    if (!isOneQuestionAtATime || questions.length === 0) return;

    const boundedIndex = Math.max(0, Math.min(nextIndex, questions.length - 1));
    if (boundedIndex === activeQuestionIndex) return;

    setNavigating(true);
    try {
      const didFlush = await flushTextAnswer(activeQuestion);
      if (!didFlush) return;
      setActionError("");
      setActiveQuestionIndex(boundedIndex);
    } finally {
      setNavigating(false);
    }
  }

  async function submit() {
    if (isReadOnly) {
      router.push(readOnlyTarget);
      return;
    }
    try {
      setSubmitting(true);
      setActionError("");

      const didFlush = await flushTextAnswer(activeQuestion);
      if (!didFlush) return;

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewMode: isPreviewMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Could not submit assessment.");
      }
      alert((data as { postSubmitMessage?: string }).postSubmitMessage || "Submitted");
      router.push(
        (data as { redirectTo?: string }).redirectTo ||
          (isPreviewMode ? previewReturnTo : `/reports/me/${assessmentId}`),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not submit assessment.");
      alert(error instanceof Error ? error.message : "Could not submit assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderQuestionCard(question: Question, displayIndex: number) {
    return (
      <article key={question.id} className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-[#101114]">
            {question.code ? `${question.code}. ` : `${displayIndex + 1}. `}
            {question.prompt}
          </p>
          {question.category && (
            <span className="rounded-full bg-[#F4EEE0] px-2 py-1 text-xs text-[#B5803C]">
              {question.category}
            </span>
          )}
        </div>

        {renderQuestionImage(question)}

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
                    ? "border-[#101114] bg-[#101114] text-white"
                    : "border-[#101114]/20 bg-[#F4EEE0]"
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
                    ? "border-[#B5803C] bg-[#F4EEE0]"
                    : "border-[#101114]/20 bg-[#F4EEE0]"
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
              className="min-h-28 w-full rounded-xl border border-[#101114]/20 p-3 text-sm outline-none ring-offset-2 focus:border-[#B5803C] focus:ring-2 focus:ring-cyan-200"
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
              onBlur={(event) => {
                const nextValue = event.target.value.trim();
                if (!nextValue) return;
                void answerText(question.id, nextValue);
              }}
              disabled={isReadOnly}
            />
          </div>
        )}
      </article>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-[#101114]/12 bg-[#F4EEE0] p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#101114]">Loading assessment session...</h1>
          <p className="mt-2 text-sm text-[#101114]/72">
            Preparing your questions and saved progress.
          </p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-10">
        <section className="rounded-2xl border border-[#101114]/20 bg-[#F4EEE0] p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[#101114]">Could not load this session</h1>
          <p className="mt-2 text-sm text-[#101114]">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={defaultBackHref}
              className="rounded-xl bg-[#101114] px-4 py-2 text-sm font-semibold text-white"
            >
              {isPreviewMode ? "Back to Assessment Settings" : "Back to Assessment Center"}
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-4 py-2 text-sm font-semibold text-[#101114]/82"
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={defaultBackHref}
            className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-3 py-2 text-xs font-semibold text-[#101114]/82"
          >
            {isPreviewMode ? "Back to Assessment Settings" : "Back to Assessment Center"}
          </Link>
          {isPreviewMode ? (
            <span className="rounded-full bg-[#101114] px-3 py-1 text-xs font-semibold text-white">
              Admin Preview
            </span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Personality & Behavior Assessment</h1>
        <p className="mt-2 text-sm text-[#101114]/82">
          Progress: {answeredCount}/{questions.length}
        </p>
        {isPreviewMode ? (
          <p className="mt-2 rounded-lg bg-[#F4EEE0]/72 px-3 py-2 text-sm text-[#101114]/82">
            You are testing the live participant experience. Submitting this preview will not generate a participant score or report.
          </p>
        ) : null}
        {isOneQuestionAtATime && activeQuestion ? (
          <p className="mt-1 text-sm text-[#101114]/82">
            Question {activeQuestionIndex + 1} of {questions.length}
          </p>
        ) : null}
        {isReadOnly && (
          <p className="mt-2 rounded-lg bg-[#F4EEE0] px-3 py-2 text-sm text-[#B5803C]">
            This session has already been submitted. Responses are read-only.
          </p>
        )}
        <div className="mt-3 h-2 rounded-full bg-[#F4EEE0]/72">
          <div
            className="h-2 rounded-full bg-[#101114]"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      {actionError ? (
        <section className="rounded-2xl border border-[#101114]/20 bg-[#F4EEE0] p-4 text-sm text-[#101114]">
          {actionError}
        </section>
      ) : null}

      {isOneQuestionAtATime && activeQuestion ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#101114] px-2 py-1 text-xs font-medium text-white">
              Section {sections.length > 0 && activeSection ? activeSection.sortOrder + 1 : 1}
            </span>
            <h2 className="text-lg font-semibold">{activeSection?.title || "Assessment"}</h2>
            <span className="rounded-full bg-[#F4EEE0] px-2 py-1 text-xs text-[#101114]/72">
              {activeSection?.kind || "QUESTION"}
            </span>
          </div>

          {renderQuestionCard(activeQuestion, activeQuestionIndex)}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              className="rounded-xl border border-[#101114]/20 bg-[#F4EEE0] px-4 py-3 font-medium text-[#101114]/82 disabled:opacity-50"
              disabled={navigating || activeQuestionIndex === 0}
              onClick={() => void navigateToQuestion(activeQuestionIndex - 1)}
            >
              Previous
            </button>

            <div className="flex flex-wrap gap-3">
              {activeQuestionIndex < questions.length - 1 ? (
                <button
                  className="rounded-xl bg-[#101114] px-4 py-3 font-medium text-white disabled:opacity-50"
                  disabled={navigating || submitting}
                  onClick={() => void navigateToQuestion(activeQuestionIndex + 1)}
                >
                  Next
                </button>
              ) : (
                <button
                  className="rounded-xl bg-[#B5803C] px-4 py-3 font-medium text-white disabled:opacity-50"
                  disabled={submitting || navigating || (!isReadOnly && answeredCount !== questions.length)}
                  onClick={submit}
                >
                  {submitting
                    ? "Submitting..."
                    : isReadOnly
                      ? isPreviewMode
                        ? "Return to Settings"
                        : "Go To Report"
                      : isPreviewMode
                        ? "Finish Preview"
                        : "Submit Assessment"}
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          {groupedSections.map((section, sectionIndex) => (
            <section key={section.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#101114] px-2 py-1 text-xs font-medium text-white">
                  Section {sectionIndex + 1}
                </span>
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <span className="rounded-full bg-[#F4EEE0] px-2 py-1 text-xs text-[#101114]/72">{section.kind}</span>
              </div>

              <div className="space-y-4">
                {section.questions.map((question, idx) => renderQuestionCard(question, idx))}
              </div>
            </section>
          ))}

          <button
            className="w-full rounded-xl bg-[#B5803C] px-4 py-3 font-medium text-white disabled:opacity-50"
            disabled={submitting || (!isReadOnly && answeredCount !== questions.length)}
            onClick={submit}
          >
            {submitting
              ? "Submitting..."
              : isReadOnly
                ? isPreviewMode
                  ? "Return to Settings"
                  : "Go To Report"
                : isPreviewMode
                  ? "Finish Preview"
                  : "Submit Assessment"}
          </button>
        </>
      )}
    </main>
  );
}
