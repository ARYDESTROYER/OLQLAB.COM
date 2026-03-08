"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/admin/Toast";
import { buildAssessmentCsvTemplate } from "@/lib/assessment-question-csv";

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
    reportWorkflow: "AI_STANDARD" | "MANUAL_PDF_UPLOAD";
    questionPresentationMode: "ALL_AT_ONCE" | "ONE_AT_A_TIME";
    randomizeQuestionOrder: boolean;
    submissionAlertAdminIds: string[];
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

type AssessmentSection = {
  id: string;
  title: string;
  sortOrder: number;
};

type QuestionRow = {
  id: string;
  prompt: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageCaption: string | null;
  trait: string | null;
  reverse: boolean;
  sectionId: string | null;
  section?: { id: string; title: string } | null;
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
  reportId: string | null;
  reportStatus: "DRAFT" | "PUBLISHED" | null;
  reportAvailableAt: string | null;
  reportDeliveryMethod: "DASHBOARD_ONLY" | "EMAIL_LINK" | null;
  hasManualPdf: boolean;
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

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "CONTENT", label: "Content" },
  { key: "ACCESS", label: "Access" },
  { key: "PARTICIPANTS", label: "Participants" },
  { key: "POLICY", label: "Policy" },
  { key: "JOBS", label: "Jobs" },
];

