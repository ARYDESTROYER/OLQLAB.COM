"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/admin/Toast";

type TabKey = "CONTENT" | "ACCESS" | "PARTICIPANTS" | "POLICY" | "JOBS";

type AssessmentDetail = {
  id: string;
  title: string;
  ownerTenantId: string | null;
  isPublished: boolean;
  ownerTenant?: { id: string; name: string } | null;
  policy?: {
    showResultsToEmployee: boolean;
    resultReleaseDelayHours: number;
    postSubmitMessage: string;
    leaderCanViewFullReport: boolean;
  } | null;
  _count?: {
    sections: number;
    questions: number;
    sessions: number;
    userEnrollments: number;
    tenantEnrollments: number;
  };
};

type Tenant = {
  id: string;
  name: string;
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "EMPLOYEE" | "LEADER";
};

type AssessmentAccessData = {
  assessment: {
    id: string;
    title: string;
    isPublished: boolean;
    ownerTenant?: { id: string; name: string } | null;
  };
  enrollments: {
    users: Array<{
      id: string;
      userId: string;
      active: boolean;
      createdAt: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      };
    }>;
    tenants: Array<{
      id: string;
      tenantId: string;
      includeFutureUsers: boolean;
      active: boolean;
      createdAt: string;
      tenant: {
        id: string;
        name: string;
        type: string;
      };
    }>;
  };
  activeUsers: Array<{
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    managerEmail: string | null;
    sources: Array<{ scope: "USER" | "TENANT"; enrollmentId: string }>;
  }>;
  pendingJobs: Array<{
    id: string;
    targetScope: "USER" | "TENANT";
    targetId: string;
    status: string;
    reportMode: string;
    effectiveAt: string;
  }>;
};

type Participant = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "EMPLOYEE" | "LEADER";
  managerEmail: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
  startedAt: string | null;
  submittedAt: string | null;
  retestEligibleAt: string | null;
  canRetestNow: boolean;
  sources: Array<{ scope: "USER" | "TENANT"; enrollmentId: string }>;
};

type JobRow = {
  id: string;
  targetScope: "USER" | "TENANT";
  targetId: string;
  status: string;
  reportMode: string;
  effectiveAt: string;
  notifyByEmail: boolean;
  linkTtlHours: number | null;
  errorMessage: string | null;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "CONTENT", label: "Content" },
  { key: "ACCESS", label: "Access" },
  { key: "PARTICIPANTS", label: "Participants" },
  { key: "POLICY", label: "Policy" },
  { key: "JOBS", label: "Jobs" },
];

