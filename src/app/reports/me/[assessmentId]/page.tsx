"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type TraitKey =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

type TraitNarrative = {
  key: TraitKey;
  name: string;
  band: "high" | "moderate" | "emerging";
  summary: string;
  leverage: string;
  developmentFocus: string;
};

type CompetencyTheme = {
  code: string;
  name: string;
  category: "strength" | "focus";
  insight: string;
};

type CompetencyRow = {
  code: string;
  name: string;
  score: number;
};

type Data = {
  message?: string;
  submittedAt?: string | null;
  assessment?: {
    id: string;
    title: string;
  };
  score?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    competencyJson?: CompetencyRow[];
  };
  narrative?: {
    reportVersion?: string;
    profileHeadline?: string;
    summary?: string;
    strengths?: string[];
    growthAreas?: string[];
    actions?: string[];
    workplaceSignals?: string[];
    reflectionPrompts?: string[];
    managerDiscussionGuide?: string[];
    traitNarratives?: TraitNarrative[];
    competencyThemes?: CompetencyTheme[];
    competencyBreakdown?: CompetencyRow[];
    assessmentTakenAt?: string;
    assessmentTitle?: string;
    participantName?: string;
    aiNarrative?: {
      executiveSummary?: string;
      strengthsNarrative?: string;
      developmentNarrative?: string;
      managerCoaching?: string;
      improvementRoadmap?: string[];
      cautionNotes?: string[];
    };
  };
};

const traitOrder: Array<{ key: TraitKey; label: string }> = [
  { key: "openness", label: "Openness" },
  { key: "conscientiousness", label: "Conscientiousness" },
  { key: "extraversion", label: "Extraversion" },
  { key: "agreeableness", label: "Agreeableness" },
  { key: "neuroticism", label: "Emotional Reactivity" },
];

const bandClasses: Record<TraitNarrative["band"], string> = {
  high: "bg-emerald-100 text-emerald-800 border-emerald-200",
  moderate: "bg-amber-100 text-amber-900 border-amber-200",
  emerging: "bg-sky-100 text-sky-900 border-sky-200",
};

const bandLabels: Record<TraitNarrative["band"], string> = {
  high: "High signal",
  moderate: "Moderate signal",
  emerging: "Emerging signal",
};

function toBand(value: number): TraitNarrative["band"] {
  if (value < 35) return "emerging";
  if (value < 70) return "moderate";
  return "high";
}