function formatScopeLabel(scope: "USER" | "TENANT") {
  return scope === "TENANT" ? "ORGANISATION" : "USER";
}

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
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [sections, setSections] = useState<AssessmentSection[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [questionForm, setQuestionForm] = useState({
    prompt: "",
    imageUrl: "",
    imageAlt: "",
    imageCaption: "",
    trait: "",
    reverse: false,
    sectionId: "",
  });

  const [contentForm, setContentForm] = useState({ title: "" });
  const [csvImportMode, setCsvImportMode] = useState<"REPLACE_ALL" | "APPEND">("REPLACE_ALL");
  const [csvImportFile, setCsvImportFile] = useState<File | null>(null);
  const [csvImportBusy, setCsvImportBusy] = useState(false);
  const [csvImportSummary, setCsvImportSummary] = useState<CsvPreviewSummary | null>(null);
  const [csvImportPreview, setCsvImportPreview] = useState<CsvPreviewQuestion[]>([]);
  const [csvImportIssues, setCsvImportIssues] = useState<CsvIssue[]>([]);
  const [policyForm, setPolicyForm] = useState({
    isPublished: false,
    showResultsToEmployee: true,
    resultReleaseDelayHours: 0,
    postSubmitMessage: "Thanks for completing your assessment.",
    leaderCanViewFullReport: true,
    reportWorkflow: "AI_STANDARD" as "AI_STANDARD" | "MANUAL_PDF_UPLOAD",
    questionPresentationMode: "ALL_AT_ONCE" as "ALL_AT_ONCE" | "ONE_AT_A_TIME",
    randomizeQuestionOrder: false,
    submissionAlertAdminIds: [] as string[],
  });

  const [enrollForm, setEnrollForm] = useState({
    scope: "USER" as "USER" | "TENANT",
    targetId: "",
    includeFutureUsers: true,
    reportMode: "AUTO" as "AUTO" | "MANUAL",
    reportDelayHours: 0,
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
  const isManualWorkflow = policyForm.reportWorkflow === "MANUAL_PDF_UPLOAD";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, accessRes, participantsRes, jobsRes, tenantsRes, usersRes, questionsRes] = await Promise.all([
        fetch(`/api/admin/assessments/${assessmentId}`),
        fetch(`/api/admin/assessments/${assessmentId}/access`),
        fetch(`/api/admin/assessments/${assessmentId}/participants`),
        fetch(`/api/admin/assessments/${assessmentId}/jobs`),
        fetch("/api/admin/tenants"),
        fetch("/api/admin/users"),
        fetch(`/api/admin/assessments/${assessmentId}/questions`),
      ]);

      const [detailData, accessData, participantsData, jobsData, tenantsData, usersData, questionsData] = await Promise.all([
        detailRes.json(),
        accessRes.json(),
        participantsRes.json(),
        jobsRes.json(),
        tenantsRes.json(),
        usersRes.json(),
        questionsRes.json(),
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
          reportWorkflow:
            detailData.assessment.policy?.reportWorkflow ?? "AI_STANDARD",
          questionPresentationMode:
            detailData.assessment.policy?.questionPresentationMode ?? "ALL_AT_ONCE",
          randomizeQuestionOrder:
            detailData.assessment.policy?.randomizeQuestionOrder ?? false,
          submissionAlertAdminIds:
            detailData.assessment.policy?.submissionAlertAdminIds ?? [],
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
      setAdminUsers((usersData.users || []).filter((item: User) => item.role === "ADMIN"));
      if (questionsRes.ok) {
        const nextSections = questionsData.sections || [];
        setSections(nextSections);
        setQuestions(questionsData.questions || []);
        setQuestionForm((prev) => ({
          ...prev,
          sectionId: prev.sectionId || nextSections[0]?.id || "",
        }));
      }
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

  async function addQuestion() {
    if (!questionForm.prompt.trim()) {
      toast("Question prompt is required.", "error");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/assessments/${assessmentId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: questionForm.prompt,
          imageUrl: questionForm.imageUrl,
          imageAlt: questionForm.imageAlt,
          imageCaption: questionForm.imageCaption,
          trait: questionForm.trait,
          reverse: questionForm.reverse,
          sectionId: questionForm.sectionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to add question.", "error");
        return;
      }
      toast("Question added.", "success");
      setQuestionForm((prev) => ({
        ...prev,
        prompt: "",
        imageUrl: "",
        imageAlt: "",
        imageCaption: "",
        trait: "",
        reverse: false,
      }));
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestion(question: QuestionRow) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/assessments/${assessmentId}/questions/${question.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: question.prompt,
            imageUrl: question.imageUrl || "",
            imageAlt: question.imageAlt || "",
            imageCaption: question.imageCaption || "",
            trait: question.trait || "",
            reverse: question.reverse,
            sectionId: question.sectionId,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to save question.", "error");
        return;
      }
      toast("Question updated.", "success");
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(questionId: string) {
    if (!window.confirm("Delete this question? This cannot be undone.")) return;

    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/assessments/${assessmentId}/questions/${questionId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to delete question.", "error");
        return;
      }
      toast("Question deleted.", "success");
      await loadAll();
    } finally {
      setBusy(false);
    }
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

  async function validateCsvImport() {
    if (!csvImportFile) {
      toast("Select a CSV file before validation.", "error");
      return;
    }

    setCsvImportBusy(true);
    try {
      const formData = new FormData();
      formData.append("mode", csvImportMode);
      formData.append("file", csvImportFile);
      formData.append("dryRun", "true");

      const res = await fetch(
        `/api/admin/assessments/${assessmentId}/questions/import-csv?dryRun=1`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCsvImportSummary((data as { summary?: CsvPreviewSummary }).summary || null);
        setCsvImportPreview([]);
        setCsvImportIssues(((data as { issues?: CsvIssue[] }).issues || []).slice(0, 30));
        toast((data as { error?: string }).error || "CSV validation failed.", "error");
        return;
      }

      setCsvImportSummary((data as { summary?: CsvPreviewSummary }).summary || null);
      setCsvImportPreview(
        ((data as { preview?: { firstQuestions?: CsvPreviewQuestion[] } }).preview
          ?.firstQuestions || []) as CsvPreviewQuestion[],
      );
      setCsvImportIssues([]);
      toast("CSV validation succeeded.", "success");
    } finally {
      setCsvImportBusy(false);
    }
  }

  async function applyCsvImport() {
    if (!csvImportFile) {
      toast("Select a CSV file before import.", "error");
      return;
    }

    setCsvImportBusy(true);
    try {
      const formData = new FormData();
      formData.append("mode", csvImportMode);
      formData.append("file", csvImportFile);

      const res = await fetch(`/api/admin/assessments/${assessmentId}/questions/import-csv`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCsvImportIssues(((data as { issues?: CsvIssue[] }).issues || []).slice(0, 30));
        toast((data as { error?: string }).error || "CSV import failed.", "error");
        return;
      }

      toast("CSV questions imported.", "success");
      setCsvImportFile(null);
      setCsvImportSummary(null);
      setCsvImportPreview([]);
      setCsvImportIssues([]);
      await loadAll();
    } finally {
      setCsvImportBusy(false);
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

  async function uploadManualPdf(participant: Participant, file: File) {
    if (!participant.reportId) {
      toast("No report exists yet for this participant.", "error");
      return;
    }

    const notifyNow = window.confirm(
      "Upload successful report PDF. Notify participant immediately by email link?",
    );

    const formData = new FormData();
    formData.append("file", file);
    formData.append("notifyNow", String(notifyNow));
    formData.append("deliveryMethod", "EMAIL_LINK");

    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/reports/${participant.reportId}/manual-pdf`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(notifyNow ? "PDF uploaded and user notified." : "PDF uploaded. Notification deferred.", "success");
      } else {
        toast((data as { error?: string }).error || "Failed to upload PDF.", "error");
      }
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function participantAction(
    participant: Participant,
    action:
      | "REGENERATE"
      | "RETEST_NOW"
      | "RESET"
      | "UNPUBLISH"
      | "NOTIFY_USER"
      | "REMOVE_PDF",
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
      } else if (action === "UNPUBLISH") {
        if (!participant.reportId) {
          toast("No report found to unpublish.", "error");
          return;
        }

        res = await fetch(`/api/admin/reports/${participant.reportId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DRAFT", availableAt: null }),
        });
      } else if (action === "NOTIFY_USER") {
        if (!participant.reportId) {
          toast("No report found to notify.", "error");
          return;
        }

        res = await fetch(`/api/admin/reports/${participant.reportId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryMethod: "EMAIL_LINK" }),
        });
      } else if (action === "REMOVE_PDF") {
        if (!participant.reportId) {
          toast("No report found.", "error");
          return;
        }
        if (!participant.hasManualPdf) {
          toast("No uploaded PDF to remove.", "error");
          return;
        }

        const confirmed = window.confirm(
          "Remove uploaded PDF and move this report back to draft?",
        );
        if (!confirmed) return;

        res = await fetch(`/api/admin/reports/${participant.reportId}/manual-pdf`, {
          method: "DELETE",
        });
      } else {
        res = await fetch(
          `/api/admin/assessments/${assessmentId}/participants/${participant.userId}/reset`,
          { method: "POST" },
        );
      }

      const data = await res.json();
      if (res.ok) {
        if (action === "REMOVE_PDF") {
          toast("Uploaded PDF removed. Report moved to draft.", "success");
        } else {
          toast(`${action} completed.`, "success");
        }
      }
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
            User enrollments: {detail._count?.userEnrollments || 0} | Organisation enrollments: {detail._count?.tenantEnrollments || 0}
          </p>
          <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={saveContent} disabled={busy}>
            Save Content Metadata
          </button>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Bulk CSV Import</h4>
              <span className="text-xs text-slate-500">
                Import full question sets in one file. Source question codes are preserved as-is.
              </span>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <select
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={csvImportMode}
                onChange={(e) => setCsvImportMode(e.target.value as "REPLACE_ALL" | "APPEND")}
                disabled={csvImportBusy}
              >
                <option value="REPLACE_ALL">REPLACE_ALL</option>
                <option value="APPEND">APPEND</option>
              </select>
              <input
                type="file"
                accept=".csv,text/csv"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-2"
                onChange={(e) => setCsvImportFile(e.target.files?.[0] || null)}
                disabled={csvImportBusy}
              />
              <button
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold hover:bg-slate-50"
                onClick={downloadCsvTemplate}
                disabled={csvImportBusy}
              >
                Download Template
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                onClick={validateCsvImport}
                disabled={csvImportBusy || !csvImportFile}
              >
                {csvImportBusy ? "Validating..." : "Validate CSV"}
              </button>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={applyCsvImport}
                disabled={csvImportBusy || !csvImportFile || !csvImportSummary || csvImportIssues.length > 0}
              >
                {csvImportBusy ? "Importing..." : "Confirm Import"}
              </button>
            </div>

            {csvImportSummary && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">
                  {csvImportSummary.questions} questions across {csvImportSummary.sections} sections
                </p>
                <p className="mt-1">
                  LIKERT: {csvImportSummary.questionTypes.likert} · SJT: {csvImportSummary.questionTypes.sjt} · FREE_TEXT: {csvImportSummary.questionTypes.freeText} · Competencies: {csvImportSummary.competencies}
                </p>
              </div>
            )}

            {csvImportPreview.length > 0 && (
              <div className="mt-3 rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  Preview (first {csvImportPreview.length})
                </div>
                <ul className="max-h-32 overflow-auto px-3 py-2 text-xs text-slate-600">
                  {csvImportPreview.map((item) => (
                    <li key={`${item.code}-${item.prompt}`} className="py-1">
                      <span className="font-semibold text-slate-700">{item.code}</span> · {item.section} · {item.type}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {csvImportIssues.length > 0 && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <p className="font-semibold">Validation issues ({csvImportIssues.length})</p>
                <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5">
                  {csvImportIssues.map((issue, index) => (
                    <li key={`${issue.row}-${issue.column || "global"}-${index}`}>
                      Row {issue.row}
                      {issue.column ? ` (${issue.column})` : ""}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Question Builder</h4>
              <span className="text-xs text-slate-500">Add / Edit / Remove questions here.</span>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                placeholder="Question prompt"
                value={questionForm.prompt}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, prompt: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                placeholder="Image URL or /public path (optional)"
                value={questionForm.imageUrl}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                placeholder="Image alt text (optional)"
                value={questionForm.imageAlt}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, imageAlt: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                placeholder="Image caption (optional)"
                value={questionForm.imageCaption}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, imageCaption: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                placeholder="Trait (optional)"
                value={questionForm.trait}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, trait: e.target.value }))}
              />
              <select
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={questionForm.sectionId}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, sectionId: e.target.value }))}
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={questionForm.reverse}
                  onChange={(e) => setQuestionForm((prev) => ({ ...prev, reverse: e.target.checked }))}
                />
                Reverse
              </label>
            </div>

            <button
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
              onClick={addQuestion}
              disabled={busy}
            >
              Add Question
            </button>

            <div className="mt-4 overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Prompt</th>
                    <th className="px-3 py-2">Image</th>
                    <th className="px-3 py-2">Trait</th>
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">Reverse</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question) => (
                    <tr key={question.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded border border-slate-300 px-2 py-1"
                          value={question.prompt}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((item) =>
                                item.id === question.id ? { ...item, prompt: e.target.value } : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="grid gap-2">
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1"
                            placeholder="Image URL or /public path"
                            value={question.imageUrl || ""}
                            onChange={(e) =>
                              setQuestions((prev) =>
                                prev.map((item) =>
                                  item.id === question.id ? { ...item, imageUrl: e.target.value } : item,
                                ),
                              )
                            }
                          />
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1"
                            placeholder="Image alt text"
                            value={question.imageAlt || ""}
                            onChange={(e) =>
                              setQuestions((prev) =>
                                prev.map((item) =>
                                  item.id === question.id ? { ...item, imageAlt: e.target.value } : item,
                                ),
                              )
                            }
                          />
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1"
                            placeholder="Image caption"
                            value={question.imageCaption || ""}
                            onChange={(e) =>
                              setQuestions((prev) =>
                                prev.map((item) =>
                                  item.id === question.id ? { ...item, imageCaption: e.target.value } : item,
                                ),
                              )
                            }
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded border border-slate-300 px-2 py-1"
                          value={question.trait || ""}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((item) =>
                                item.id === question.id ? { ...item, trait: e.target.value } : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="rounded border border-slate-300 px-2 py-1"
                          value={question.sectionId || ""}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((item) =>
                                item.id === question.id
                                  ? {
                                    ...item,
                                    sectionId: e.target.value,
                                    section: sections.find((section) => section.id === e.target.value)
                                      ? { id: e.target.value, title: sections.find((section) => section.id === e.target.value)?.title || "" }
                                      : null,
                                  }
                                  : item,
                              ),
                            )
                          }
                        >
                          {sections.map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={question.reverse}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((item) =>
                                item.id === question.id ? { ...item, reverse: e.target.checked } : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            className="rounded border border-slate-300 bg-white px-2 py-1"
                            onClick={() => saveQuestion(question)}
                            disabled={busy}
                          >
                            Save
                          </button>
                          <button
                            className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700"
                            onClick={() => removeQuestion(question.id)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                <option value="TENANT">ORGANISATION</option>
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

              <select
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={enrollForm.reportMode}
                onChange={(e) =>
                  setEnrollForm((prev) => ({
                    ...prev,
                    reportMode: e.target.value as "AUTO" | "MANUAL",
                  }))
                }
              >
                <option value="AUTO">AUTO REPORT</option>
                <option value="MANUAL">MANUAL REPORT</option>
              </select>

              {enrollForm.reportMode === "AUTO" && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-2">
                  <span className="whitespace-nowrap">Delay (hrs):</span>
                  <input
                    type="number"
                    min="0"
                    className="w-20 rounded border border-slate-200 px-1"
                    value={enrollForm.reportDelayHours}
                    onChange={(e) =>
                      setEnrollForm((prev) => ({ ...prev, reportDelayHours: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              )}
            </div>

            <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm flex items-center gap-2 text-white" onClick={createEnrollment} disabled={busy}>
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
              <h4 className="text-sm font-semibold">Organisation Enrollments</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {access?.enrollments.tenants.length ? (
                  access.enrollments.tenants.map((enrollment) => (
                    <li key={enrollment.id}>
                      {enrollment.tenant.name} ({enrollment.includeFutureUsers ? "Dynamic" : "Snapshot"}) {" "}
                      <span className="text-xs text-slate-500">[{enrollment.active ? "ACTIVE" : "INACTIVE"}]</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">No organisation enrollments</li>
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
                      <td className="px-3 py-2">{user.sources.map((source) => formatScopeLabel(source.scope)).join(", ")}</td>
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
                    <option value="TENANT">ORGANISATION</option>
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
          <p className="mt-1 text-xs text-slate-500">
            {isManualWorkflow
              ? "Manual workflow enabled: review inputs, upload PDF, and notify users when ready."
              : "AI report workflow enabled: use Review Draft/Open Report and publish controls."}
          </p>
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
                  <th className="px-3 py-2">Report</th>
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
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {participant.reportStatus ? (
                        <div className="space-y-1">
                          <span
                            className={`rounded-full px-2 py-1 font-semibold ${
                              participant.reportStatus === "PUBLISHED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {participant.reportStatus}
                          </span>
                          {isManualWorkflow && (
                            <div className="text-[10px] text-slate-500">
                              PDF: {participant.hasManualPdf ? "Uploaded" : "Missing"}
                            </div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{participant.sources.map((source) => source.scope).join(", ")}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {participant.status === "SUBMITTED" && (
                          <Link
                            href={`/admin/assessments/${assessmentId}/participants/${participant.userId}/responses`}
                            className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] hover:bg-sky-100 transition-colors"
                          >
                            View Inputs
                          </Link>
                        )}
                        {participant.status === "SUBMITTED" && !isManualWorkflow && (
                          <Link
                            href={`/reports/leader/${participant.userId}/${assessmentId}`}
                            target="_blank"
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] hover:bg-emerald-100 transition-colors"
                          >
                            View Report
                          </Link>
                        )}
                        {participant.reportId && !isManualWorkflow && (
                          <Link
                            href={`/admin/reports/${participant.reportId}`}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                              participant.reportStatus === "DRAFT"
                                ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                : "border-slate-300 bg-white hover:bg-slate-50"
                            }`}
                          >
                            {participant.reportStatus === "DRAFT" ? "Review Draft" : "Open Report"}
                          </Link>
                        )}
                        {isManualWorkflow && participant.status === "SUBMITTED" && participant.reportId && (
                          <>
                            <input
                              id={`manual-upload-${participant.userId}`}
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  uploadManualPdf(participant, file);
                                }
                                event.currentTarget.value = "";
                              }}
                            />
                            <button
                              className="rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[11px]"
                              onClick={() =>
                                document
                                  .getElementById(`manual-upload-${participant.userId}`)
                                  ?.click()
                              }
                              disabled={busy}
                            >
                              Upload PDF
                            </button>
                            <button
                              className="rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px]"
                              onClick={() => participantAction(participant, "NOTIFY_USER")}
                              disabled={busy || !participant.hasManualPdf || !participant.reportId}
                            >
                              Notify User
                            </button>
                            <button
                              className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px]"
                              onClick={() => participantAction(participant, "REMOVE_PDF")}
                              disabled={busy || !participant.hasManualPdf || !participant.reportId}
                            >
                              Remove PDF
                            </button>
                          </>
                        )}
                        <button
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px]"
                          onClick={() => participantAction(participant, "REGENERATE")}
                          disabled={busy || participant.status !== "SUBMITTED" || isManualWorkflow}
                        >
                          Regenerate
                        </button>
                        <button
                          className="rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-[11px]"
                          onClick={() => participantAction(participant, "UNPUBLISH")}
                          disabled={busy || participant.reportStatus !== "PUBLISHED" || !participant.reportId}
                        >
                          Unpublish
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policyForm.randomizeQuestionOrder}
                onChange={(e) =>
                  setPolicyForm((prev) => ({ ...prev, randomizeQuestionOrder: e.target.checked }))
                }
              />
              Randomize question order for participants
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                Report workflow
              </span>
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={policyForm.reportWorkflow}
                onChange={(e) =>
                  setPolicyForm((prev) => ({
                    ...prev,
                    reportWorkflow: e.target.value as "AI_STANDARD" | "MANUAL_PDF_UPLOAD",
                  }))
                }
              >
                <option value="AI_STANDARD">AI Standard</option>
                <option value="MANUAL_PDF_UPLOAD">Manual PDF Upload</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                Question presentation
              </span>
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={policyForm.questionPresentationMode}
                onChange={(e) =>
                  setPolicyForm((prev) => ({
                    ...prev,
                    questionPresentationMode: e.target.value as "ALL_AT_ONCE" | "ONE_AT_A_TIME",
                  }))
                }
              >
                <option value="ALL_AT_ONCE">All questions at once</option>
                <option value="ONE_AT_A_TIME">One question at a time</option>
              </select>
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
          <p className="mt-3 text-xs text-slate-500">
            Question presentation changes only the participant answering flow. Access, scoring, retests, and report generation stay the same.
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Submission Alert Recipients
            </p>
            {adminUsers.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No admin users available.</p>
            ) : (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {adminUsers.map((admin) => {
                  const checked = policyForm.submissionAlertAdminIds.includes(admin.id);
                  return (
                    <label
                      key={admin.id}
                      className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setPolicyForm((prev) => ({
                            ...prev,
                            submissionAlertAdminIds: e.target.checked
                              ? [...prev.submissionAlertAdminIds, admin.id]
                              : prev.submissionAlertAdminIds.filter((id) => id !== admin.id),
                          }))
                        }
                      />
                      <span className="font-medium text-slate-700">{admin.firstName} {admin.lastName}</span>
                      <span className="text-slate-500">{admin.email}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Only selected admins receive completion alerts for manual workflow submissions.
            </p>
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
