"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/admin/Toast";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyState from "@/components/admin/EmptyState";
import ActionMenu, { type ActionItem } from "@/components/admin/ActionMenu";

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

  const [createTitle, setCreateTitle] = useState("");

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "default";
    busy: boolean;
  }>({ open: false, title: "", message: "", onConfirm: () => { }, variant: "default", busy: false });

  const loadAssessments = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (minCompletionRate.trim()) params.set("minCompletionRate", minCompletionRate.trim());
    if (maxCompletionRate.trim()) params.set("maxCompletionRate", maxCompletionRate.trim());
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    const res = await fetch(`/api/admin/assessments?${params.toString()}`);
    const data = await res.json();
    setAssessments(data.assessments || []);
  }, [maxCompletionRate, minCompletionRate, query, sortBy, sortOrder, statusFilter]);

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
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (minCompletionRate.trim()) params.set("minCompletionRate", minCompletionRate.trim());
      if (maxCompletionRate.trim()) params.set("maxCompletionRate", maxCompletionRate.trim());
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("format", "csv");
      params.set("limit", "5000");

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

  function getRowActions(assessment: Assessment): ActionItem[] {
    const isBusy = busyAssessmentId === assessment.id;

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
          Create a new assessment. Then open Manage → Content to add/edit/remove questions.
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
        </div>

        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
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
                  colSpan={4}
                />
              ) : (
                assessments.map((assessment) => (
                  <tr key={assessment.id} className="border-t border-slate-100 align-top">
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
