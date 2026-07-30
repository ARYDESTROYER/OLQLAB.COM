"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { buildReportHtmlTemplate } from "@/lib/report-format";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type ReportEditorClientProps = {
  report: {
    id: string;
    narrativeJson: string;
    status: string;
    availableAt: Date | null;
    deliveryMethod?: "DASHBOARD_ONLY" | "EMAIL_LINK" | null;
    user: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    };
    assessment: { title: string };
  };
};

function parseNarrative(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function hasLegacyTemplate(value: string) {
  return /TALENT\s*(?:<br\s*\/?>|\s)+VANTAGE|data-report-template=["'](?:talent-vantage|wissen-v1)["']/i.test(
    value,
  );
}

export default function ReportEditorClient({ report }: ReportEditorClientProps) {
  const router = useRouter();
  const participantName =
    `${report.user.firstName || ""} ${report.user.lastName || ""}`.trim() || "Participant";
  const sourceNarrative = useMemo(
    () => parseNarrative(report.narrativeJson),
    [report.narrativeJson],
  );
  const initialHtml = useMemo(() => {
    const edited = sourceNarrative.adminEditedHtml;
    if (typeof edited === "string" && edited.trim() && !hasLegacyTemplate(edited)) {
      return edited;
    }
    return buildReportHtmlTemplate(sourceNarrative, {
      assessmentTitle: report.assessment.title,
      participantName,
    });
  }, [participantName, report.assessment.title, sourceNarrative]);

  const [status, setStatus] = useState(report.status);
  const [deliveryMethod, setDeliveryMethod] = useState<"DASHBOARD_ONLY" | "EMAIL_LINK">(
    report.deliveryMethod || "DASHBOARD_ONLY",
  );
  const [busyAction, setBusyAction] = useState<"SAVE" | "SEND" | "UNPUBLISH" | "">("");
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ kind: "SUCCESS" | "ERROR"; text: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "UNPUBLISH" | "PUBLISH" | "TEMPLATE" | "NAVIGATE" | null
  >(null);
  const [pendingNavigation, setPendingNavigation] = useState("");
  const [retryDelivery, setRetryDelivery] = useState(false);
  const redeliveryKey = useRef("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: "Write the report content here…" }),
    ],
    content: initialHtml,
    onUpdate: () => {
      setDirty(true);
      setMessage(null);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base lg:prose-lg m-0 min-h-[34rem] max-w-none p-5 sm:p-8 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    editor?.setEditable(!preview, false);
  }, [editor, preview]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    const interceptInternalNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(
        destination.pathname + destination.search + destination.hash,
      );
      setConfirmAction("NAVIGATE");
    };

    document.addEventListener("click", interceptInternalNavigation, true);
    return () =>
      document.removeEventListener("click", interceptInternalNavigation, true);
  }, [dirty]);

  function narrativeJson() {
    if (!editor) throw new Error("The editor is still loading.");
    return JSON.stringify({ ...sourceNarrative, adminEditedHtml: editor.getHTML() });
  }

  async function responseError(
    res: Response,
    fallback: string,
    deliveryFailure = false,
  ) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; published?: boolean };
    if (data.published) {
      setStatus("PUBLISHED");
      if (deliveryFailure) setRetryDelivery(true);
    }
    return data.error || fallback;
  }

  async function save() {
    setBusyAction("SAVE");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/reports/${encodeURIComponent(report.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrativeJson: narrativeJson() }),
      });
      if (!res.ok) throw new Error(await responseError(res, "Could not save report."));
      const data = (await res.json()) as {
        report: { status: string };
        unpublishedForContentChange?: boolean;
      };
      setStatus(data.report.status);
      setDirty(false);
      setMessage({
        kind: "SUCCESS",
        text: data.unpublishedForContentChange
          ? "Edits saved as a draft. Publish again when the replacement is ready."
          : "Report saved.",
      });
      router.refresh();
    } catch (error) {
      setMessage({ kind: "ERROR", text: error instanceof Error ? error.message : "Could not save report." });
    } finally {
      setBusyAction("");
    }
  }

  async function unpublish() {
    setBusyAction("UNPUBLISH");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/reports/${encodeURIComponent(report.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeJson: narrativeJson(),
          status: "DRAFT",
          availableAt: null,
        }),
      });
      if (!res.ok) throw new Error(await responseError(res, "Could not unpublish report."));
      setStatus("DRAFT");
      setDirty(false);
      setMessage({ kind: "SUCCESS", text: "Report unpublished and saved as a draft." });
      router.refresh();
    } catch (error) {
      setMessage({ kind: "ERROR", text: error instanceof Error ? error.message : "Could not unpublish report." });
    } finally {
      setBusyAction("");
    }
  }

  async function publishAndDeliver() {
    setBusyAction("SEND");
    setMessage(null);
    try {
      const isExplicitRedelivery = status === "PUBLISHED" && !retryDelivery;
      if (isExplicitRedelivery && !redeliveryKey.current) {
        redeliveryKey.current = crypto.randomUUID();
      }
      const res = await fetch(`/api/admin/reports/${encodeURIComponent(report.id)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeJson: narrativeJson(),
          deliveryMethod,
          ...(redeliveryKey.current
            ? { redeliveryKey: redeliveryKey.current }
            : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(
          await responseError(res, "Could not publish report.", true),
        );
      }
      setStatus("PUBLISHED");
      setRetryDelivery(false);
      redeliveryKey.current = "";
      setDirty(false);
      setMessage({
        kind: "SUCCESS",
        text:
          deliveryMethod === "EMAIL_LINK"
            ? "Report published and notification sent."
            : "Report published to the participant dashboard.",
      });
      router.refresh();
    } catch (error) {
      setMessage({ kind: "ERROR", text: error instanceof Error ? error.message : "Could not publish report." });
    } finally {
      setBusyAction("");
    }
  }

  function loadOlqTemplate() {
    const next = buildReportHtmlTemplate(sourceNarrative, {
      assessmentTitle: report.assessment.title,
      participantName,
    });
    editor?.commands.setContent(next);
    setDirty(true);
    setPreview(false);
  }

  async function confirmSelectedAction() {
    const selected = confirmAction;
    if (!selected) return;
    if (selected === "TEMPLATE") {
      loadOlqTemplate();
      setConfirmAction(null);
      return;
    }
    if (selected === "NAVIGATE") {
      const destination = pendingNavigation;
      setDirty(false);
      setPendingNavigation("");
      setConfirmAction(null);
      if (destination) router.push(destination);
      return;
    }
    if (selected === "UNPUBLISH") await unpublish();
    else await publishAndDeliver();
    setConfirmAction(null);
  }

  if (!editor) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-live="polite">Loading report editor…</section>;
  }

  const isBusy = Boolean(busyAction);
  const confirmCopy =
    confirmAction === "NAVIGATE"
      ? {
          title: "Discard unsaved changes?",
          message:
            "The report contains edits that have not been saved. Leaving this page will discard them.",
          label: "Discard and leave",
          variant: "danger" as const,
        }
      : confirmAction === "UNPUBLISH"
      ? {
          title: "Unpublish report?",
          message:
            "The participant and every shared link will lose access until this report is published again.",
          label: "Unpublish",
          variant: "danger" as const,
        }
      : confirmAction === "PUBLISH"
        ? {
            title: deliveryMethod === "EMAIL_LINK" ? "Publish and email report?" : "Publish report?",
            message:
              "The participant will be able to view the current report content. Confirm that your edits and redactions are complete.",
            label: deliveryMethod === "EMAIL_LINK" ? "Publish and email" : "Publish",
            variant: "default" as const,
          }
        : {
            title: "Replace current document?",
            message:
              "This replaces the current editor content with a fresh OLQ Lab template built from stored assessment evidence. Unsaved edits will be lost.",
            label: "Replace document",
            variant: "danger" as const,
          };

  return (
    <>
    <div className="grid min-h-screen gap-5 bg-slate-50 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <main className="min-w-0">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white p-2">
            <button type="button" onClick={() => setPreview(false)} aria-pressed={!preview} className={`rounded border px-2.5 py-1 text-xs ${!preview ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>Edit</button>
            <button type="button" onClick={() => setPreview(true)} aria-pressed={preview} className={`rounded border px-2.5 py-1 text-xs ${preview ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>Preview</button>
            <button type="button" onClick={() => dirty ? setConfirmAction("TEMPLATE") : loadOlqTemplate()} className="rounded border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">Load OLQ template</button>
            {!preview ? (
              <>
                <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden />
                <button type="button" aria-label="Bold" aria-pressed={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} className="rounded p-2 font-bold hover:bg-slate-100">B</button>
                <button type="button" aria-label="Italic" aria-pressed={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} className="rounded p-2 italic hover:bg-slate-100">I</button>
                <button type="button" aria-label="Underline" aria-pressed={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} className="rounded p-2 underline hover:bg-slate-100">U</button>
                <button type="button" aria-label="Heading level 2" aria-pressed={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="rounded p-2 font-bold hover:bg-slate-100">H2</button>
                <button type="button" aria-label="Bullet list" aria-pressed={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} className="rounded p-2 hover:bg-slate-100">• List</button>
                <button type="button" aria-label="Numbered list" aria-pressed={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} className="rounded p-2 hover:bg-slate-100">1. List</button>
              </>
            ) : null}
            <span className="ml-auto text-xs text-slate-500">{dirty ? "Unsaved changes" : "Saved"}</span>
          </div>
          <EditorContent editor={editor} />
        </div>
      </main>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-5">
        <h2 className="text-lg font-semibold text-slate-900">Report delivery</h2>
        <dl className="mt-5 space-y-4 text-sm">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Participant</dt><dd className="mt-1 font-medium">{participantName}</dd><dd className="break-all text-xs text-slate-500">{report.user.email}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Assessment</dt><dd className="mt-1">{report.assessment.title}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt><dd className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status}</dd></div>
        </dl>

        <fieldset className="mt-6 space-y-3 border-t border-slate-200 pt-5">
          <legend className="text-sm font-medium">Delivery method</legend>
          <label className="flex items-start gap-3 text-sm"><input type="radio" name="deliveryMode" value="DASHBOARD_ONLY" checked={deliveryMethod === "DASHBOARD_ONLY"} onChange={() => setDeliveryMethod("DASHBOARD_ONLY")} className="mt-1" /><span><strong className="block">Dashboard only</strong><span className="text-xs text-slate-500">Requires the participant to sign in.</span></span></label>
          <label className="flex items-start gap-3 text-sm"><input type="radio" name="deliveryMode" value="EMAIL_LINK" checked={deliveryMethod === "EMAIL_LINK"} onChange={() => setDeliveryMethod("EMAIL_LINK")} className="mt-1" /><span><strong className="block">Email secure link</strong><span className="text-xs text-slate-500">Sends a time-limited share link.</span></span></label>
        </fieldset>

        {message ? <p className={`mt-5 rounded-xl p-3 text-sm ${message.kind === "ERROR" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`} role={message.kind === "ERROR" ? "alert" : "status"}>{message.text}</p> : null}

        <div className="mt-6 grid gap-3">
          <button type="button" onClick={() => void save()} disabled={isBusy || !dirty} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium disabled:opacity-50">{busyAction === "SAVE" ? "Saving…" : status === "PUBLISHED" ? "Save edits as draft" : "Save draft"}</button>
          <button type="button" onClick={() => setConfirmAction("UNPUBLISH")} disabled={isBusy || status !== "PUBLISHED"} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 disabled:opacity-50">{busyAction === "UNPUBLISH" ? "Unpublishing…" : "Unpublish"}</button>
          <button type="button" onClick={() => setConfirmAction("PUBLISH")} disabled={isBusy} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busyAction === "SEND" ? "Publishing…" : status === "PUBLISHED" ? "Save and deliver again" : "Publish and deliver"}</button>
        </div>
      </aside>
    </div>
    <ConfirmDialog
      open={confirmAction !== null}
      title={confirmCopy.title}
      message={confirmCopy.message}
      confirmLabel={confirmCopy.label}
      variant={confirmCopy.variant}
      busy={isBusy}
      onCancel={() => {
        setPendingNavigation("");
        setConfirmAction(null);
      }}
      onConfirm={() => void confirmSelectedAction()}
    />
    </>
  );
}
