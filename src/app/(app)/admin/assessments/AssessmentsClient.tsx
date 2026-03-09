"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/admin/Toast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ActionMenu, { type ActionItem } from "@/components/admin/ActionMenu";
import { buildAssessmentCsvTemplate } from "@/lib/assessment-question-csv";

type Assessment = {
  id: string;
  title: string;
  isPublished: boolean;
  _count?: {
    questions: number;
    sessions: number;
    userEnrollments: number;
    tenantEnrollments: number;
  };
  participantCounts?: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  completionRate?: number;
  policy?: {
    showResultsToEmployee: boolean;
    resultReleaseDelayHours: number;
    postSubmitMessage: string;
    leaderCanViewFullReport: boolean;
  } | null;
};

type CsvIssue = {
  row: number;
  column?: string;
  message: string;
};

type CsvPreviewSummary = {
  sections: number;
  questions: number;
  questionTypes: {
    likert: number;
    sjt: number;
    freeText: number;
  };
  competencies: number;
  sectionTitles: string[];
};

type CsvPreviewQuestion = {
  code: string;
  prompt: string;
  type: "LIKERT_TRAIT" | "SJT_SINGLE" | "FREE_TEXT";
  section: string;
};

type ResultsExportLayout = "WIDE" | "LONG";
type ResultsExportAttemptStatus = "ALL" | "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
type ResultsExportReportStatus =
  | "ALL"
  | "NOT_UPLOADED_YET"
  | "UPLOADED"
  | "AWAITING_DELIVERY_TIMER"
  | "DELIVERED_TO_USER";

type ResultsExportInclude = {
  participant: boolean;
  attempt: boolean;
  report: boolean;
  answers: boolean;
};

