"use client";

import { useEffect, useMemo, useState } from "react";
import { recommendedTemplate40 } from "@/lib/recommended-template";

type Tenant = {
  id: string;
  name: string;
  seatLimit: number;
  updatedAt: string;
};

type DirectoryUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "EMPLOYEE" | "LEADER";
  tenant: { id: string; name: string };
  manager?: { email: string; firstName: string; lastName: string } | null;
};

type AssessmentListItem = {
  id: string;
  title: string;
  isPublished: boolean;
  createdAt: string;
  _count?: { questions: number; sessions: number };
  participantCounts?: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  completionRate?: number;
};

type ParticipantStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";

type AssessmentParticipant = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "EMPLOYEE" | "LEADER";
  managerEmail: string | null;
  status: ParticipantStatus;
  startedAt: string | null;
  submittedAt: string | null;
};

type DraftCompetency = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type DraftOption = {
  id: string;
  text: string;
  impacts: string;
};

type DraftQuestion = {
  id: string;
  code: string;
  sectionTitle: string;
  sectionKind: "PERSONALITY" | "SCENARIO";
  type: "LIKERT_TRAIT" | "SJT_SINGLE";
  category: string;
  prompt: string;
  trait: string;
  reverse: boolean;
  scaleMin: number;
  scaleMax: number;
  options: DraftOption[];
};

const starterCompetencies: DraftCompetency[] = [
  { id: "c1", code: "emotional_intelligence", name: "Emotional Intelligence", description: "Reads and responds to emotions constructively." },
  { id: "c2", code: "collaboration", name: "Collaboration", description: "Works productively with others." },
  { id: "c3", code: "adaptability", name: "Adaptability", description: "Adjusts behavior effectively when context changes." },
];

const starterQuestions: DraftQuestion[] = [
  {
    id: "q1",
    code: "q_openness_1",
    sectionTitle: "Personality Profile",
    sectionKind: "PERSONALITY",
    type: "LIKERT_TRAIT",
    category: "Curiosity",
    prompt: "I enjoy experimenting with new approaches in my work.",
    trait: "openness",
    reverse: false,
    scaleMin: 1,
    scaleMax: 5,
    options: [],
  },
  {
    id: "q2",
    code: "q_sjt_1",
    sectionTitle: "Workplace Scenarios",
    sectionKind: "SCENARIO",
    type: "SJT_SINGLE",
    category: "Emotional Intelligence",
    prompt: "A teammate says they are emotionally overwhelmed. What do you do first?",
    trait: "",
    reverse: false,
    scaleMin: 1,
    scaleMax: 5,
    options: [
      { id: "o1", text: "Acknowledge their feelings and help them connect to support.", impacts: "emotional_intelligence:+1,collaboration:+1" },
      { id: "o2", text: "Tell them to ignore it and continue working.", impacts: "emotional_intelligence:-1,collaboration:-1" },
    ],
  },
];

function mapRecommendedTemplateToDraft() {
  return {
    title: recommendedTemplate40.title,
    competencies: recommendedTemplate40.competencies.map((competency) => ({
      id: uid("c"),
      code: competency.code,
      name: competency.name,
      description: competency.description,
    })),
    questions: recommendedTemplate40.questions.map((question) => ({
      id: uid("q"),
      code: question.code,
      sectionTitle: question.sectionTitle,
      sectionKind: question.sectionKind,
      type: question.type,
      category: question.category,
      prompt: question.prompt,
      trait: question.trait,
      reverse: question.reverse,
      scaleMin: question.scaleMin,
      scaleMax: question.scaleMax,
      options: question.options.map((option) => ({
        id: uid("o"),
        text: option.text,
        impacts: option.impacts,
      })),
    })),
  };
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");
}

function parseImpacts(raw: string) {
  return raw
    .split(/[|,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((token) => {
      const [code, delta] = token.split(":");
      return {
        competencyCode: normalizeCode(code || ""),
        delta: Number(delta),
      };
    })
    .filter((item) => item.competencyCode && Number.isFinite(item.delta));
}

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(field.trim());
      field = "";
      continue;
    }

    field += char;
  }

  fields.push(field.trim());
  return fields;
}

function parseSpreadsheetCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Spreadsheet needs header + at least one row.");
  }

  const header = parseCsvLine(lines[0]).map((item) => item.toLowerCase());
  const required = [
    "question_code",
    "section_title",
    "section_kind",
    "question_type",
    "category",
    "prompt",
    "trait",
    "reverse",
    "scale_min",
    "scale_max",
    "option_code",
    "option_text",
    "impacts",
  ];

  for (const col of required) {
    if (!header.includes(col)) {
      throw new Error(`Missing column: ${col}`);
    }
  }

  const index = (name: string) => header.indexOf(name);
  const questionMap = new Map<string, DraftQuestion>();
  const inferredCompetencies = new Map<string, DraftCompetency>();

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const code = row[index("question_code")]?.trim();
    if (!code) continue;

    const type = row[index("question_type")]?.trim() === "SJT_SINGLE" ? "SJT_SINGLE" : "LIKERT_TRAIT";

    let question = questionMap.get(code);
    if (!question) {
      question = {
        id: uid("q"),
        code,
        sectionTitle: row[index("section_title")] || "Assessment",
        sectionKind: row[index("section_kind")] === "SCENARIO" ? "SCENARIO" : "PERSONALITY",
        type,
        category: row[index("category")] || "",
        prompt: row[index("prompt")] || "",
        trait: row[index("trait")] || "",
        reverse: ["true", "1", "yes"].includes((row[index("reverse")] || "").toLowerCase()),
        scaleMin: Number(row[index("scale_min")] || 1),
        scaleMax: Number(row[index("scale_max")] || 5),
        options: [],
      };
      questionMap.set(code, question);
    }

    const optionText = row[index("option_text")]?.trim();
    if (optionText) {
      const impacts = row[index("impacts")] || "";
      question.options.push({
        id: uid("o"),
        text: optionText,
        impacts,
      });

      for (const impact of parseImpacts(impacts)) {
        if (!inferredCompetencies.has(impact.competencyCode)) {
          inferredCompetencies.set(impact.competencyCode, {
            id: uid("c"),
            code: impact.competencyCode,
            name: impact.competencyCode
              .split("_")
              .filter(Boolean)
              .map((token) => token[0].toUpperCase() + token.slice(1))
              .join(" "),
            description: "",
          });
        }
      }
    }
  }

  return {
    questions: [...questionMap.values()],
    competencies: [...inferredCompetencies.values()],
  };
}

