"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatLocalDateTime } from "@/lib/date-time";

type ReportData = {
  message?: string;
  reportWorkflow?: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
  reportStatus?: "DRAFT" | "PUBLISHED" | null;
  manualPdfReady?: boolean;
  submittedAt?: string | null;
  participantName?: string;
  assessment?: { id: string; title: string };
  canonicalHtml?: string | null;
};

export default function MyReportPage() {
  const params = useParams<{ assessmentId: string }>();
  const assessmentId = typeof params?.assessmentId === "string" ? params.assessmentId : "";
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!assessmentId) return;
    const controller = new AbortController();
    const run = async () => {
      try {
        const res = await fetch(`/api/reports/me/${encodeURIComponent(assessmentId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await res.json().catch(() => ({}))) as ReportData & { error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not load report.");
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Could not load report.");
      }
    };
    void run();
    return () => controller.abort();
  }, [assessmentId]);

  if (!assessmentId || error) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm" role="alert">
          <h1 className="text-xl font-semibold text-rose-900">Could not load report</h1>
          <p className="mt-2 text-sm text-rose-800">{error || "Invalid report route."}</p>
          <Link href="/reports/current" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">My Reports</Link>
        </section>
      </main>
    );
  }

  if (!data) {
    return <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10"><section className="rounded-2xl border border-slate-200 bg-white p-6" aria-live="polite">Loading report…</section></main>;
  }

  if (data.message) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-900">Report not available yet</h1>
          <p className="mt-2 text-sm leading-6 text-amber-900">{data.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/reports/current" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">My Reports</Link>
            <Link href="/assessment/current" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Assessment Center</Link>
          </div>
        </section>
      </main>
    );
  }

  const title = data.assessment?.title || "Leadership Development Report";
  const isManual = data.reportWorkflow === "MANUAL_PDF_UPLOAD";
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 md:p-9">
      <header className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-amber-50 p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">OLQ Lab report</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-700">Prepared for {data.participantName || "Participant"}</p>
        <p className="mt-1 text-sm text-slate-600">Assessment completed: {formatLocalDateTime(data.submittedAt)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={`/api/reports/me/${encodeURIComponent(assessmentId)}/pdf`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Download PDF</a>
          <Link href="/reports/current" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">My Reports</Link>
          <Link href="/dashboard" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Dashboard</Link>
        </div>
      </header>

      <section className="min-h-[24rem] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 md:p-10">
        {isManual ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Your PDF report is ready</h2>
            <p className="mt-2 text-sm text-slate-600">This assessment uses an administrator-reviewed PDF. Use the download button above to open it.</p>
          </div>
        ) : data.canonicalHtml ? (
          <article className="report-document" dangerouslySetInnerHTML={{ __html: data.canonicalHtml }} />
        ) : (
          <p className="text-slate-600">Report content is unavailable.</p>
        )}
      </section>
    </main>
  );
}