export default function AssessmentsClient() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "PUBLISHED" | "DRAFT">("");
  const [minCompletionRate, setMinCompletionRate] = useState("");
  const [maxCompletionRate, setMaxCompletionRate] = useState("");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "updatedAt" | "title" | "completionRate" | "participants"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [busyAssessmentId, setBusyAssessmentId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>([]);

  const [createTitle, setCreateTitle] = useState("");
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvCreateTitle, setCsvCreateTitle] = useState("");
  const [csvCreateReportWorkflow, setCsvCreateReportWorkflow] = useState<
    "AI_STANDARD" | "MANUAL_PDF_UPLOAD"
  >("AI_STANDARD");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvPreviewSummary, setCsvPreviewSummary] = useState<CsvPreviewSummary | null>(null);
  const [csvPreviewQuestions, setCsvPreviewQuestions] = useState<CsvPreviewQuestion[]>([]);
  const [csvIssues, setCsvIssues] = useState<CsvIssue[]>([]);
  const [resultsExportOpen, setResultsExportOpen] = useState(false);
  const [resultsExportBusy, setResultsExportBusy] = useState(false);
  const [resultsExportLayout, setResultsExportLayout] = useState<ResultsExportLayout>("WIDE");
  const [resultsExportAttemptStatus, setResultsExportAttemptStatus] =
    useState<ResultsExportAttemptStatus>("ALL");
  const [resultsExportReportStatus, setResultsExportReportStatus] =
    useState<ResultsExportReportStatus>("ALL");
  const [resultsExportInclude, setResultsExportInclude] = useState<ResultsExportInclude>({
    participant: true,
    attempt: true,
    report: true,
    answers: true,
  });

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "default";
    busy: boolean;
  }>({ open: false, title: "", message: "", onConfirm: () => { }, variant: "default", busy: false });

  const buildAssessmentQueryParams = useCallback(
    (options?: { format?: "csv"; limit?: number }) => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (minCompletionRate.trim()) params.set("minCompletionRate", minCompletionRate.trim());
      if (maxCompletionRate.trim()) params.set("maxCompletionRate", maxCompletionRate.trim());
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      if (options?.format) params.set("format", options.format);
      if (typeof options?.limit === "number") params.set("limit", String(options.limit));
      return params;
    },
    [maxCompletionRate, minCompletionRate, query, sortBy, sortOrder, statusFilter],
  );

  const loadAssessments = useCallback(async () => {
    const res = await fetch(`/api/admin/assessments?${buildAssessmentQueryParams().toString()}`);
    const data = await res.json();
    const rows = data.assessments || [];
    setAssessments(rows);
    setSelectedAssessmentIds((prev) =>
      prev.filter((id) => rows.some((row: Assessment) => row.id === id)),
    );
  }, [buildAssessmentQueryParams]);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") loadAssessments();
  }

  function clearAdvancedFilters() {
    setQuery("");
    setStatusFilter("");
    setMinCompletionRate("");
    setMaxCompletionRate("");
    setSortBy("createdAt");
    setSortOrder("desc");
  }

  async function exportAssessmentsCsv() {
    try {
      const params = buildAssessmentQueryParams({ format: "csv", limit: 5000 });

      const res = await fetch(`/api/admin/assessments?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error || "Failed to export CSV.", "error");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `admin-assessments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast("CSV export started.", "success");
    } catch {
      toast("Failed to export CSV.", "error");
    }
  }

  function resetResultsExportState() {
    setResultsExportLayout("WIDE");
    setResultsExportAttemptStatus("ALL");
    setResultsExportReportStatus("ALL");
    setResultsExportInclude({
      participant: true,
      attempt: true,
      report: true,
      answers: true,
    });
    setResultsExportBusy(false);
  }

  function toggleResultsExportInclude(key: keyof ResultsExportInclude) {
    setResultsExportInclude((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function resolveResultsAssessmentIds() {
    if (selectedAssessmentIds.length > 0) {
      return selectedAssessmentIds;
    }

    const params = buildAssessmentQueryParams({ limit: 5000 });
    const res = await fetch(`/api/admin/assessments?${params.toString()}`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((data as { error?: string }).error || "Failed to resolve assessments.");
    }

    const ids = ((data as { assessments?: Assessment[] }).assessments || []).map(
      (assessment) => assessment.id,
    );
    return ids;
  }

  async function exportAssessmentResultsCsv() {
    const includeValues = Object.values(resultsExportInclude);
    if (!includeValues.some(Boolean)) {
      toast("Select at least one field group to export.", "error");
      return;
    }

    setResultsExportBusy(true);
    try {
      const assessmentIds = await resolveResultsAssessmentIds();
      if (assessmentIds.length === 0) {
        toast("No assessments match the current export scope.", "error");
        return;
      }

      const res = await fetch("/api/admin/assessments/export-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentIds,
          layout: resultsExportLayout,
          attemptStatus: resultsExportAttemptStatus,
          reportStatus: resultsExportReportStatus,
          include: resultsExportInclude,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error || "Failed to export results CSV.", "error");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `assessment-results-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast("Results export started.", "success");
      setResultsExportOpen(false);
      resetResultsExportState();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to export results CSV.",
        "error",
      );
    } finally {
      setResultsExportBusy(false);
    }
  }

  async function createAssessment() {
    if (!createTitle.trim()) {
      toast("Assessment title is required.", "error");
      return;
    }

    const res = await fetch("/api/admin/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: createTitle }),
    });

    const data = await res.json();

    if (res.ok) {
      toast(`Assessment "${createTitle}" created.`, "success");
      setCreateTitle("");
      await loadAssessments();
    } else {
      toast(data.error || "Failed to create assessment.", "error");
    }
  }

  function resetCsvModalState() {
    setCsvCreateTitle("");
    setCsvCreateReportWorkflow("AI_STANDARD");
    setCsvFile(null);
    setCsvIssues([]);
    setCsvPreviewSummary(null);
    setCsvPreviewQuestions([]);
    setCsvBusy(false);
  }

  function downloadCsvTemplate() {
    const blob = new Blob([buildAssessmentCsvTemplate()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "assessment-question-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function validateCreateFromCsv() {
    if (!csvCreateTitle.trim()) {
      toast("Title is required for CSV assessment import.", "error");
      return;
    }
    if (!csvFile) {
      toast("Select a CSV file first.", "error");
      return;
    }

    setCsvBusy(true);
    try {
      const formData = new FormData();
      formData.append("title", csvCreateTitle.trim());
      formData.append("reportWorkflow", csvCreateReportWorkflow);
      formData.append("file", csvFile);
      formData.append("dryRun", "true");

      const res = await fetch("/api/admin/assessments/import-csv?dryRun=1", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCsvPreviewSummary((data as { summary?: CsvPreviewSummary }).summary || null);
        setCsvPreviewQuestions([]);
        setCsvIssues(((data as { issues?: CsvIssue[] }).issues || []).slice(0, 30));
        toast((data as { error?: string }).error || "CSV validation failed.", "error");
        return;
      }

      setCsvIssues([]);
      setCsvPreviewSummary((data as { summary?: CsvPreviewSummary }).summary || null);
      setCsvPreviewQuestions(
        ((data as { preview?: { firstQuestions?: CsvPreviewQuestion[] } }).preview?.firstQuestions ||
          []) as CsvPreviewQuestion[],
      );
      toast("CSV validated. You can now import.", "success");
    } finally {
      setCsvBusy(false);
    }
  }

  async function createAssessmentFromCsv() {
    if (!csvCreateTitle.trim()) {
      toast("Title is required for CSV assessment import.", "error");
      return;
    }
    if (!csvFile) {
      toast("Select a CSV file first.", "error");
      return;
    }

    setCsvBusy(true);
    try {
      const formData = new FormData();
      formData.append("title", csvCreateTitle.trim());
      formData.append("reportWorkflow", csvCreateReportWorkflow);
      formData.append("file", csvFile);

      const res = await fetch("/api/admin/assessments/import-csv", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCsvIssues(((data as { issues?: CsvIssue[] }).issues || []).slice(0, 30));
        toast((data as { error?: string }).error || "Failed to import CSV assessment.", "error");
        return;
      }

      toast(`Assessment "${csvCreateTitle}" created from CSV.`, "success");
      setCsvModalOpen(false);
      resetCsvModalState();
      await loadAssessments();
    } finally {
      setCsvBusy(false);
    }
  }

  function requestDeleteAssessment(assessment: Assessment) {
    setConfirmState({
      open: true,
      title: "Delete Assessment",
      message: `Are you sure you want to delete "${assessment.title}"? All associated questions, sessions, scores, and reports will be permanently removed.`,
      variant: "danger",
      busy: false,
      onConfirm: () => executeDeleteAssessment(assessment.id),
    });
  }

  async function executeDeleteAssessment(id: string) {
    setConfirmState((prev) => ({ ...prev, busy: true }));
    try {
      const res = await fetch(`/api/admin/assessments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast("Assessment deleted.", "success");
        await loadAssessments();
      } else {
        toast(data.error || "Failed to delete assessment.", "error");
      }
    } finally {
      setConfirmState((prev) => ({ ...prev, open: false, busy: false }));
    }
  }

  async function togglePublish(assessment: Assessment) {
    setBusyAssessmentId(assessment.id);
    try {
      const res = await fetch(`/api/admin/assessments/${assessment.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPublished: !assessment.isPublished,
          showResultsToEmployee: assessment.policy?.showResultsToEmployee ?? true,
          resultReleaseDelayHours: assessment.policy?.resultReleaseDelayHours ?? 0,
          postSubmitMessage:
            assessment.policy?.postSubmitMessage || "Thanks for completing your assessment.",
          leaderCanViewFullReport: assessment.policy?.leaderCanViewFullReport ?? true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(
          assessment.isPublished ? "Assessment unpublished." : "Assessment published.",
          "success",
        );
        await loadAssessments();
      } else {
        toast(data.error || "Failed to change publish status.", "error");
      }
    } finally {
      setBusyAssessmentId("");
    }
  }

  const allSelected = assessments.length > 0 && selectedAssessmentIds.length === assessments.length;

  function toggleAllAssessments(checked: boolean) {
    if (!checked) {
      setSelectedAssessmentIds([]);
      return;
    }
    setSelectedAssessmentIds(assessments.map((assessment) => assessment.id));
  }

  function toggleAssessmentSelection(assessmentId: string, checked: boolean) {
    setSelectedAssessmentIds((prev) => {
      if (checked) return Array.from(new Set([...prev, assessmentId]));
      return prev.filter((id) => id !== assessmentId);
    });
  }

  async function runBulkAssessmentAction(
    actionLabel: string,
    worker: (assessment: Assessment) => Promise<boolean>,
  ) {
    if (selectedAssessmentIds.length === 0) {
      toast("Select at least one assessment.", "error");
      return;
    }

    setBulkBusy(true);
    let successCount = 0;
    let failCount = 0;

    for (const assessmentId of selectedAssessmentIds) {
      const assessment = assessments.find((item) => item.id === assessmentId);
      if (!assessment) continue;
      const ok = await worker(assessment);
      if (ok) successCount += 1;
      else failCount += 1;
    }

    setBulkBusy(false);
    setSelectedAssessmentIds([]);
    await loadAssessments();

    if (failCount === 0) {
      toast(`${actionLabel} complete: ${successCount} updated.`, "success");
      return;
    }

    toast(`${actionLabel} complete: ${successCount} updated, ${failCount} failed.`, "error");
  }

  async function bulkSetPublishState(nextPublished: boolean) {
    await runBulkAssessmentAction(
      nextPublished ? "Bulk publish" : "Bulk unpublish",
      async (assessment) => {
        const res = await fetch(`/api/admin/assessments/${assessment.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isPublished: nextPublished,
            showResultsToEmployee: assessment.policy?.showResultsToEmployee ?? true,
            resultReleaseDelayHours: assessment.policy?.resultReleaseDelayHours ?? 0,
            postSubmitMessage:
              assessment.policy?.postSubmitMessage || "Thanks for completing your assessment.",
            leaderCanViewFullReport: assessment.policy?.leaderCanViewFullReport ?? true,
          }),
        });
        return res.ok;
      },
    );
  }

  async function bulkDeleteAssessments() {
    const confirmed = window.confirm(
      `Delete ${selectedAssessmentIds.length} selected assessments? This cannot be undone.`,
    );
    if (!confirmed) return;

    await runBulkAssessmentAction("Bulk delete", async (assessment) => {
      const res = await fetch(`/api/admin/assessments/${assessment.id}`, { method: "DELETE" });
      return res.ok;
    });
  }

  function getRowActions(assessment: Assessment): ActionItem[] {
    const isBusy = busyAssessmentId === assessment.id || bulkBusy;

    return [
      {
        label: assessment.isPublished ? "Unpublish" : "Publish",
        onClick: () => togglePublish(assessment),
        variant: "primary",
        disabled: isBusy,
      },
      {
        label: "Delete",
        onClick: () => requestDeleteAssessment(assessment),
        variant: "danger",
        disabled: isBusy,
      },
    ];
  }

  return (
    <div className="space-y-6">
      {/* ── Create Assessment ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Create Assessment</h2>
        <p className="mt-1 text-xs text-slate-500">
          Create a blank assessment or create one directly from a CSV import file.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[280px]">
            <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Title</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Assessment title"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
            />
          </div>
          <button
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            onClick={createAssessment}
          >
            Create
          </button>
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => setCsvModalOpen(true)}
          >
            Create from CSV
          </button>
        </div>
      </section>

      {/* ── Assessment Library ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search assessments…"
          />
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | "PUBLISHED" | "DRAFT")}
          >
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>
          <input
            className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min={0}
            max={100}
            placeholder="Min %"
            value={minCompletionRate}
            onChange={(e) => setMinCompletionRate(e.target.value)}
          />
          <input
            className="w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min={0}
            max={100}
            placeholder="Max %"
            value={maxCompletionRate}
            onChange={(e) => setMaxCompletionRate(e.target.value)}
          />
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "createdAt"
                  | "updatedAt"
                  | "title"
                  | "completionRate"
                  | "participants",
              )
            }
          >
            <option value="createdAt">Sort: Created</option>
            <option value="updatedAt">Sort: Updated</option>
            <option value="title">Sort: Title</option>
            <option value="completionRate">Sort: Completion %</option>
            <option value="participants">Sort: Participants</option>
          </select>
          <select
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
            onClick={loadAssessments}
          >
            Refresh
          </button>
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
            onClick={clearAdvancedFilters}
          >
            Clear Filters
          </button>
          <button
            className="rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            onClick={exportAssessmentsCsv}
          >
            Export CSV
          </button>
          <button
            className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 transition-colors"
            onClick={() => setResultsExportOpen(true)}
          >
            Export Results
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          {selectedAssessmentIds.length > 0 && (
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  {selectedAssessmentIds.length} selected
                </span>
                <button
                  className="rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[11px] text-cyan-800 hover:bg-cyan-100 transition-colors disabled:opacity-50"
                  onClick={() => bulkSetPublishState(true)}
                  disabled={bulkBusy}
                >
                  Publish Selected
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors disabled:opacity-50"
                  onClick={() => bulkSetPublishState(false)}
                  disabled={bulkBusy}
                >
                  Unpublish Selected
                </button>
                <button
                  className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] hover:bg-rose-100 transition-colors disabled:opacity-50"
                  onClick={bulkDeleteAssessments}
                  disabled={bulkBusy}
                >
                  Delete Selected
                </button>
                <button
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors"
                  onClick={() => setSelectedAssessmentIds([])}
                  disabled={bulkBusy}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAllAssessments(e.target.checked)}
                    aria-label="Select all assessments"
                  />
                </th>
                <th className="px-3 py-2">Assessment</th>
                <th className="px-3 py-2">Participants</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assessments.length === 0 ? (
                <EmptyState
                  icon="📋"
                  title="No assessments found"
                  description="Create a new assessment above."
                  colSpan={5}
                />
              ) : (
                assessments.map((assessment) => (
                  <tr key={assessment.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedAssessmentIds.includes(assessment.id)}
                        onChange={(e) => toggleAssessmentSelection(assessment.id, e.target.checked)}
                        disabled={bulkBusy}
                        aria-label={`Select ${assessment.title}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{assessment.title}</div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {assessment._count?.questions || 0} questions · {assessment._count?.sessions || 0} sessions
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {assessment.participantCounts ? (
                        <>
                          <div className="font-medium">{assessment.participantCounts.total}</div>
                          <div className="text-[11px] text-slate-400">
                            {assessment.participantCounts.completed} done · {assessment.participantCounts.inProgress} active
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Completion {assessment.completionRate ?? 0}%
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${assessment.isPublished
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                          }`}
                      >
                        {assessment.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link
                          href={`/admin/assessments/${assessment.id}`}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] hover:bg-slate-50 transition-colors"
                        >
                          Manage
                        </Link>
                        <ActionMenu actions={getRowActions(assessment)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {csvModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">Create Assessment from CSV</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Validate first, then import. Import is atomic and preserves source question codes.
                </p>
              </div>
              <button
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  setCsvModalOpen(false);
                  resetCsvModalState();
                }}
                disabled={csvBusy}
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Assessment Title
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={csvCreateTitle}
                  onChange={(e) => setCsvCreateTitle(e.target.value)}
                  placeholder="CPR Exam - March 2026"
                  disabled={csvBusy}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Report Workflow
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={csvCreateReportWorkflow}
                  onChange={(e) =>
                    setCsvCreateReportWorkflow(
                      e.target.value as "AI_STANDARD" | "MANUAL_PDF_UPLOAD",
                    )
                  }
                  disabled={csvBusy}
                >
                  <option value="AI_STANDARD">AI Standard</option>
                  <option value="MANUAL_PDF_UPLOAD">Manual PDF Upload</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  CSV File
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  disabled={csvBusy}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                onClick={downloadCsvTemplate}
                disabled={csvBusy}
              >
                Download Template
              </button>
              <button
                className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                onClick={validateCreateFromCsv}
                disabled={csvBusy}
              >
                {csvBusy ? "Validating..." : "Validate CSV"}
              </button>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={createAssessmentFromCsv}
                disabled={csvBusy || !csvPreviewSummary || csvIssues.length > 0}
              >
                {csvBusy ? "Importing..." : "Confirm Import"}
              </button>
            </div>

            {csvPreviewSummary && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">
                  Summary: {csvPreviewSummary.questions} questions across {csvPreviewSummary.sections} sections
                </p>
                <p className="mt-1">
                  LIKERT: {csvPreviewSummary.questionTypes.likert} · SJT: {csvPreviewSummary.questionTypes.sjt} · FREE_TEXT: {csvPreviewSummary.questionTypes.freeText} · Competencies: {csvPreviewSummary.competencies}
                </p>
              </div>
            )}

            {csvPreviewQuestions.length > 0 && (
              <div className="mt-3 rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  Preview (first {csvPreviewQuestions.length} questions)
                </div>
                <ul className="max-h-36 overflow-auto px-3 py-2 text-xs text-slate-600">
                  {csvPreviewQuestions.map((item) => (
                    <li key={`${item.code}-${item.prompt}`} className="py-1">
                      <span className="font-semibold text-slate-700">{item.code}</span> · {item.section} · {item.type}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {csvIssues.length > 0 && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <p className="font-semibold">Validation issues ({csvIssues.length})</p>
                <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5">
                  {csvIssues.map((issue, index) => (
                    <li key={`${issue.row}-${issue.column || "global"}-${index}`}>
                      Row {issue.row}
                      {issue.column ? ` (${issue.column})` : ""}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {resultsExportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Export Assessment Results</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Export enrolled participants, attempt state, report readiness, and answer data.
                </p>
              </div>
              <button
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  setResultsExportOpen(false);
                  resetResultsExportState();
                }}
                disabled={resultsExportBusy}
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Export Scope
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {selectedAssessmentIds.length > 0
                    ? `${selectedAssessmentIds.length} selected assessment${selectedAssessmentIds.length === 1 ? "" : "s"}`
                    : "All assessments matching the current filters (up to 5,000 rows in the assessment list query)."}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Use row selection for a precise subset, or leave selection empty to export the current filtered set.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Layout
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={resultsExportLayout}
                    onChange={(e) => setResultsExportLayout(e.target.value as ResultsExportLayout)}
                    disabled={resultsExportBusy}
                  >
                    <option value="WIDE">Wide: one row per participant attempt</option>
                    <option value="LONG">Long: one row per question response</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Attempt Status
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={resultsExportAttemptStatus}
                    onChange={(e) =>
                      setResultsExportAttemptStatus(
                        e.target.value as ResultsExportAttemptStatus,
                      )
                    }
                    disabled={resultsExportBusy}
                  >
                    <option value="ALL">All attempts</option>
                    <option value="NOT_STARTED">Not started</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="SUBMITTED">Submitted</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Report Status
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={resultsExportReportStatus}
                    onChange={(e) =>
                      setResultsExportReportStatus(
                        e.target.value as ResultsExportReportStatus,
                      )
                    }
                    disabled={resultsExportBusy}
                  >
                    <option value="ALL">All report states</option>
                    <option value="NOT_UPLOADED_YET">Not uploaded yet</option>
                    <option value="UPLOADED">Uploaded</option>
                    <option value="AWAITING_DELIVERY_TIMER">Awaiting delivery timer</option>
                    <option value="DELIVERED_TO_USER">Delivered to user</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Include Fields
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={resultsExportInclude.participant}
                    onChange={() => toggleResultsExportInclude("participant")}
                    disabled={resultsExportBusy}
                  />
                  <span>Participant columns: name, email, organisation, manager</span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={resultsExportInclude.attempt}
                    onChange={() => toggleResultsExportInclude("attempt")}
                    disabled={resultsExportBusy}
                  />
                  <span>Attempt columns: status, started at, submitted at, duration</span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={resultsExportInclude.report}
                    onChange={() => toggleResultsExportInclude("report")}
                    disabled={resultsExportBusy}
                  />
                  <span>Report columns: readiness label, raw report state, delivery data</span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={resultsExportInclude.answers}
                    onChange={() => toggleResultsExportInclude("answers")}
                    disabled={resultsExportBusy}
                  />
                  <span>Answer columns: selected option, scale value, or free-text response</span>
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Wide layout produces one row per participant per assessment. Long layout expands each participant into one row per question.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                onClick={resetResultsExportState}
                disabled={resultsExportBusy}
              >
                Reset Options
              </button>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={exportAssessmentResultsCsv}
                disabled={resultsExportBusy}
              >
                {resultsExportBusy ? "Preparing Export..." : "Download CSV"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Dialog ── */}
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Delete"
        variant={confirmState.variant}
        busy={confirmState.busy}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
