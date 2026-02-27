"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

function resolveEditableHtml(narrative: Record<string, unknown>) {
    const adminEditedHtml = narrative.adminEditedHtml;
    if (typeof adminEditedHtml === "string" && adminEditedHtml.trim()) {
        return adminEditedHtml;
    }

    const aiNarrative = narrative.aiNarrative;
    if (typeof aiNarrative === "string" && aiNarrative.trim()) {
        return aiNarrative;
    }

    if (aiNarrative && typeof aiNarrative === "object") {
        const ai = aiNarrative as {
            executiveSummary?: string;
            strengthsNarrative?: string;
            developmentNarrative?: string;
            managerCoaching?: string;
            improvementRoadmap?: string[];
            cautionNotes?: string[];
        };

        const blocks: string[] = [];
        if (ai.executiveSummary) blocks.push(`<p>${ai.executiveSummary}</p>`);
        if (ai.strengthsNarrative) blocks.push(`<p>${ai.strengthsNarrative}</p>`);
        if (ai.developmentNarrative) blocks.push(`<p>${ai.developmentNarrative}</p>`);
        if (ai.managerCoaching) blocks.push(`<p>${ai.managerCoaching}</p>`);
        if (Array.isArray(ai.improvementRoadmap) && ai.improvementRoadmap.length) {
            blocks.push(`<h3>Improvement Roadmap</h3><ul>${ai.improvementRoadmap.map((item) => `<li>${item}</li>`).join("")}</ul>`);
        }
        if (Array.isArray(ai.cautionNotes) && ai.cautionNotes.length) {
            blocks.push(`<h3>Caution Notes</h3><ul>${ai.cautionNotes.map((item) => `<li>${item}</li>`).join("")}</ul>`);
        }

        if (blocks.length) {
            return blocks.join("");
        }
    }

    const summary = narrative.summary;
    if (typeof summary === "string" && summary.trim()) {
        return `<p>${summary}</p>`;
    }

    return "<p>No report content found.</p>";
}

type ReportEditorClientProps = {
    report: {
        id: string;
        narrativeJson: string;
        status: string;
        availableAt: Date | null;
        user: {
            firstName: string | null;
            lastName: string | null;
            email: string | null;
        };
        assessment: {
            title: string;
        };
    };
};

