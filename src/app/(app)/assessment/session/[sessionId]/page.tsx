"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { normalizePreviewReturnTo } from "@/lib/assessment-session";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  assessmentSaveStatus,
  persistedVersionIsCurrent,
  shouldBlockAssessmentNavigation,
} from "@/lib/assessment-answer-state";

type QuestionPresentationMode = "ALL_AT_ONCE" | "ONE_AT_A_TIME";
type Section = {
  id: string;
  title: string;
  description?: string | null;
  kind: "PERSONALITY" | "SCENARIO";
  sortOrder: number;
};
type QuestionOption = { id: string; text: string };
type Question = {
  id: string;
  code?: string | null;
  sectionId?: string | null;
  prompt: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
  questionType: "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";
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
type AnswerState = { value?: number; optionId?: string; textValue?: string };
type SavePayload = {
  questionId: string;
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
  const firstUnansweredIndex = questions.findIndex(
    (question) => !isQuestionAnswered(question, answers[question.id]),
  );
  return firstUnansweredIndex >= 0 ? firstUnansweredIndex : Math.max(questions.length - 1, 0);
}

function renderQuestionImage(question: Question) {
  if (!question.imageUrl) return null;
  return (
    <figure className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={question.imageUrl}
        alt={question.imageAlt || "Question reference image"}
        loading="lazy"
        decoding="async"
        crossOrigin={question.imageUrl.startsWith("https://") ? "anonymous" : undefined}
        referrerPolicy="no-referrer"
        className="max-h-[28rem] w-full bg-white object-contain"
      />
      {question.imageCaption ? (
        <figcaption className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
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
  const requestedPreview = sessionId.startsWith("preview_");
  const requestedReturnTo = searchParams.get("returnTo");

  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const answersRef = useRef<Record<string, AnswerState>>({});
  const answerVersionsRef = useRef(new Map<string, number>());
  const failedSavesRef = useRef(new Map<string, number>());
  const dirtyAnswersRef = useRef(new Set<string>());
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const [assessmentId, setAssessmentId] = useState("");
  const [assessmentTitle, setAssessmentTitle] = useState("Assessment");
  const [isPreviewMode, setIsPreviewMode] = useState(requestedPreview);
  const [questionPresentationMode, setQuestionPresentationMode] =
    useState<QuestionPresentationMode>("ALL_AT_ONCE");
  const [sessionStatus, setSessionStatus] = useState<"IN_PROGRESS" | "SUBMITTED">("IN_PROGRESS");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [dirtyAnswerCount, setDirtyAnswerCount] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState("");

  const shouldWarnBeforeLeaving = shouldBlockAssessmentNavigation({
    pendingSaves,
    dirtyAnswers: dirtyAnswerCount,
    saveFailed,
    submitting,
  });

  const previewReturnTo = useMemo(
    () => normalizePreviewReturnTo(requestedReturnTo, assessmentId || undefined),
    [assessmentId, requestedReturnTo],
  );

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      if (!sessionId) {
        setLoadError("Invalid session id. Please start the assessment again.");
        setLoading(false);
        return;
      }
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;
        setLoading(true);
        setLoadError("");
        const res = await fetch(`/api/assessment/sessions/${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          assessmentId?: string;
          assessmentTitle?: string;
          previewMode?: boolean;
          questionPresentationMode?: QuestionPresentationMode;
          sections?: Section[];
          questions?: Question[];
          answers?: Answer[];
          status?: string;
        };
        if (!res.ok) throw new Error(data.error || "Could not load assessment session.");
        if (!Array.isArray(data.questions)) throw new Error("Session data is incomplete.");

        const next: Record<string, AnswerState> = {};
        for (const answer of data.answers || []) {
          next[answer.questionId] = {
            value: typeof answer.value === "number" ? answer.value : undefined,
            optionId: answer.optionId || undefined,
            textValue: answer.textValue ?? undefined,
          };
        }
        answersRef.current = next;
        answerVersionsRef.current.clear();
        failedSavesRef.current.clear();
        dirtyAnswersRef.current.clear();
        setAnswers(next);
        setDirtyAnswerCount(0);
        setSaveFailed(false);
        setAssessmentId(data.assessmentId || "");
        setAssessmentTitle(data.assessmentTitle || "Assessment");
        setIsPreviewMode(data.previewMode === true);
        setQuestionPresentationMode(data.questionPresentationMode || "ALL_AT_ONCE");
        setSections(data.sections || []);
        setQuestions(data.questions);
        setSessionStatus(data.status === "SUBMITTED" ? "SUBMITTED" : "IN_PROGRESS");
        setActiveQuestionIndex(findInitialQuestionIndex(data.questions, next));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Could not load session.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [sessionId]);

  useEffect(() => {
    if (!shouldWarnBeforeLeaving) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [shouldWarnBeforeLeaving]);

  useEffect(() => {
    if (!shouldWarnBeforeLeaving) return;

    const interceptInternalNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(
        destination.pathname + destination.search + destination.hash,
      );
    };

    document.addEventListener("click", interceptInternalNavigation, true);
    return () =>
      document.removeEventListener("click", interceptInternalNavigation, true);
  }, [shouldWarnBeforeLeaving]);

  const answeredCount = useMemo(
    () => questions.filter((question) => isQuestionAnswered(question, answers[question.id])).length,
    [answers, questions],
  );
  const isReadOnly = sessionStatus === "SUBMITTED";
  const isOneQuestionAtATime = questionPresentationMode === "ONE_AT_A_TIME";
  const defaultBackHref = isPreviewMode ? previewReturnTo : "/assessment/current";
  const readOnlyTarget = isPreviewMode
    ? previewReturnTo
    : assessmentId
      ? `/reports/me/${encodeURIComponent(assessmentId)}`
      : "/assessment/current";

  const groupedSections = useMemo(() => {
    if (sections.length === 0) {
      return [{ id: "general", title: "Assessment", kind: "PERSONALITY" as const, questions }];
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

  async function persistAnswer(payload: SavePayload) {
    const res = await fetch(
      `/api/assessment/sessions/${encodeURIComponent(sessionId)}/answer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || "Could not save your answer.");
  }

  function markAnswerDirty(questionId: string) {
    if (dirtyAnswersRef.current.has(questionId)) return;
    dirtyAnswersRef.current.add(questionId);
    setDirtyAnswerCount(dirtyAnswersRef.current.size);
  }

  function markAnswerPersisted(questionId: string, version: number) {
    if (
      !persistedVersionIsCurrent(
        answerVersionsRef.current.get(questionId),
        version,
      )
    ) {
      return;
    }
    dirtyAnswersRef.current.delete(questionId);
    setDirtyAnswerCount(dirtyAnswersRef.current.size);
  }

  function setLocalAnswer(questionId: string, next: AnswerState) {
    const version = (answerVersionsRef.current.get(questionId) || 0) + 1;
    answerVersionsRef.current.set(questionId, version);
    answersRef.current = { ...answersRef.current, [questionId]: next };
    setAnswers(answersRef.current);
    markAnswerDirty(questionId);
    return version;
  }

  function queuePersist(
    payload: SavePayload,
    version: number,
    previous?: AnswerState,
  ): Promise<boolean> {
    setPendingSaves((count) => count + 1);
    const operation = saveChainRef.current.then(() => persistAnswer(payload));
    saveChainRef.current = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation
      .then(() => {
        const failedVersion = failedSavesRef.current.get(payload.questionId);
        if (failedVersion !== undefined && failedVersion <= version) {
          failedSavesRef.current.delete(payload.questionId);
        }
        markAnswerPersisted(payload.questionId, version);
        if (failedSavesRef.current.size === 0) setSaveFailed(false);
        return true;
      })
      .catch((error) => {
        failedSavesRef.current.set(payload.questionId, version);
        setSaveFailed(true);
        if (answerVersionsRef.current.get(payload.questionId) === version) {
          const next = { ...answersRef.current };
          if (previous) next[payload.questionId] = previous;
          else delete next[payload.questionId];
          answersRef.current = next;
          setAnswers(next);
        }
        setActionError(error instanceof Error ? error.message : "Could not save your answer.");
        return false;
      })
      .finally(() => setPendingSaves((count) => Math.max(0, count - 1)));
  }

  function answerLikert(questionId: string, value: number) {
    if (isReadOnly) return;
    setActionError("");
    const previous = answersRef.current[questionId];
    const version = setLocalAnswer(questionId, { value });
    void queuePersist({ questionId, value }, version, previous);
  }

  function answerScenario(questionId: string, optionId: string) {
    if (isReadOnly) return;
    setActionError("");
    const previous = answersRef.current[questionId];
    const version = setLocalAnswer(questionId, { optionId });
    void queuePersist({ questionId, optionId }, version, previous);
  }

  function editText(questionId: string, textValue: string) {
    if (isReadOnly) return;
    setLocalAnswer(questionId, { textValue });
  }

  async function saveText(questionId: string) {
    if (isReadOnly) return true;
    if (
      !dirtyAnswersRef.current.has(questionId) &&
      !failedSavesRef.current.has(questionId)
    ) {
      return true;
    }
    const version = answerVersionsRef.current.get(questionId) || 0;
    const textValue = answersRef.current[questionId]?.textValue || "";
    setActionError("");
    return queuePersist({ questionId, textValue }, version, { textValue });
  }

  function requestNavigation(destination: string) {
    if (shouldWarnBeforeLeaving) {
      setPendingNavigation(destination);
      return;
    }
    router.push(destination);
  }

  function discardAndNavigate() {
    const destination = pendingNavigation;
    dirtyAnswersRef.current.clear();
    failedSavesRef.current.clear();
    setDirtyAnswerCount(0);
    setSaveFailed(false);
    setPendingNavigation("");
    if (destination) router.push(destination);
  }

  async function navigateToQuestion(nextIndex: number) {
    if (!isOneQuestionAtATime || questions.length === 0 || !activeQuestion) return;
    const boundedIndex = Math.max(0, Math.min(nextIndex, questions.length - 1));
    if (boundedIndex === activeQuestionIndex) return;

    setNavigating(true);
    try {
      if (activeQuestion.questionType === "FREE_TEXT" && !(await saveText(activeQuestion.id))) {
        return;
      }
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
    setSubmitting(true);
    setActionError("");
    try {
      const textResults = await Promise.all(
        questions
          .filter((question) => question.questionType === "FREE_TEXT")
          .map((question) => saveText(question.id)),
      );
      await saveChainRef.current;
      if (textResults.some((saved) => !saved) || failedSavesRef.current.size > 0) {
        throw new Error("Some responses could not be saved. Review the highlighted message and try again.");
      }

      const res = await fetch(
        `/api/assessment/sessions/${encodeURIComponent(sessionId)}/submit`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectTo?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not submit assessment.");
      router.push(data.redirectTo || (isPreviewMode ? previewReturnTo : readOnlyTarget));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not submit assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderQuestionCard(question: Question, displayIndex: number) {
    const labelId = `question-${question.id}`;
    return (
      <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 id={labelId} className="font-medium text-slate-900">
          {question.code ? `${question.code}. ` : `${displayIndex + 1}. `}
          {question.prompt}
        </h3>
        {renderQuestionImage(question)}

        {question.questionType === "LIKERT_TRAIT" ? (
          <fieldset className="mt-4" aria-labelledby={labelId} disabled={isReadOnly}>
            <legend className="sr-only">Choose how strongly you agree</legend>
            <div className="flex flex-wrap gap-2">
              {Array.from(
                { length: question.scaleMax - question.scaleMin + 1 },
                (_, index) => question.scaleMin + index,
              ).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-cyan-600 ${
                    answers[question.id]?.value === value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-800"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name={`answer-${question.id}`}
                    value={value}
                    checked={answers[question.id]?.value === value}
                    onChange={() => answerLikert(question.id, value)}
                  />
                  {value}
                </label>
              ))}
            </div>
            <div className="mt-2 flex justify-between gap-4 text-xs text-slate-500">
              <span>Strongly disagree</span>
              <span>Strongly agree</span>
            </div>
          </fieldset>
        ) : question.questionType === "SJT_SINGLE" ? (
          <fieldset className="mt-4 grid gap-2" aria-labelledby={labelId} disabled={isReadOnly}>
            <legend className="sr-only">Choose one response</legend>
            {question.options.map((option) => (
              <label
                key={option.id}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-left text-sm focus-within:ring-2 focus-within:ring-cyan-600 ${
                  answers[question.id]?.optionId === option.id
                    ? "border-cyan-700 bg-cyan-50"
                    : "border-slate-300 bg-white"
                }`}
              >
                <input
                  className="mr-3"
                  type="radio"
                  name={`answer-${question.id}`}
                  value={option.id}
                  checked={answers[question.id]?.optionId === option.id}
                  onChange={() => answerScenario(question.id, option.id)}
                />
                {option.text}
              </label>
            ))}
          </fieldset>
        ) : (
          <textarea
            aria-labelledby={labelId}
            className="mt-4 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none ring-offset-2 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
            placeholder="Type your response"
            value={answers[question.id]?.textValue || ""}
            maxLength={10_000}
            onChange={(event) => editText(question.id, event.target.value)}
            onBlur={() => void saveText(question.id)}
            disabled={isReadOnly}
          />
        )}
      </article>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
          <h1 className="text-xl font-semibold text-slate-900">Loading assessment session…</h1>
          <p className="mt-2 text-sm text-slate-600">Preparing your questions and saved progress.</p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm" role="alert">
          <h1 className="text-xl font-semibold text-rose-900">Could not load this session</h1>
          <p className="mt-2 text-sm text-rose-800">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={defaultBackHref} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              {isPreviewMode ? "Back to Assessment Settings" : "Back to Assessment Center"}
            </Link>
            <Link href="/dashboard" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 md:p-10">
      <header className="rounded-3xl bg-gradient-to-r from-cyan-100 via-sky-50 to-amber-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={navigating || submitting}
            onClick={() => requestNavigation(defaultBackHref)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-50"
          >
            {isPreviewMode ? "Back to Assessment Settings" : "Back to Assessment Center"}
          </button>
          {isPreviewMode ? <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Admin Preview</span> : null}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{assessmentTitle}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
          <span>Progress: {answeredCount}/{questions.length}</span>
          <span aria-live="polite">
            {assessmentSaveStatus({
              pendingSaves,
              dirtyAnswers: dirtyAnswerCount,
              saveFailed,
            })}
          </span>
        </div>
        {isPreviewMode ? <p className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700">This isolated preview never changes participant responses, scores, or reports.</p> : null}
        {isOneQuestionAtATime && activeQuestion ? <p className="mt-1 text-sm text-slate-700">Question {activeQuestionIndex + 1} of {questions.length}</p> : null}
        {isReadOnly ? <p className="mt-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800">This session has already been submitted. Responses are read-only.</p> : null}
        <div
          className="mt-3 h-2 rounded-full bg-white/80"
          role="progressbar"
          aria-label="Assessment completion"
          aria-valuemin={0}
          aria-valuemax={questions.length}
          aria-valuenow={answeredCount}
        >
          <div className="h-2 rounded-full bg-slate-900" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {actionError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{actionError}</section> : null}

      {isOneQuestionAtATime && activeQuestion ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white">Section {sections.length > 0 && activeSection ? activeSection.sortOrder + 1 : 1}</span>
            <h2 className="text-lg font-semibold">{activeSection?.title || "Assessment"}</h2>
          </div>
          {renderQuestionCard(activeQuestion, activeQuestionIndex)}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 disabled:opacity-50" disabled={navigating || activeQuestionIndex === 0} onClick={() => void navigateToQuestion(activeQuestionIndex - 1)}>Previous</button>
            {activeQuestionIndex < questions.length - 1 ? (
              <button type="button" className="rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50" disabled={navigating || submitting} onClick={() => void navigateToQuestion(activeQuestionIndex + 1)}>Next</button>
            ) : (
              <button type="button" className="rounded-xl bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50" disabled={submitting || navigating || (!isReadOnly && answeredCount !== questions.length)} onClick={() => void submit()}>{submitting ? "Submitting…" : isReadOnly ? (isPreviewMode ? "Return to Settings" : "Go to Report") : isPreviewMode ? "Finish Preview" : "Submit Assessment"}</button>
            )}
          </div>
        </section>
      ) : (
        <>
          {groupedSections.map((section, sectionIndex) => (
            <section key={section.id} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white">Section {sectionIndex + 1}</span>
                <h2 className="text-lg font-semibold">{section.title}</h2>
              </div>
              <div className="space-y-4">{section.questions.map((question, index) => renderQuestionCard(question, index))}</div>
            </section>
          ))}
          <button type="button" className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-medium text-white disabled:opacity-50" disabled={submitting || (!isReadOnly && answeredCount !== questions.length)} onClick={() => void submit()}>{submitting ? "Submitting…" : isReadOnly ? (isPreviewMode ? "Return to Settings" : "Go to Report") : isPreviewMode ? "Finish Preview" : "Submit Assessment"}</button>
        </>
      )}
      <ConfirmDialog
        open={Boolean(pendingNavigation)}
        title="Leave before responses are saved?"
        message="One or more responses are still local or failed to save. Leaving now may discard those changes. Stay and retry unless you intentionally want to leave them behind."
        confirmLabel="Discard and leave"
        variant="danger"
        onConfirm={discardAndNavigate}
        onCancel={() => setPendingNavigation("")}
      />
    </main>
  );
}
