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
        className="fixed inset-0 z-[9990] bg-[#101114]/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        className="animate-slide-in-panel fixed right-0 top-0 z-[9991] flex h-full w-full max-w-lg flex-col border-l border-[#101114]/12 bg-[#EFE8DA] shadow-[0_24px_60px_-30px_rgba(16,17,20,0.55)]"
      >
        <div className="border-t-2 border-[#B5803C]" />
        <div className="flex items-center justify-between border-b border-[#101114]/10 px-6 py-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#B5803C]">
              Inspect
            </p>
            <h2 className="font-display mt-1 text-lg tracking-tight text-[#101114]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center border border-[#101114]/15 bg-[#F4EEE0]/60 text-[#101114]/55 transition-colors duration-200 hover:border-[#B5803C]/55 hover:text-[#101114]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>
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
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
          Assessment sessions ({sessions.length})
        </p>
        {sessions.length === 0 ? (
          <p className="mt-3 text-xs text-[#101114]/55">No sessions found.</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.assessment.title}</td>
                    <td>
                      <span
                        className="workspace-chip"
                        data-tone={
                          s.status === "SUBMITTED"
                            ? "brass"
                            : s.status === "IN_PROGRESS"
                              ? "warn"
                              : undefined
                        }
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="text-[#101114]/60">
                      {new Date(s.startedAt).toLocaleDateString()}
                    </td>
                    <td className="text-[#101114]/60">
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
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
        Assessment access ({relevant.length})
      </p>
      {relevant.length === 0 ? (
        <p className="mt-3 text-xs text-[#101114]/55">
          No assessment access found for this user.
        </p>
      ) : (
        <div className="mt-3 overflow-auto">
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Enrolled</th>
                <th>Can start</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {relevant.map((entry) => (
                <tr key={entry.assessment.id}>
                  <td>
                    <span>{entry.assessment.title}</span>
                    {!entry.assessment.isPublished && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-[#101114]/45">
                        Draft
                      </span>
                    )}
                  </td>
                  <td>{renderBool(entry.hasActiveEnrollment)}</td>
                  <td>{renderBool(entry.canStartAssessment)}</td>
                  <td>
                    {entry.isRevoked ? (
                      <span className="font-semibold text-[#101114]">Revoked</span>
                    ) : entry.canViewViaLinkOnly ? (
                      <span className="font-semibold text-[#B5803C]">Link only</span>
                    ) : entry.canViewAppReport ? (
                      <span className="font-semibold text-[#B5803C]">Full</span>
                    ) : (
                      <span className="text-[#101114]/45">—</span>
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
  if (val === true) return <span className="font-semibold text-[#B5803C]">Yes</span>;
  if (val === false) return <span className="text-[#101114]/45">No</span>;
  return <span className="text-[#101114]/45">—</span>;
}