function formatDateTime(input?: string | null) {
  if (!input) return "Not available";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function buildFallbackTraitNarrative(
  key: TraitKey,
  label: string,
  value: number,
): TraitNarrative {
  const band = toBand(value);

  if (key === "neuroticism") {
    if (band === "high") {
      return {
        key,
        name: label,
        band,
        summary:
          "Pressure sensitivity appears elevated, which can intensify urgency in uncertain conditions.",
        leverage:
          "This often helps with early risk detection when timelines or quality signals begin to slip.",
        developmentFocus:
          "Use structured reset habits and explicit escalation paths to preserve decision quality in high-stress moments.",
      };
    }
    if (band === "moderate") {
      return {
        key,
        name: label,
        band,
        summary:
          "Pressure response appears generally balanced, with variability across different contexts.",
        leverage:
          "This can help you connect with team stress while still maintaining practical focus on delivery.",
        developmentFocus:
          "Codify one recovery routine and use it consistently before major decisions.",
      };
    }
    return {
      key,
      name: label,
      band,
      summary:
        "Emotional steadiness appears strong, supporting calm thinking in uncertain or fast-moving situations.",
      leverage:
        "This tends to stabilize teams during disruption and keeps execution focused under pressure.",
      developmentFocus:
        "Signal urgency explicitly so calm communication is not interpreted as low intensity.",
    };
  }

  if (band === "high") {
    return {
      key,
      name: label,
      band,
      summary: `${label} is high, indicating this trait is a strong and visible part of your workstyle profile.`,
      leverage:
        "Use this intentionally in complex, cross-team initiatives where your natural tendency can create momentum.",
      developmentFocus:
        "Balance this strength by checking where overuse could reduce flexibility or collaboration quality.",
    };
  }

  if (band === "moderate") {
    return {
      key,
      name: label,
      band,
      summary: `${label} is moderate, showing a balanced pattern that can adapt to both structured and changing environments.`,
      leverage:
        "This gives you range across different project types and team rhythms.",
      developmentFocus:
        "Strengthen impact by deciding when to lean into this trait more deliberately.",
    };
  }

  return {
    key,
    name: label,
    band,
    summary: `${label} is emerging, suggesting this is a meaningful area for deliberate growth.`,
    leverage:
      "You may still create value by using adjacent strengths while building capability in this dimension.",
    developmentFocus:
      "Choose one repeatable weekly behavior that increases visible progress in this area.",
  };
}

export default function MyReportPage() {
  const params = useParams<{ assessmentId: string }>();
  const assessmentId =
    typeof params?.assessmentId === "string" ? params.assessmentId : "";
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!assessmentId) return;
    const run = async () => {
      try {
        const res = await fetch(`/api/reports/me/${assessmentId}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || "Could not load report.");
        }
        setData(payload as Data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load report.");
      }
    };
    run();
  }, [assessmentId]);

  const traitNarratives = useMemo(() => {
    const raw = data?.narrative?.traitNarratives || [];
    if (raw.length > 0) {
      const byKey = new Map(raw.map((item) => [item.key, item]));
      return traitOrder
        .map(({ key }) => byKey.get(key))
        .filter((item): item is TraitNarrative => Boolean(item));
    }

    if (!data?.score) return [];

    return traitOrder.map(({ key, label }) =>
      buildFallbackTraitNarrative(key, label, Number(data.score?.[key] || 0)),
    );
  }, [data]);

  const strengths =
    data?.narrative?.strengths?.length
      ? data.narrative.strengths
      : ["Your strongest patterns are summarized once report generation data is available."];

  const growthAreas =
    data?.narrative?.growthAreas?.length
      ? data.narrative.growthAreas
      : ["Development priorities will appear once narrative data is finalized."];

  const actions =
    data?.narrative?.actions?.length
      ? data.narrative.actions
      : [
          "Select one strength and one growth behavior to practice weekly for the next month.",
          "Request concise feedback from one teammate after each key collaboration milestone.",
        ];

  const workplaceSignals =
    data?.narrative?.workplaceSignals?.length
      ? data.narrative.workplaceSignals
      : [
          "You are likely to perform best when expectations, ownership, and decision boundaries are explicit.",
        ];

  const reflectionPrompts = data?.narrative?.reflectionPrompts || [];
  const managerDiscussionGuide = data?.narrative?.managerDiscussionGuide || [];

  const extendedInsights = [
    data?.narrative?.aiNarrative?.executiveSummary,
    data?.narrative?.aiNarrative?.strengthsNarrative,
    data?.narrative?.aiNarrative?.developmentNarrative,
    data?.narrative?.aiNarrative?.managerCoaching,
  ].filter((item): item is string => Boolean(item));

  const assessmentTitle =
    data?.narrative?.assessmentTitle || data?.assessment?.title || "OLQLAB Assessment";
  const reportHeadline = data?.narrative?.profileHeadline || "Workstyle Development Profile";
  const participantName =
    data?.narrative?.participantName?.trim() || "Participant";
  const firstName = participantName.split(" ")[0] || "Participant";
  const summary =
    data?.narrative?.summary ||
    "This report combines personality tendencies and scenario behavior to guide focused growth and practical impact.";

  const takenAtLabel = formatDateTime(
    data?.narrative?.assessmentTakenAt || data?.submittedAt || null,
  );

  const traitSignals = traitOrder.map(({ key, label }) => {
    const value = Math.max(0, Math.min(100, Number(data?.score?.[key] || 0)));
    return {
      key,
      label,
      value,
      band: toBand(value),
    };
  });

  if (!assessmentId) return <main className="p-8">Invalid assessment id.</main>;
  if (error) return <main className="p-8">{error}</main>;
  if (!data) return <main className="p-8">Loading report...</main>;
  if (data.message) return <main className="p-8">{data.message}</main>;

  return (
    <main className="mx-auto max-w-6xl space-y-7 p-4 md:space-y-8 md:p-8">
      <header className="relative overflow-hidden rounded-[32px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-amber-50 p-7 shadow-sm md:p-9">
        <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />

        <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {assessmentTitle}
        </p>
        <h1 className="relative mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Development Report for {firstName}
        </h1>
        <p className="relative mt-2 text-lg font-medium text-slate-800">{reportHeadline}</p>
        <p className="relative mt-4 max-w-3xl text-sm leading-7 text-slate-700">
          {firstName}, {summary.charAt(0).toLowerCase()}
          {summary.slice(1)}
        </p>

        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-700">
            Test Taken: {takenAtLabel}
          </div>
          <a
            href={`/api/reports/me/${assessmentId}/pdf`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Download Full PDF
          </a>
        </div>
      </header>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Trait Signal Map</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Visual profile only
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          These visual indicators show your relative signal strength across each dimension without
          exposing numeric scoring.
        </p>
        <div className="mt-6 grid gap-4">
          {traitSignals.map((trait) => (
            <div key={trait.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{trait.label}</p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${bandClasses[trait.band]}`}
                >
                  {bandLabels[trait.band]}
                </span>
              </div>
              <div className="relative h-4 rounded-full bg-gradient-to-r from-sky-200 via-amber-200 to-emerald-300">
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-slate-700 bg-white shadow-sm"
                  style={{
                    left: `calc(${Math.max(3, Math.min(97, trait.value))}% - 8px)`,
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <span>Emerging</span>
                <span>Balanced</span>
                <span>Strong</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-900">
            Core Strength Themes
          </h2>
          <p className="mt-3 text-sm leading-7 text-emerald-950">{strengths[0]}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
            Primary Development Focus
          </h2>
          <p className="mt-3 text-sm leading-7 text-amber-950">{growthAreas[0]}</p>
        </article>
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-5 md:col-span-2 lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-900">
            Immediate Next Step
          </h2>
          <p className="mt-3 text-sm leading-7 text-cyan-950">{actions[0]}</p>
        </article>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Trait Context and Application
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Each trait section explains where the tendency helps most, and what to watch so the
          same tendency continues to create positive impact.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {traitNarratives.map((trait) => (
            <article
              key={trait.key}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">{trait.name}</h3>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${bandClasses[trait.band]}`}
                >
                  {bandLabels[trait.band]}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{trait.summary}</p>
              <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                <span className="font-semibold text-slate-900">Where this helps:</span>{" "}
                {trait.leverage}
              </p>
              <p className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                <span className="font-semibold text-slate-900">Development edge:</span>{" "}
                {trait.developmentFocus}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 md:p-6">
          <h2 className="text-xl font-semibold text-emerald-950">Strengths in Practice</h2>
          <ul className="mt-3 space-y-3 text-sm leading-7 text-emerald-950">
            {strengths.map((item, index) => (
              <li key={`${index}-${item.slice(0, 48)}`} className="rounded-lg bg-white/70 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 md:p-6">
          <h2 className="text-xl font-semibold text-amber-950">Development Areas</h2>
          <ul className="mt-3 space-y-3 text-sm leading-7 text-amber-950">
            {growthAreas.map((item, index) => (
              <li key={`${index}-${item.slice(0, 48)}`} className="rounded-lg bg-white/70 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Action Plan
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          The following plan is designed to turn insight into repeatable behavior change.
        </p>
        <ol className="mt-5 space-y-3 text-sm text-slate-700">
          {actions.map((item, index) => (
            <li key={`${index}-${item.slice(0, 48)}`} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className="leading-7">{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Workplace Signals</h3>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
            {workplaceSignals.map((item, index) => (
              <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
            ))}
          </ul>
        </article>

        {(reflectionPrompts.length > 0 || managerDiscussionGuide.length > 0) && (
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">Discussion Prompts</h3>
            {reflectionPrompts.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Self Reflection
                </p>
                <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                  {reflectionPrompts.map((item, index) => (
                    <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            {managerDiscussionGuide.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Manager Conversation
                </p>
                <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700">
                  {managerDiscussionGuide.map((item, index) => (
                    <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </article>
        )}
      </section>

      {extendedInsights.length > 0 && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <h2 className="text-lg font-semibold text-indigo-950">Extended Insight</h2>
          <div className="mt-3 space-y-3 text-sm leading-7 text-indigo-950">
            {extendedInsights.map((item, index) => (
              <p key={`${index}-${item.slice(0, 48)}`} className="rounded-lg bg-white/70 px-3 py-2">
                {item}
              </p>
            ))}
            {data?.narrative?.aiNarrative?.improvementRoadmap?.length ? (
              <ul className="space-y-2 rounded-lg bg-white/70 px-3 py-3">
                {data.narrative.aiNarrative.improvementRoadmap.map((item, index) => (
                  <li key={`${index}-${item.slice(0, 48)}`}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
