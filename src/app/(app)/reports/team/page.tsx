"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatLocalDateTime } from "@/lib/date-time";

type TeamReport = {
  userId: string;
  assessmentId: string;
  participantName: string;
  assessmentTitle: string;
  submittedAt: string | null;
  ready: boolean;
  statusMessage: string | null;
  href: string | null;
};

type TeamReportsResponse = {
  reports?: TeamReport[];
  nextCursor?: string | null;
  error?: string;
};

function dateLabel(value: string | null) {
  return formatLocalDateTime(value, {
    dateStyle: "medium",
    fallback: "Date unavailable",
  });
}

async function fetchTeamReportsPage(cursor: string | null, signal: AbortSignal) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const res = await fetch(`/api/reports/leader${query}`, {
    cache: "no-store",
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as TeamReportsResponse;
  if (!res.ok) throw new Error(data.error || "Could not load team reports.");
  if (
    !Array.isArray(data.reports) ||
    (data.nextCursor !== null && typeof data.nextCursor !== "string")
  ) {
    throw new Error("The team reports response was incomplete.");
  }
  return { reports: data.reports, nextCursor: data.nextCursor };
}

function appendUniqueReports(current: TeamReport[], incoming: TeamReport[]) {
  const keys = new Set(
    current.map((report) => `${report.userId}:${report.assessmentId}`),
  );
  return [
    ...current,
    ...incoming.filter((report) => {
      const key = `${report.userId}:${report.assessmentId}`;
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    }),
  ];
}

export default function TeamReportsPage() {
  const [reports, setReports] = useState<TeamReport[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current = controller;
    const run = async () => {
      try {
        const data = await fetchTeamReportsPage(null, controller.signal);
        setReports(data.reports);
        setNextCursor(data.nextCursor);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Could not load team reports.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => {
      controller.abort();
      activeRequest.current?.abort();
    };
  }, []);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setLoadingMore(true);
    setError("");

    try {
      const data = await fetchTeamReportsPage(nextCursor, controller.signal);
      setReports((current) => appendUniqueReports(current, data.reports));
      setNextCursor(data.nextCursor);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Could not load more team reports.");
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 md:p-10">
      <header className="rounded-3xl bg-gradient-to-br from-cyan-50 via-white to-lime-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leader workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Team Reports</h1>
        <p className="mt-2 text-sm text-slate-600">Published assessment reports for people who currently report to you.</p>
      </header>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p> : null}
      {loading ? <p className="rounded-2xl border border-slate-200 bg-white p-5" aria-live="polite">Loading team reports…</p> : null}
      {!loading && !error && reports.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold">No team reports yet</h2>
          <p className="mt-2 text-sm text-slate-600">Reports appear here after a direct report submits an assessment and the report is released.</p>
        </section>
      ) : null}
      <div id="team-report-list" className="grid gap-3">
        {reports.map((report) => (
          <article key={`${report.userId}:${report.assessmentId}`} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">{report.participantName}</h2>
                <p className="mt-1 text-sm text-slate-700">{report.assessmentTitle}</p>
                <p className="mt-1 text-xs text-slate-500">Submitted {dateLabel(report.submittedAt)}</p>
                {!report.ready && report.statusMessage ? <p className="mt-2 text-xs text-amber-800">{report.statusMessage}</p> : null}
              </div>
              {report.href ? <Link href={report.href} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Open report</Link> : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Not released</span>}
            </div>
          </article>
        ))}
      </div>
      {!loading && nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            aria-controls="team-report-list"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-slate-500 disabled:cursor-wait disabled:opacity-60"
          >
            {loadingMore ? "Loading more…" : "Load more reports"}
          </button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {loadingMore ? "Loading more team reports." : ""}
      </p>
    </main>
  );
}