export default function ReportEditorClient({ report }: ReportEditorClientProps) {
    const router = useRouter();

    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [editMode, setEditMode] = useState<"RICH" | "JSON">("RICH");
    const [deliveryMethod, setDeliveryMethod] = useState<"DASHBOARD_ONLY" | "EMAIL_LINK">("DASHBOARD_ONLY");

    let parsedNarrative: Record<string, unknown>;
    try {
        parsedNarrative = JSON.parse(report.narrativeJson) as Record<string, unknown>;
    } catch (e) {
        parsedNarrative = {};
    }

    const aiNarrativeHtml = resolveEditableHtml(parsedNarrative);
    const [htmlContent, setHtmlContent] = useState(aiNarrativeHtml);
    const [jsonContent, setJsonContent] = useState(() => JSON.stringify(parsedNarrative, null, 2));

    const parseJsonNarrative = () => {
        try {
            const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
            return parsed;
        } catch {
            throw new Error("Full report JSON is invalid. Please fix JSON formatting before saving/sending.");
        }
    };

    const buildUpdatedNarrative = () => {
        if (editMode === "JSON") {
            return parseJsonNarrative();
        }

        const updatedNarrative: Record<string, unknown> = {
            ...parsedNarrative,
            adminEditedHtml: htmlContent,
        };

        if (
            typeof parsedNarrative.aiNarrative === "string" ||
            typeof parsedNarrative.aiNarrative === "undefined" ||
            parsedNarrative.aiNarrative === null
        ) {
            updatedNarrative.aiNarrative = htmlContent;
        }

        return updatedNarrative;
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Placeholder.configure({
                placeholder: "Write the report content here...",
            }),
        ],
        content: htmlContent,
        onUpdate: ({ editor }) => {
            setHtmlContent(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none max-w-none min-h-[500px]",
            },
        },
    });

    const handleSaveProgress = async () => {
        setSaving(true);
        try {
            const updatedNarrative = buildUpdatedNarrative();
            const res = await fetch(`/api/admin/reports/${report.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ narrativeJson: JSON.stringify(updatedNarrative), status: "DRAFT" }),
            });
            if (!res.ok) throw new Error("Failed to save draft");
            alert("Draft saved successfully!");
            router.refresh();
        } catch (e) {
            alert("Error saving draft: " + String(e));
        } finally {
            setSaving(false);
        }
    };

    const handleSendReport = async () => {
        if (!window.confirm("Are you sure you want to send this report? This will make it visible to the participant.")) return;

        setSending(true);
        try {
            const updatedNarrative = buildUpdatedNarrative();
            const res = await fetch(`/api/admin/reports/${report.id}/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    narrativeJson: JSON.stringify(updatedNarrative),
                    deliveryMethod
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to send report");
            }
            alert("Report sent successfully!");
            router.push(`/admin/assessments`);
        } catch (e) {
            alert("Error sending report: " + String(e));
        } finally {
            setSending(false);
        }
    };

    if (!editor) {
        return <div>Loading editor...</div>;
    }

    return (
        <div className="flex bg-gray-50 min-h-screen">
            {/* Editor Main Canvas */}
            <div className="flex-1 overflow-y-auto pt-16 px-4 sm:px-12 xl:px-32 flex justify-center pb-24">
                <div className="w-full max-w-4xl bg-white min-h-[1056px] shadow-sm rounded-lg border border-gray-200 mt-6 md:mt-10 overflow-hidden relative">

                    {/* Editor Toolbar */}
                    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-2 flex flex-wrap gap-1 items-center rounded-t-lg shadow-sm">
                        <button
                            onClick={() => setEditMode("RICH")}
                            className={`px-2.5 py-1 text-xs rounded border ${editMode === "RICH" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}
                            title="Edit rich text"
                        >
                            Rich Text
                        </button>
                        <button
                            onClick={() => setEditMode("JSON")}
                            className={`px-2.5 py-1 text-xs rounded border ${editMode === "JSON" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300"}`}
                            title="Edit full report JSON"
                        >
                            Full JSON
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        {editMode === "RICH" && (
                            <>
                        <button
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            disabled={!editor.can().chain().focus().toggleBold().run()}
                            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive("bold") ? "bg-gray-200" : ""}`}
                            title="Bold"
                        >
                            <span className="font-bold">B</span>
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            disabled={!editor.can().chain().focus().toggleItalic().run()}
                            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive("italic") ? "bg-gray-200" : ""}`}
                            title="Italic"
                        >
                            <span className="italic">I</span>
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            disabled={!editor.can().chain().focus().toggleUnderline().run()}
                            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive("underline") ? "bg-gray-200" : ""}`}
                            title="Underline"
                        >
                            <span className="underline">U</span>
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <button
                            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                            className={`p-2 rounded hover:bg-gray-100 font-bold ${editor.isActive("heading", { level: 1 }) ? "bg-gray-200" : ""}`}
                        >
                            H1
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                            className={`p-2 rounded hover:bg-gray-100 font-bold ${editor.isActive("heading", { level: 2 }) ? "bg-gray-200" : ""}`}
                        >
                            H2
                        </button>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <button
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive("bulletList") ? "bg-gray-200" : ""}`}
                            title="Bullet List"
                        >
                            • List
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            className={`p-2 rounded hover:bg-gray-100 ${editor.isActive("orderedList") ? "bg-gray-200" : ""}`}
                            title="Ordered List"
                        >
                            1. List
                        </button>
                            </>
                        )}
                    </div>

                    {editMode === "RICH" ? (
                        <EditorContent editor={editor} className="p-8 md:p-12 lg:p-16" />
                    ) : (
                        <div className="p-4 md:p-6 lg:p-8">
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                                Full Report JSON (all sections editable)
                            </label>
                            <textarea
                                className="min-h-[680px] w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                value={jsonContent}
                                onChange={(e) => setJsonContent(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Actions & Meta */}
            <div className="w-80 border-l border-gray-200 bg-white fixed right-0 top-16 bottom-0 overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Report Delivery</h2>

                    <div className="space-y-4 mb-8">
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</label>
                            <p className="mt-1 text-sm font-medium text-gray-900">
                                {report.user.firstName} {report.user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{report.user.email}</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment</label>
                            <p className="mt-1 text-sm text-gray-900">{report.assessment.title}</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label>
                            <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${report.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                }`}>
                                {report.status}
                            </span>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-sm font-medium text-gray-900 mb-4">Delivery Method</h3>
                        <div className="space-y-3">
                            <label className="flex items-start">
                                <input
                                    type="radio"
                                    name="deliveryMode"
                                    value="DASHBOARD_ONLY"
                                    checked={deliveryMethod === "DASHBOARD_ONLY"}
                                    onChange={() => setDeliveryMethod("DASHBOARD_ONLY")}
                                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-700">Dashboard Only</span>
                                    <span className="block text-xs text-gray-500 mt-1">Publishes report to participant&apos;s /reports view. Requires sign-in.</span>
                                </div>
                            </label>

                            <label className="flex items-start">
                                <input
                                    type="radio"
                                    name="deliveryMode"
                                    value="EMAIL_LINK"
                                    checked={deliveryMethod === "EMAIL_LINK"}
                                    onChange={() => setDeliveryMethod("EMAIL_LINK")}
                                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-700">Email Magic Link</span>
                                    <span className="block text-xs text-gray-500 mt-1">Dispatches email with a secure 7-day share link. No sign-in required.</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="mt-10 space-y-3">
                        <button
                            onClick={handleSaveProgress}
                            disabled={saving || sending}
                            className="w-full flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save Progress"}
                        </button>

                        <button
                            onClick={handleSendReport}
                            disabled={saving || sending}
                            className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${report.status === "PUBLISHED"
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                                }`}
                        >
                            {sending ? "Sending..." : report.status === "PUBLISHED" ? "Already Sent" : "Send Report"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
