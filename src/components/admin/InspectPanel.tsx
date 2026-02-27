"use client";

import { useEffect, useRef } from "react";

type InspectPanelProps = {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
};

export default function InspectPanel({ open, title, onClose, children }: InspectPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    // Lock body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[9990] bg-black/30 backdrop-blur-[2px]"
                onClick={onClose}
            />

            {/* Panel */}
            <aside
                ref={panelRef}
                className="fixed right-0 top-0 z-[9991] flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl animate-slide-in-panel"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {children}
                </div>
            </aside>
        </>
    );
}

/* ─── Reusable sub-components for Tests / Access views ─── */

type Session = {
    id: string;
    status: string;
    startedAt: string;
    submittedAt?: string | null;
    assessment: { id: string; title: string };
};

export function TestsView({ sessions }: { sessions: Session[] }) {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-semibold text-slate-700">Assessment Sessions ({sessions.length})</h3>
                {sessions.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-400">No sessions found.</p>
                ) : (
                    <div className="mt-2 overflow-auto rounded-lg border border-slate-200">
                        <table className="min-w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-3 py-2">Assessment</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Started</th>
                                    <th className="px-3 py-2">Submitted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((s) => (
                                    <tr key={s.id} className="border-t border-slate-100">
                                        <td className="px-3 py-2 font-medium">{s.assessment.title}</td>
                                        <td className="px-3 py-2">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.status === "SUBMITTED"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : s.status === "IN_PROGRESS"
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-slate-100 text-slate-600"
                                                }`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-500">{new Date(s.startedAt).toLocaleDateString()}</td>
                                        <td className="px-3 py-2 text-slate-500">
                                            {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

type AccessEntry = {
    assessment: { id: string; title: string; isPublished: boolean };
    hasActiveEnrollment?: boolean;
    canStartAssessment?: boolean;
    canViewAppReport?: boolean;
    canViewViaLinkOnly?: boolean;
    isRevoked?: boolean;
};

export function AccessView({ access }: { access: AccessEntry[] }) {
    // Only show assessments where the user has some access relationship
    const relevant = access.filter(
        (a) => a.hasActiveEnrollment || a.canViewAppReport || a.canViewViaLinkOnly || a.isRevoked,
    );

    return (
        <div>
            <h3 className="text-sm font-semibold text-slate-700">Assessment Access ({relevant.length})</h3>
            {relevant.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">No assessment access found for this user.</p>
            ) : (
                <div className="mt-2 overflow-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-3 py-2">Assessment</th>
                                <th className="px-3 py-2">Enrolled</th>
                                <th className="px-3 py-2">Can Start</th>
                                <th className="px-3 py-2">Report</th>
                            </tr>
                        </thead>
                        <tbody>
                            {relevant.map((entry) => (
                                <tr key={entry.assessment.id} className="border-t border-slate-100">
                                    <td className="px-3 py-2">
                                        <span className="font-medium">{entry.assessment.title}</span>
                                        {!entry.assessment.isPublished && (
                                            <span className="ml-1.5 text-[10px] text-slate-400">(Draft)</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{renderBool(entry.hasActiveEnrollment)}</td>
                                    <td className="px-3 py-2">{renderBool(entry.canStartAssessment)}</td>
                                    <td className="px-3 py-2">
                                        {entry.isRevoked ? (
                                            <span className="text-rose-500 font-semibold">Revoked</span>
                                        ) : entry.canViewViaLinkOnly ? (
                                            <span className="text-amber-600 font-semibold">Link only</span>
                                        ) : entry.canViewAppReport ? (
                                            <span className="text-emerald-600 font-semibold">Full</span>
                                        ) : (
                                            <span className="text-slate-400">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function renderBool(val?: boolean) {
    if (val === true) return <span className="text-emerald-600 font-semibold">Yes</span>;
    if (val === false) return <span className="text-slate-400">No</span>;
    return <span className="text-slate-400">—</span>;
}
