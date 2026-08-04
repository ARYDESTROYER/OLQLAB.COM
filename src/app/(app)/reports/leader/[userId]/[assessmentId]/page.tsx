"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatLocalDateTime } from "@/lib/date-time";

type LeaderReportData = {
  employee?: { firstName: string; lastName: string };
  assessment?: { id: string; title: string };
  submittedAt?: string | null;
  reportWorkflow?: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
  canonicalHtml?: string | null;
};

export default function LeaderReportPage() {
  const params = useParams<{ userId: string; assessmentId: string }>();
  const userId = typeof params?.userId === "string" ? params.userId : "";
  const assessmentId = typeof params?.assessmentId === "string" ? params.assessmentId : "";
  const [data, setData] = useState<LeaderReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId || !assessmentId) return;
    const controller = new AbortController();
    const run = async () => {
      try {
        const res = await fetch(
          `/api/reports/leader/${encodeURIComponent(userId)}/${encodeURIComponent(assessmentId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await res.json().catch(() => ({}))) as LeaderReportData & { error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not load leader report.");
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Could not load leader report.");
      }
    };
    void run();
    return () => controller.abort();
  }, [assessmentId, userId]);

  if (!userId || !assessmentId || error) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert">
          <h1 className="text-xl font-semibold text-rose-900">Could not load leader report</h1>
          <p className="mt-2 text-sm text-rose-800">{error || "Invalid report route."}</p>
          <Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Dashboard</Link>
        </section>
      </main>
    );
  }
  if (!data) return <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-10"><section className="rounded-2xl border border-slate-200 bg-white p-6" aria-live="polite">Loading leader report…</section></main>;

  const participantName = `${data.employee?.firstName || ""} ${data.employee?.lastName || ""}`.trim() || "Participant";
  const isManual = data.reportWorkflow === "MANUAL_PDF_UPLOAD";
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 md:p-9">
      <header className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-lime-50 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leader view</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">{participantName}</h1>
        <p className="mt-1 text-sm text-slate-700">{data.assessment?.title || "Leadership Development Report"}</p>
        <p className="mt-1 text-sm text-slate-600">Assessment completed: {formatLocalDateTime(data.submittedAt)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={`/api/reports/leader/${encodeURIComponent(userId)}/${encodeURIComponent(assessmentId)}/pdf`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Download PDF</a>
          <Link href="/reports/team" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Team Reports</Link>
          <Link href="/dashboard" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Dashboard</Link>
        </div>
      </header>
      <section className="min-h-[24rem] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 md:p-10">
        {isManual ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            <h2 className="text-xl font-semibold">Administrator-reviewed PDF</h2>
            <p className="mt-2 text-sm text-slate-600">Use the download button above to view this participant&apos;s report.</p>
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