export default function AssessmentDetailClient({ assessmentId }: { assessmentId: string }) {
  const [tab, setTab] = useState<TabKey>("CONTENT");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [access, setAccess] = useState<AssessmentAccessData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [contentForm, setContentForm] = useState({ title: "" });
  const [policyForm, setPolicyForm] = useState({
    isPublished: false,
    showResultsToEmployee: true,
    resultReleaseDelayHours: 0,
    postSubmitMessage: "Thanks for completing your assessment.",
    leaderCanViewFullReport: true,
  });

  const [enrollForm, setEnrollForm] = useState({
    scope: "USER" as "USER" | "TENANT",
    targetId: "",
    includeFutureUsers: true,
  });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardPreview, setWizardPreview] = useState<Participant[] | null>(null);
  const [wizardForm, setWizardForm] = useState({
    scope: "USER" as "USER" | "TENANT",
    targetId: "",
    timingMode: "IMMEDIATE" as "IMMEDIATE" | "AFTER_HOURS" | "AT_DATE",
    afterHours: 24,
    atDateTime: "",
    reportMode: "KEEP_APP_ACCESS" as "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE",
    notifyByEmail: false,
    linkTtlHours: 168,
  });

  const [participantStatusFilter, setParticipantStatusFilter] = useState<
    "ALL" | "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED"
  >("ALL");

  const filteredParticipants = useMemo(
    () =>
      participants.filter((item) =>
        participantStatusFilter === "ALL" ? true : item.status === participantStatusFilter,
      ),
    [participants, participantStatusFilter],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, accessRes, participantsRes, jobsRes, tenantsRes, usersRes] = await Promise.all([
        fetch(`/api/admin/assessments/${assessmentId}`),
        fetch(`/api/admin/assessments/${assessmentId}/access`),
        fetch(`/api/admin/assessments/${assessmentId}/participants`),
        fetch(`/api/admin/assessments/${assessmentId}/jobs`),
        fetch("/api/admin/tenants"),
        fetch("/api/admin/users"),
      ]);

      const [detailData, accessData, participantsData, jobsData, tenantsData, usersData] = await Promise.all([
        detailRes.json(),
        accessRes.json(),
        participantsRes.json(),
        jobsRes.json(),
        tenantsRes.json(),
        usersRes.json(),
      ]);

      if (detailRes.ok) {
        setDetail(detailData.assessment);
        setContentForm({
          title: detailData.assessment.title,
        });
        setPolicyForm({
          isPublished: Boolean(detailData.assessment.isPublished),
          showResultsToEmployee:
            detailData.assessment.policy?.showResultsToEmployee ?? true,
          resultReleaseDelayHours:
            detailData.assessment.policy?.resultReleaseDelayHours ?? 0,
          postSubmitMessage:
            detailData.assessment.policy?.postSubmitMessage ||
            "Thanks for completing your assessment.",
          leaderCanViewFullReport:
            detailData.assessment.policy?.leaderCanViewFullReport ?? true,
        });
      }

      if (accessRes.ok) {
        setAccess(accessData);
      }

      if (participantsRes.ok) {
        setParticipants(participantsData.participants || []);
      }

      if (jobsRes.ok) {
        setJobs(jobsData.jobs || []);
      }

      setTenants(tenantsData.tenants || []);
      setUsers((usersData.users || []).filter((item: User) => item.role !== "ADMIN"));
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function saveContent() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: contentForm.title,
        }),
      });
      const data = await res.json();
      if (res.ok) toast("Content saved.", "success");
      else toast(data.error || "Failed to save.", "error");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm),
      });
      const data = await res.json();
      if (res.ok) toast("Policy saved.", "success");
      else toast(data.error || "Failed to save policy.", "error");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function createEnrollment() {
    if (!enrollForm.targetId) {
      toast("Select a target before creating enrollment.", "error");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrollForm),
      });
      const data = await res.json();
      if (res.ok) toast("Enrollment created.", "success");
      else toast(data.error || "Failed to create enrollment.", "error");
      if (res.ok) {
        setEnrollForm((prev) => ({ ...prev, targetId: "" }));
        await loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  function toEffectiveAt() {
    if (wizardForm.timingMode === "IMMEDIATE") return new Date().toISOString();
    if (wizardForm.timingMode === "AFTER_HOURS") {
      return new Date(Date.now() + wizardForm.afterHours * 60 * 60 * 1000).toISOString();
    }

    const parsed = new Date(wizardForm.atDateTime);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  async function previewWizard() {
    const effectiveAt = toEffectiveAt();
    if (!effectiveAt || !wizardForm.targetId) {
      toast("Wizard timing or target is invalid.", "error");
      return;
    }

    const res = await fetch(`/api/admin/assessments/${assessmentId}/unenroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: wizardForm.scope,
        targetId: wizardForm.targetId,
        effectiveAt,
        reportMode: wizardForm.reportMode,
        notifyByEmail: wizardForm.notifyByEmail,
        linkTtlHours: wizardForm.linkTtlHours,
        dryRun: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) toast(data.error || "Preview failed.", "error");

    if (res.ok) {
      setWizardPreview(data.impactedUsers || []);
      setWizardStep(5);
    }
  }

  async function confirmWizard() {
    const effectiveAt = toEffectiveAt();
    if (!effectiveAt || !wizardForm.targetId) {
      toast("Wizard timing or target is invalid.", "error");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}/unenroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: wizardForm.scope,
          targetId: wizardForm.targetId,
          effectiveAt,
          reportMode: wizardForm.reportMode,
          notifyByEmail: wizardForm.notifyByEmail,
          linkTtlHours: wizardForm.linkTtlHours,
        }),
      });
      const data = await res.json();
      if (res.ok) toast("Unenroll job created.", "success");
      else toast(data.error || "Failed to create job.", "error");
      if (res.ok) {
        setWizardOpen(false);
        setWizardStep(1);
        setWizardPreview(null);
        await loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function runJob(jobId: string) {
    const res = await fetch(`/api/internal/jobs/unenrollments/${jobId}/run`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) toast("Job started.", "success");
    else toast(data.error || "Failed to run job.", "error");
    await loadAll();
  }

  async function participantAction(
    participant: Participant,
    action: "REGENERATE" | "RETEST_NOW" | "RESET",
  ) {
    setBusy(true);
    try {
      let res: Response;
      if (action === "REGENERATE") {
        res = await fetch("/api/admin/reports/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessmentId, userId: participant.userId }),
        });
      } else if (action === "RETEST_NOW") {
        res = await fetch(
          `/api/admin/assessments/${assessmentId}/participants/${participant.userId}/retest`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "IMMEDIATE" }),
          },
        );
      } else {
        res = await fetch(
          `/api/admin/assessments/${assessmentId}/participants/${participant.userId}/reset`,
          { method: "POST" },
        );
      }

      const data = await res.json();
      if (res.ok) toast(`${action} completed.`, "success");
      else toast(data.error || `Failed to ${action.toLowerCase()}.`, "error");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !detail) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Loading assessment...</h2>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{detail.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{detail.id}</p>
          </div>
          <Link
            href="/admin/assessments"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Back to Assessments
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === item.key
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
                }`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === "CONTENT" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold">Assessment Content</h3>
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Title</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={contentForm.title}
              onChange={(e) => setContentForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Sections: {detail._count?.sections || 0} | Questions: {detail._count?.questions || 0} |
            User enrollments: {detail._count?.userEnrollments || 0} | Tenant enrollments: {detail._count?.tenantEnrollments || 0}
          </p>
          <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={saveContent} disabled={busy}>
            Save Content Metadata
          </button>
        </section>
      )}

      {tab === "ACCESS" && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Access Management</h3>
            <button
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              onClick={() => {
                setWizardOpen(true);
                setWizardStep(1);
                setWizardPreview(null);
              }}
            >
              Open Unenroll Wizard
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Create Enrollment</p>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <select
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={enrollForm.scope}
                onChange={(e) =>
                  setEnrollForm((prev) => ({
                    ...prev,
                    scope: e.target.value as "USER" | "TENANT",
                    targetId: "",
                  }))
                }
              >
                <option value="USER">USER</option>
                <option value="TENANT">TENANT</option>
              </select>

              <select
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-2"
                value={enrollForm.targetId}
                onChange={(e) => setEnrollForm((prev) => ({ ...prev, targetId: e.target.value }))}
              >
                <option value="">Select target</option>
                {enrollForm.scope === "USER"
                  ? users
                    .filter((user) => user.role !== "ADMIN")
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))
                  : tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
              </select>

              <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={enrollForm.includeFutureUsers}
                  onChange={(e) =>
                    setEnrollForm((prev) => ({ ...prev, includeFutureUsers: e.target.checked }))
                  }
                />
                Include future users
              </label>
            </div>

            <button className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={createEnrollment} disabled={busy}>
              Create / Reactivate Enrollment
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-3">
              <h4 className="text-sm font-semibold">User Enrollments</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {access?.enrollments.users.length ? (
                  access.enrollments.users.map((enrollment) => (
                    <li key={enrollment.id}>
                      {enrollment.user.firstName} {enrollment.user.lastName} ({enrollment.user.email}) {" "}
                      <span className="text-xs text-slate-500">[{enrollment.active ? "ACTIVE" : "INACTIVE"}]</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">No user enrollments</li>
                )}
              </ul>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-3">
              <h4 className="text-sm font-semibold">Tenant Enrollments</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {access?.enrollments.tenants.length ? (
                  access.enrollments.tenants.map((enrollment) => (
                    <li key={enrollment.id}>
                      {enrollment.tenant.name} ({enrollment.includeFutureUsers ? "Dynamic" : "Snapshot"}) {" "}
                      <span className="text-xs text-slate-500">[{enrollment.active ? "ACTIVE" : "INACTIVE"}]</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">No tenant enrollments</li>
                )}
              </ul>
            </article>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-3">
            <h4 className="text-sm font-semibold">Resolved Active Users</h4>
            <div className="mt-2 overflow-auto rounded border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {(access?.activeUsers || []).map((user) => (
                    <tr key={user.userId} className="border-t border-slate-100">
                      <td className="px-3 py-2">{user.firstName} {user.lastName} ({user.email})</td>
                      <td className="px-3 py-2">{user.role}</td>
                      <td className="px-3 py-2">{user.sources.map((source) => source.scope).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {wizardOpen && (
            <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="text-sm font-semibold">Unenroll Wizard (Step {wizardStep} / 5)</h4>

              {wizardStep === 1 && (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    value={wizardForm.scope}
                    onChange={(e) =>
                      setWizardForm((prev) => ({
                        ...prev,
                        scope: e.target.value as "USER" | "TENANT",
                        targetId: "",
                      }))
                    }
                  >
                    <option value="USER">USER</option>
                    <option value="TENANT">TENANT</option>
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-2"
                    value={wizardForm.targetId}
                    onChange={(e) => setWizardForm((prev) => ({ ...prev, targetId: e.target.value }))}
                  >
                    <option value="">Select unenroll target</option>
                    {wizardForm.scope === "USER"
                      ? (access?.enrollments.users || []).map((enrollment) => (
                        <option key={enrollment.userId} value={enrollment.userId}>
                          {enrollment.user.firstName} {enrollment.user.lastName} ({enrollment.user.email})
                        </option>
                      ))
                      : (access?.enrollments.tenants || []).map((enrollment) => (
                        <option key={enrollment.tenantId} value={enrollment.tenantId}>
                          {enrollment.tenant.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="mt-3 space-y-2">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    value={wizardForm.timingMode}
                    onChange={(e) =>
                      setWizardForm((prev) => ({
                        ...prev,
                        timingMode: e.target.value as "IMMEDIATE" | "AFTER_HOURS" | "AT_DATE",
                      }))
                    }
                  >
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="AFTER_HOURS">After N hours</option>
                    <option value="AT_DATE">Specific datetime</option>
                  </select>

                  {wizardForm.timingMode === "AFTER_HOURS" && (
                    <input
                      type="number"
                      min={1}
                      className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      value={wizardForm.afterHours}
                      onChange={(e) =>
                        setWizardForm((prev) => ({ ...prev, afterHours: Number(e.target.value) }))
                      }
                    />
                  )}

                  {wizardForm.timingMode === "AT_DATE" && (
                    <input
                      type="datetime-local"
                      className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      value={wizardForm.atDateTime}
                      onChange={(e) =>
                        setWizardForm((prev) => ({ ...prev, atDateTime: e.target.value }))
                      }
                    />
                  )}
                </div>
              )}

              {wizardStep === 3 && (
                <div className="mt-3">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    value={wizardForm.reportMode}
                    onChange={(e) =>
                      setWizardForm((prev) => ({
                        ...prev,
                        reportMode: e.target.value as "KEEP_APP_ACCESS" | "LINK_ONLY" | "REVOKE",
                      }))
                    }
                  >
                    <option value="KEEP_APP_ACCESS">Unenroll but keep app report access</option>
                    <option value="LINK_ONLY">Unenroll and give temporary secure link only</option>
                    <option value="REVOKE">Unenroll and revoke report access</option>
                  </select>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={wizardForm.notifyByEmail}
                      onChange={(e) =>
                        setWizardForm((prev) => ({ ...prev, notifyByEmail: e.target.checked }))
                      }
                    />
                    Send email notification
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    value={wizardForm.linkTtlHours}
                    onChange={(e) =>
                      setWizardForm((prev) => ({ ...prev, linkTtlHours: Number(e.target.value) }))
                    }
                  />
                </div>
              )}

              {wizardStep === 5 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-slate-700">
                    Impact preview: {wizardPreview?.length || 0} user(s)
                  </p>
                  <ul className="max-h-40 overflow-auto rounded border border-slate-200 bg-white p-2 text-xs">
                    {(wizardPreview || []).map((item) => (
                      <li key={item.userId}>
                        {item.firstName} {item.lastName} ({item.email})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  onClick={() => {
                    if (wizardStep === 1) {
                      setWizardOpen(false);
                    } else {
                      setWizardStep((prev) => Math.max(1, prev - 1));
                    }
                  }}
                >
                  {wizardStep === 1 ? "Close" : "Back"}
                </button>

                {wizardStep < 4 && (
                  <button
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white"
                    onClick={() => setWizardStep((prev) => Math.min(4, prev + 1))}
                  >
                    Next
                  </button>
                )}

                {wizardStep === 4 && (
                  <button
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white"
                    onClick={previewWizard}
                  >
                    Preview Impact
                  </button>
                )}

                {wizardStep === 5 && (
                  <button
                    className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs text-white"
                    onClick={confirmWizard}
                    disabled={busy}
                  >
                    Confirm Unenroll Job
                  </button>
                )}
              </div>
            </article>
          )}
        </section>
      )}

      {tab === "PARTICIPANTS" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold">Participants</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["ALL", "NOT_STARTED", "IN_PROGRESS", "SUBMITTED"] as const).map((status) => (
              <button
                key={status}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${participantStatusFilter === status
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700"
                  }`}
                onClick={() => setParticipantStatusFilter(status)}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Sources</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => (
                  <tr key={participant.userId} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      {participant.firstName} {participant.lastName}
                      <div className="text-xs text-slate-500">{participant.email}</div>
                    </td>
                    <td className="px-3 py-2">{participant.status}</td>
                    <td className="px-3 py-2">{participant.sources.map((source) => source.scope).join(", ")}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {participant.status === "SUBMITTED" && (
                          <Link
                            href={`/reports/leader/${participant.userId}/${assessmentId}`}
                            target="_blank"
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] hover:bg-emerald-100 transition-colors"
                          >
                            View Report
                          </Link>
                        )}
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px]"
                          onClick={() => participantAction(participant, "REGENERATE")}
                          disabled={busy || participant.status !== "SUBMITTED"}
                        >
                          Regenerate
                        </button>
                        <button
                          className="rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[11px]"
                          onClick={() => participantAction(participant, "RETEST_NOW")}
                          disabled={busy || participant.status !== "SUBMITTED"}
                        >
                          Retest Now
                        </button>
                        <button
                          className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px]"
                          onClick={() => participantAction(participant, "RESET")}
                          disabled={busy || participant.status === "NOT_STARTED"}
                        >
                          Reset Stats
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "POLICY" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold">Publish & Visibility Policy</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policyForm.isPublished}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, isPublished: e.target.checked }))}
              />
              Publish assessment
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policyForm.showResultsToEmployee}
                onChange={(e) =>
                  setPolicyForm((prev) => ({ ...prev, showResultsToEmployee: e.target.checked }))
                }
              />
              Show results to employee
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policyForm.leaderCanViewFullReport}
                onChange={(e) =>
                  setPolicyForm((prev) => ({ ...prev, leaderCanViewFullReport: e.target.checked }))
                }
              />
              Leader can view full report
            </label>
            <input
              type="number"
              min={0}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              value={policyForm.resultReleaseDelayHours}
              onChange={(e) =>
                setPolicyForm((prev) => ({
                  ...prev,
                  resultReleaseDelayHours: Number(e.target.value),
                }))
              }
              placeholder="Result delay hours"
            />
          </div>
          <input
            className="mt-3 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
            value={policyForm.postSubmitMessage}
            onChange={(e) =>
              setPolicyForm((prev) => ({ ...prev, postSubmitMessage: e.target.value }))
            }
            placeholder="Post-submit message"
          />
          <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={savePolicy} disabled={busy}>
            Save Policy
          </button>
        </section>
      )}

      {tab === "JOBS" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold">Unenroll Jobs</h3>
          <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium">{job.id}</div>
                      <div className="text-xs text-slate-500">{new Date(job.effectiveAt).toLocaleString()}</div>
                      {job.errorMessage ? <div className="text-xs text-rose-700">{job.errorMessage}</div> : null}
                    </td>
                    <td className="px-3 py-2">{job.targetScope}</td>
                    <td className="px-3 py-2">{job.targetId}</td>
                    <td className="px-3 py-2">{job.reportMode}</td>
                    <td className="px-3 py-2">{job.status}</td>
                    <td className="px-3 py-2">
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px]"
                        onClick={() => runJob(job.id)}
                      >
                        Run Now
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Output section removed — using toast notifications instead */}
    </div>
  );
}