export default function AdminPage() {
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantSeats, setNewTenantSeats] = useState(50);

  const [employeeCsv, setEmployeeCsv] = useState(
    "email,first_name,last_name,manager_email\nexample@company.com,Example,User,",
  );
  const [employeeImportOutput, setEmployeeImportOutput] = useState<string>("");
  const [inviteOutput, setInviteOutput] = useState<string>("");

  const [assessmentTitle, setAssessmentTitle] = useState("Workstyle & Personality Baseline");
  const [competencies, setCompetencies] = useState<DraftCompetency[]>(starterCompetencies);
  const [questions, setQuestions] = useState<DraftQuestion[]>(starterQuestions);
  const [spreadsheetText, setSpreadsheetText] = useState("");
  const [assessmentOutput, setAssessmentOutput] = useState<string>("");

  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [assessmentParticipants, setAssessmentParticipants] = useState<AssessmentParticipant[]>([]);
  const [participantStatusFilter, setParticipantStatusFilter] = useState<
    "ALL" | ParticipantStatus
  >("ALL");
  const [publishOutput, setPublishOutput] = useState("");
  const [publishPolicy, setPublishPolicy] = useState({
    isPublished: true,
    showResultsToEmployee: true,
    resultReleaseDelayHours: 0,
    postSubmitMessage: "Thank you. Your results are now available.",
    leaderCanViewFullReport: true,
  });
  const [overview, setOverview] = useState({
    tenantCount: 0,
    userCount: 0,
    assessmentCount: 0,
    sessionCount: 0,
  });
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [directoryRefreshTick, setDirectoryRefreshTick] = useState(0);
  const [addUserForm, setAddUserForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "EMPLOYEE" as "EMPLOYEE" | "LEADER",
    managerEmail: "",
  });
  const [addUserOutput, setAddUserOutput] = useState("");
  const [soloForm, setSoloForm] = useState({
    tenantName: "",
    email: "",
    firstName: "",
    lastName: "",
  });
  const [soloOutput, setSoloOutput] = useState("");

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/admin/tenants?q=${encodeURIComponent(tenantQuery)}`);
      const data = await res.json();
      setTenants(data.tenants || []);
    }, 250);

    return () => clearTimeout(timeout);
  }, [tenantQuery]);

  useEffect(() => {
    if (!selectedTenant) return;
    fetch(`/api/admin/assessments?tenantId=${selectedTenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        const nextAssessments = data.assessments || [];
        setAssessments(nextAssessments);
        setSelectedAssessmentId((current) =>
          nextAssessments.some((item: AssessmentListItem) => item.id === current) ? current : "",
        );
      });
  }, [selectedTenant]);

  useEffect(() => {
    if (!selectedAssessmentId) return;

    fetch(`/api/admin/assessments/${selectedAssessmentId}/participants`)
      .then((r) => r.json())
      .then((data) => setAssessmentParticipants(data.participants || []))
      .catch(() => setAssessmentParticipants([]));
  }, [selectedAssessmentId]);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then((data) => {
        setOverview({
          tenantCount: data.tenantCount || 0,
          userCount: data.userCount || 0,
          assessmentCount: data.assessmentCount || 0,
          sessionCount: data.sessionCount || 0,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedTenant?.id) params.set("tenantId", selectedTenant.id);
    if (userQuery.trim()) params.set("q", userQuery.trim());
    fetch(`/api/admin/users?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setDirectoryUsers(data.users || []))
      .catch(() => setDirectoryUsers([]));
  }, [selectedTenant, userQuery, directoryRefreshTick]);

  const selectedAssessment = useMemo(
    () => assessments.find((assessment) => assessment.id === selectedAssessmentId),
    [assessments, selectedAssessmentId],
  );

  const filteredParticipants = useMemo(
    () =>
      assessmentParticipants.filter((participant) =>
        participantStatusFilter === "ALL"
          ? true
          : participant.status === participantStatusFilter,
      ),
    [assessmentParticipants, participantStatusFilter],
  );

  async function createTenant() {
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTenantName, seatLimit: newTenantSeats }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not create tenant");
      return;
    }
    setSelectedTenant(data);
    setTenantQuery(data.name);
    setNewTenantName("");
  }

  async function importEmployees() {
    if (!selectedTenant) return;
    const res = await fetch("/api/admin/users/import-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: selectedTenant.id, csvText: employeeCsv }),
    });
    const data = await res.json();
    setEmployeeImportOutput(JSON.stringify(data, null, 2));
    if (res.ok) {
      setDirectoryRefreshTick((prev) => prev + 1);
    }
  }

  async function sendInvites() {
    if (!selectedTenant) return;
    const res = await fetch("/api/admin/invites/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: selectedTenant.id }),
    });
    const data = await res.json();
    setInviteOutput(JSON.stringify(data, null, 2));
  }

  function addCompetency() {
    setCompetencies((prev) => [
      ...prev,
      {
        id: uid("c"),
        code: "",
        name: "",
        description: "",
      },
    ]);
  }

  function addQuestion(type: "LIKERT_TRAIT" | "SJT_SINGLE") {
    setQuestions((prev) => [
      ...prev,
      {
        id: uid("q"),
        code: uid("code"),
        sectionTitle: type === "LIKERT_TRAIT" ? "Personality Profile" : "Workplace Scenarios",
        sectionKind: type === "LIKERT_TRAIT" ? "PERSONALITY" : "SCENARIO",
        type,
        category: "",
        prompt: "",
        trait: type === "LIKERT_TRAIT" ? "openness" : "",
        reverse: false,
        scaleMin: 1,
        scaleMax: 5,
        options:
          type === "SJT_SINGLE"
            ? [
                { id: uid("o"), text: "", impacts: "" },
                { id: uid("o"), text: "", impacts: "" },
              ]
            : [],
      },
    ]);
  }

  function applySpreadsheetImport() {
    try {
      const parsed = parseSpreadsheetCsv(spreadsheetText);
      if (parsed.questions.length === 0) {
        alert("No questions found in spreadsheet text.");
        return;
      }

      setQuestions(parsed.questions);
      if (parsed.competencies.length > 0) {
        setCompetencies((prev) => {
          const existing = new Set(prev.map((item) => item.code));
          const merged = [...prev];
          for (const competency of parsed.competencies) {
            if (!existing.has(competency.code)) merged.push(competency);
          }
          return merged;
        });
      }
      alert("Spreadsheet imported into builder.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not parse spreadsheet.");
    }
  }

  function loadRecommendedTemplate() {
    const template = mapRecommendedTemplateToDraft();
    setAssessmentTitle(template.title);
    setCompetencies(template.competencies);
    setQuestions(template.questions);
    alert("Loaded recommended 40-question template.");
  }

  async function addSingleUser() {
    if (!selectedTenant) {
      alert("Select a client first.");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: selectedTenant.id,
        email: addUserForm.email,
        firstName: addUserForm.firstName,
        lastName: addUserForm.lastName,
        role: addUserForm.role,
        managerEmail: addUserForm.managerEmail || undefined,
      }),
    });
    const data = await res.json();
    setAddUserOutput(JSON.stringify(data, null, 2));
    if (res.ok) {
      setAddUserForm({
        email: "",
        firstName: "",
        lastName: "",
        role: "EMPLOYEE",
        managerEmail: "",
      });
      setDirectoryRefreshTick((prev) => prev + 1);
    }
  }

  async function addSoloUser() {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        createSoloTenant: true,
        tenantName: soloForm.tenantName,
        email: soloForm.email,
        firstName: soloForm.firstName,
        lastName: soloForm.lastName,
        role: "EMPLOYEE",
        seatLimit: 1,
      }),
    });
    const data = await res.json();
    setSoloOutput(JSON.stringify(data, null, 2));
    if (res.ok && data.user?.tenant) {
      setSelectedTenant({
        id: data.user.tenant.id,
        name: data.user.tenant.name,
        seatLimit: 1,
        updatedAt: new Date().toISOString(),
      });
      setTenantQuery(data.user.tenant.name);
      setSoloForm({
        tenantName: "",
        email: "",
        firstName: "",
        lastName: "",
      });
      setDirectoryRefreshTick((prev) => prev + 1);
    }
  }

  async function createAssessment() {
    if (!selectedTenant) return;

    const sectionMap = new Map<
      string,
      {
        title: string;
        kind: "PERSONALITY" | "SCENARIO";
        questions: Array<{
          code: string;
          prompt: string;
          category?: string;
          questionType: "LIKERT_TRAIT" | "SJT_SINGLE";
          trait?: string;
          reverse?: boolean;
          scaleMin?: number;
          scaleMax?: number;
          options?: Array<{
            code?: string;
            text: string;
            impacts: Array<{ competencyCode: string; delta: number }>;
          }>;
        }>;
      }
    >();

    for (const question of questions) {
      if (!question.prompt.trim()) continue;
      const key = `${question.sectionKind}::${question.sectionTitle.trim() || "Assessment"}`;
      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          title: question.sectionTitle.trim() || "Assessment",
          kind: question.sectionKind,
          questions: [],
        });
      }

      sectionMap.get(key)?.questions.push({
        code: question.code.trim(),
        prompt: question.prompt.trim(),
        category: question.category.trim() || undefined,
        questionType: question.type,
        trait: question.type === "LIKERT_TRAIT" ? question.trait.trim().toLowerCase() : undefined,
        reverse: question.type === "LIKERT_TRAIT" ? question.reverse : undefined,
        scaleMin: question.type === "LIKERT_TRAIT" ? question.scaleMin : undefined,
        scaleMax: question.type === "LIKERT_TRAIT" ? question.scaleMax : undefined,
        options:
          question.type === "SJT_SINGLE"
            ? question.options
                .filter((option) => option.text.trim())
                .map((option, index) => ({
                  code: `opt_${index + 1}`,
                  text: option.text.trim(),
                  impacts: parseImpacts(option.impacts),
                }))
            : undefined,
      });
    }

    const payload = {
      tenantId: selectedTenant.id,
      title: assessmentTitle,
      competencies: competencies
        .map((competency) => ({
          code: normalizeCode(competency.code),
          name: competency.name.trim() || competency.code,
          description: competency.description.trim() || undefined,
        }))
        .filter((competency) => competency.code),
      sections: [...sectionMap.values()],
    };

    const res = await fetch("/api/admin/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setAssessmentOutput(JSON.stringify(data, null, 2));

    if (res.ok) {
      const listRes = await fetch(`/api/admin/assessments?tenantId=${selectedTenant.id}`);
      const listData = await listRes.json();
      setAssessments(listData.assessments || []);
      setSelectedAssessmentId(data.id);
    }
  }

  async function publishAssessment() {
    if (!selectedAssessmentId) return;
    const res = await fetch(`/api/admin/assessments/${selectedAssessmentId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(publishPolicy),
    });
    const data = await res.json();
    setPublishOutput(JSON.stringify(data, null, 2));
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4 md:p-8">
      <header className="rounded-3xl bg-gradient-to-r from-amber-100 via-orange-50 to-cyan-100 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">Admin Studio</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Corporate Personality Assessment Builder
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700">
          Search client, import participants, design mixed-format quiz (personality + scenario), and launch with controlled report visibility.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Clients</p>
          <p className="mt-2 text-2xl font-semibold">{overview.tenantCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Users</p>
          <p className="mt-2 text-2xl font-semibold">{overview.userCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Assessments</p>
          <p className="mt-2 text-2xl font-semibold">{overview.assessmentCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Sessions</p>
          <p className="mt-2 text-2xl font-semibold">{overview.sessionCount}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">1. Select Client</h2>
          <input
            className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
            value={tenantQuery}
            onChange={(e) => setTenantQuery(e.target.value)}
            placeholder="Search client by name"
          />
          <div className="mt-3 max-h-48 space-y-2 overflow-auto">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedTenant?.id === tenant.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"}`}
                onClick={() => setSelectedTenant(tenant)}
              >
                <div className="font-medium">{tenant.name}</div>
                <div className="text-xs opacity-80">Seats: {tenant.seatLimit}</div>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Create Client</h2>
          <div className="mt-3 grid gap-2">
            <input
              className="rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Client name"
              value={newTenantName}
              onChange={(e) => setNewTenantName(e.target.value)}
            />
            <input
              className="rounded-xl border border-slate-300 px-3 py-2"
              type="number"
              min={1}
              value={newTenantSeats}
              onChange={(e) => setNewTenantSeats(Number(e.target.value))}
            />
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-white" onClick={createTenant}>
              Create & Select
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Active client: {selectedTenant ? `${selectedTenant.name}` : "None selected"}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">2. Import Employees</h2>
          <textarea
            className="mt-3 h-36 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
            value={employeeCsv}
            onChange={(e) => setEmployeeCsv(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={importEmployees} disabled={!selectedTenant}>
              Import CSV
            </button>
            <button className="rounded-xl bg-cyan-700 px-4 py-2 text-sm text-white" onClick={sendInvites} disabled={!selectedTenant}>
              Send Invites
            </button>
          </div>
          {employeeImportOutput && <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{employeeImportOutput}</pre>}
          {inviteOutput && <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{inviteOutput}</pre>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">3. Add Individual Participant</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="email"
              value={addUserForm.email}
              onChange={(e) => setAddUserForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={addUserForm.role}
              onChange={(e) =>
                setAddUserForm((prev) => ({ ...prev, role: e.target.value as "EMPLOYEE" | "LEADER" }))
              }
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="LEADER">LEADER</option>
            </select>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="first name"
              value={addUserForm.firstName}
              onChange={(e) => setAddUserForm((prev) => ({ ...prev, firstName: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="last name"
              value={addUserForm.lastName}
              onChange={(e) => setAddUserForm((prev) => ({ ...prev, lastName: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="manager email (optional)"
              value={addUserForm.managerEmail}
              onChange={(e) => setAddUserForm((prev) => ({ ...prev, managerEmail: e.target.value }))}
            />
          </div>
          <button className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={addSingleUser} disabled={!selectedTenant}>
            Add User To Selected Client
          </button>
          {addUserOutput && <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{addUserOutput}</pre>}

          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold">Solo Buyer (single individual)</h3>
            <p className="mt-1 text-xs text-slate-600">Creates a 1-seat client and adds one participant directly.</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="solo client name"
                value={soloForm.tenantName}
                onChange={(e) => setSoloForm((prev) => ({ ...prev, tenantName: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="email"
                value={soloForm.email}
                onChange={(e) => setSoloForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="first name"
                value={soloForm.firstName}
                onChange={(e) => setSoloForm((prev) => ({ ...prev, firstName: e.target.value }))}
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="last name"
                value={soloForm.lastName}
                onChange={(e) => setSoloForm((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            <button className="mt-3 rounded-xl bg-cyan-700 px-4 py-2 text-sm text-white" onClick={addSoloUser}>
              Create Solo Client & User
            </button>
            {soloOutput && <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{soloOutput}</pre>}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Directory View (Clients / Users)</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            className="rounded-xl border border-slate-300 px-3 py-2"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search user by name or email"
          />
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Showing {directoryUsers.length} users {selectedTenant ? `in ${selectedTenant.name}` : "across all clients"}
          </p>
        </div>
        <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Manager</th>
              </tr>
            </thead>
            <tbody>
              {directoryUsers.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{user.firstName} {user.lastName}</td>
                  <td className="px-3 py-2">{user.email}</td>
                  <td className="px-3 py-2">{user.role}</td>
                  <td className="px-3 py-2">{user.tenant?.name}</td>
                  <td className="px-3 py-2">{user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">4. Competency Categories</h2>
        <div className="mt-3 space-y-2">
          {competencies.map((competency, index) => (
            <div key={competency.id} className="grid gap-2 md:grid-cols-3">
              <input
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={competency.code}
                onChange={(e) =>
                  setCompetencies((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, code: e.target.value } : item,
                    ),
                  )
                }
                placeholder="code"
              />
              <input
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={competency.name}
                onChange={(e) =>
                  setCompetencies((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, name: e.target.value } : item,
                    ),
                  )
                }
                placeholder="display name"
              />
              <input
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={competency.description}
                onChange={(e) =>
                  setCompetencies((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, description: e.target.value } : item,
                    ),
                  )
                }
                placeholder="description"
              />
            </div>
          ))}
        </div>
        <button className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={addCompetency}>
          Add Category
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">5. Build Quiz</h2>
        <input
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
          value={assessmentTitle}
          onChange={(e) => setAssessmentTitle(e.target.value)}
          placeholder="Assessment title"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-xl border border-cyan-700 px-4 py-2 text-sm text-cyan-900" onClick={loadRecommendedTemplate}>
            Load Recommended 40-Question Template
          </button>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" onClick={() => addQuestion("LIKERT_TRAIT")}>Add Personality Question</button>
          <button className="rounded-xl bg-cyan-700 px-4 py-2 text-sm text-white" onClick={() => addQuestion("SJT_SINGLE")}>Add Scenario Question</button>
        </div>

        <div className="mt-4 space-y-4">
          {questions.map((question, questionIndex) => (
            <article key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-2 md:grid-cols-4">
                <input
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={question.code}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((item, i) =>
                        i === questionIndex ? { ...item, code: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder="question code"
                />
                <input
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={question.sectionTitle}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((item, i) =>
                        i === questionIndex ? { ...item, sectionTitle: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder="section title"
                />
                <select
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={question.sectionKind}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((item, i) =>
                        i === questionIndex
                          ? {
                              ...item,
                              sectionKind: e.target.value as "PERSONALITY" | "SCENARIO",
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="PERSONALITY">PERSONALITY</option>
                  <option value="SCENARIO">SCENARIO</option>
                </select>
                <select
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  value={question.type}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((item, i) =>
                        i === questionIndex
                          ? {
                              ...item,
                              type: e.target.value as "LIKERT_TRAIT" | "SJT_SINGLE",
                              options:
                                e.target.value === "SJT_SINGLE" && item.options.length === 0
                                  ? [
                                      { id: uid("o"), text: "", impacts: "" },
                                      { id: uid("o"), text: "", impacts: "" },
                                    ]
                                  : item.options,
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="LIKERT_TRAIT">LIKERT_TRAIT</option>
                  <option value="SJT_SINGLE">SJT_SINGLE</option>
                </select>
              </div>

              <input
                className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={question.category}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) =>
                      i === questionIndex ? { ...item, category: e.target.value } : item,
                    ),
                  )
                }
                placeholder="question category (e.g. Emotional Intelligence)"
              />

              <textarea
                className="mt-2 h-20 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={question.prompt}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, i) =>
                      i === questionIndex ? { ...item, prompt: e.target.value } : item,
                    ),
                  )
                }
                placeholder="question prompt"
              />

              {question.type === "LIKERT_TRAIT" ? (
                <div className="mt-2 grid gap-2 md:grid-cols-4">
                  <input
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    value={question.trait}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((item, i) =>
                          i === questionIndex ? { ...item, trait: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="trait (openness, ... )"
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    type="number"
                    value={question.scaleMin}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((item, i) =>
                          i === questionIndex ? { ...item, scaleMin: Number(e.target.value) } : item,
                        ),
                      )
                    }
                    placeholder="scale min"
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                    type="number"
                    value={question.scaleMax}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((item, i) =>
                          i === questionIndex ? { ...item, scaleMax: Number(e.target.value) } : item,
                        ),
                      )
                    }
                    placeholder="scale max"
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={question.reverse}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((item, i) =>
                            i === questionIndex ? { ...item, reverse: e.target.checked } : item,
                          ),
                        )
                      }
                    />
                    Reverse-scored
                  </label>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <div key={option.id} className="grid gap-2 md:grid-cols-2">
                      <input
                        className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                        value={option.text}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((item, i) =>
                              i === questionIndex
                                ? {
                                    ...item,
                                    options: item.options.map((opt, oi) =>
                                      oi === optionIndex ? { ...opt, text: e.target.value } : opt,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="option text"
                      />
                      <input
                        className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                        value={option.impacts}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((item, i) =>
                              i === questionIndex
                                ? {
                                    ...item,
                                    options: item.options.map((opt, oi) =>
                                      oi === optionIndex ? { ...opt, impacts: e.target.value } : opt,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="impacts ex: emotional_intelligence:+1,collaboration:+1"
                      />
                    </div>
                  ))}
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    onClick={() =>
                      setQuestions((prev) =>
                        prev.map((item, i) =>
                          i === questionIndex
                            ? { ...item, options: [...item.options, { id: uid("o"), text: "", impacts: "" }] }
                            : item,
                        ),
                      )
                    }
                  >
                    Add Option
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>

        <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer font-medium">Optional: Paste Spreadsheet CSV</summary>
          <p className="mt-2 text-xs text-slate-600">
            Header required: question_code,section_title,section_kind,question_type,category,prompt,trait,reverse,scale_min,scale_max,option_code,option_text,impacts
          </p>
          <textarea
            className="mt-3 h-40 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
            value={spreadsheetText}
            onChange={(e) => setSpreadsheetText(e.target.value)}
            placeholder="Paste CSV rows from spreadsheet here"
          />
          <button className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={applySpreadsheetImport}>
            Import Spreadsheet into Builder
          </button>
        </details>

        <button
          className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 font-medium text-white"
          onClick={createAssessment}
          disabled={!selectedTenant}
        >
          Create Assessment
        </button>

        {assessmentOutput && <pre className="mt-4 overflow-auto rounded bg-slate-50 p-3 text-xs">{assessmentOutput}</pre>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">6. Publish & Visibility Policy</h2>

        <select
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
          value={selectedAssessmentId}
          onChange={(e) => setSelectedAssessmentId(e.target.value)}
        >
          <option value="">Select assessment</option>
          {assessments.map((assessment) => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.title} ({assessment.isPublished ? "Published" : "Draft"})
            </option>
          ))}
        </select>

        {selectedAssessment && (
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <p>
              Questions: {selectedAssessment._count?.questions || 0} | Sessions:{" "}
              {selectedAssessment._count?.sessions || 0}
            </p>
            {selectedAssessment.participantCounts && (
              <p>
                Completion: {selectedAssessment.participantCounts.completed}/
                {selectedAssessment.participantCounts.total} ({selectedAssessment.completionRate || 0}
                %) | In progress: {selectedAssessment.participantCounts.inProgress} | Not started:{" "}
                {selectedAssessment.participantCounts.notStarted}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publishPolicy.isPublished}
              onChange={(e) => setPublishPolicy((prev) => ({ ...prev, isPublished: e.target.checked }))}
            />
            Publish assessment
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publishPolicy.showResultsToEmployee}
              onChange={(e) =>
                setPublishPolicy((prev) => ({ ...prev, showResultsToEmployee: e.target.checked }))
              }
            />
            Show results to employee
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publishPolicy.leaderCanViewFullReport}
              onChange={(e) =>
                setPublishPolicy((prev) => ({ ...prev, leaderCanViewFullReport: e.target.checked }))
              }
            />
            Leader can view full report
          </label>
          <input
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            type="number"
            min={0}
            value={publishPolicy.resultReleaseDelayHours}
            onChange={(e) =>
              setPublishPolicy((prev) => ({ ...prev, resultReleaseDelayHours: Number(e.target.value) }))
            }
            placeholder="result delay hours"
          />
        </div>

        <input
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
          value={publishPolicy.postSubmitMessage}
          onChange={(e) => setPublishPolicy((prev) => ({ ...prev, postSubmitMessage: e.target.value }))}
          placeholder="post submit message"
        />

        <button
          className="mt-4 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white"
          onClick={publishAssessment}
          disabled={!selectedAssessmentId}
        >
          Save Publish Policy
        </button>

        {publishOutput && <pre className="mt-4 overflow-auto rounded bg-slate-50 p-3 text-xs">{publishOutput}</pre>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">7. Assessment Participation Tracker</h2>
        <p className="mt-2 text-sm text-slate-600">
          See exactly who completed, is in progress, or has not started.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["ALL", "SUBMITTED", "IN_PROGRESS", "NOT_STARTED"] as const).map((status) => (
            <button
              key={status}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                participantStatusFilter === status
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
              onClick={() => setParticipantStatusFilter(status)}
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>

        {!selectedAssessmentId ? (
          <p className="mt-4 text-sm text-slate-600">Select an assessment first to view participant status.</p>
        ) : filteredParticipants.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No participants match the selected filter.</p>
        ) : (
          <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Participant</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Manager</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant) => (
                  <tr key={participant.userId} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {participant.firstName} {participant.lastName}
                    </td>
                    <td className="px-3 py-2">{participant.email}</td>
                    <td className="px-3 py-2">{participant.role}</td>
                    <td className="px-3 py-2">{participant.managerEmail || "-"}</td>
                    <td className="px-3 py-2">{participant.status.replace("_", " ")}</td>
                    <td className="px-3 py-2">
                      {participant.submittedAt
                        ? new Date(participant.submittedAt).toLocaleString()
                        : participant.startedAt
                          ? new Date(participant.startedAt).toLocaleString()
                          : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
