"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/admin/Toast";

type SettingsPayload = {
  settings: {
    magicLinkExpiryMinutes: number;
    emailSubjectTemplate: string;
    emailTextTemplate: string;
    emailHtmlTemplate: string;
  };
  defaults: {
    magicLinkExpiryMinutes: number;
    emailSubjectTemplate: string;
    emailTextTemplate: string;
    emailHtmlTemplate: string;
  };
  options: {
    magicLinkExpiryMinutes: number[];
    templateVariables: string[];
  };
  storage: {
    writable: boolean;
    reason: string | null;
  };
};

function formatExpiryOption(minutes: number) {
  if (minutes === 60) return "1 hour";
  if (minutes === 360) return "6 hours";
  return `${minutes} minutes`;
}

export default function SettingsClient() {
  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [magicLinkExpiryMinutes, setMagicLinkExpiryMinutes] = useState(30);
  const [emailSubjectTemplate, setEmailSubjectTemplate] = useState("");
  const [emailTextTemplate, setEmailTextTemplate] = useState("");
  const [emailHtmlTemplate, setEmailHtmlTemplate] = useState("");

  const hydrateFromPayload = useCallback((next: SettingsPayload) => {
    setPayload(next);
    setMagicLinkExpiryMinutes(next.settings.magicLinkExpiryMinutes);
    setEmailSubjectTemplate(next.settings.emailSubjectTemplate);
    setEmailTextTemplate(next.settings.emailTextTemplate);
    setEmailHtmlTemplate(next.settings.emailHtmlTemplate);
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/auth-signin", { cache: "no-store" });
      const data = (await res.json()) as SettingsPayload;
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load sign-in settings.");
      }
      hydrateFromPayload(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load sign-in settings.";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [hydrateFromPayload]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const hasChanges = useMemo(() => {
    if (!payload) return false;
    return (
      payload.settings.magicLinkExpiryMinutes !== magicLinkExpiryMinutes ||
      payload.settings.emailSubjectTemplate !== emailSubjectTemplate ||
      payload.settings.emailTextTemplate !== emailTextTemplate ||
      payload.settings.emailHtmlTemplate !== emailHtmlTemplate
    );
  }, [payload, magicLinkExpiryMinutes, emailSubjectTemplate, emailTextTemplate, emailHtmlTemplate]);

  async function saveSettings() {
    if (!payload?.storage.writable) {
      toast(payload?.storage.reason || "Settings storage is read-only.", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/auth-signin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          magicLinkExpiryMinutes,
          emailSubjectTemplate,
          emailTextTemplate,
          emailHtmlTemplate,
        }),
      });
      const data = (await res.json()) as SettingsPayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to save sign-in settings.");
      }
      hydrateFromPayload(data);
      toast("Sign-in settings updated.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save sign-in settings.";
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (!payload) return;
    setMagicLinkExpiryMinutes(payload.defaults.magicLinkExpiryMinutes);
    setEmailSubjectTemplate(payload.defaults.emailSubjectTemplate);
    setEmailTextTemplate(payload.defaults.emailTextTemplate);
    setEmailHtmlTemplate(payload.defaults.emailHtmlTemplate);
    toast("Loaded default templates locally. Save to apply.", "info");
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading sign-in settings...
      </section>
    );
  }

  if (!payload) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Failed to load settings.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Auth</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sign-in Link Settings</h2>
        <p className="mt-2 text-sm text-slate-600">
          Control magic-link expiry and the email sent to users at sign in.
        </p>

        {!payload.storage.writable ? (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {payload.storage.reason || "Settings storage is read-only."}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Sign-in Link Expiry</span>
            <select
              value={magicLinkExpiryMinutes}
              onChange={(event) => setMagicLinkExpiryMinutes(Number(event.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              {payload.options.magicLinkExpiryMinutes.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatExpiryOption(minutes)}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs text-slate-500">
              Current selected: <strong>{formatExpiryOption(payload.settings.magicLinkExpiryMinutes)}</strong>
            </span>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-800">Supported Template Variables</p>
            <p className="mt-1 text-xs text-slate-600">Use these placeholders in subject/body templates:</p>
            <p className="mt-2 text-xs text-slate-700">{payload.options.templateVariables.join("  ")}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Email Subject</span>
            <input
              value={emailSubjectTemplate}
              onChange={(event) => setEmailSubjectTemplate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              placeholder="Your OLQLab sign-in link"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Email Text Body</span>
            <textarea
              value={emailTextTemplate}
              onChange={(event) => setEmailTextTemplate(event.target.value)}
              className="mt-2 min-h-[180px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Email HTML Body</span>
            <textarea
              value={emailHtmlTemplate}
              onChange={(event) => setEmailHtmlTemplate(event.target.value)}
              className="mt-2 min-h-[220px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving || !hasChanges || !payload.storage.writable}
            className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset To Defaults
          </button>
          <button
            type="button"
            onClick={loadSettings}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reload
          </button>
        </div>
      </section>
    </div>
  );
}
