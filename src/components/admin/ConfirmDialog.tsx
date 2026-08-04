"use client";

import { useEffect, useId, useRef } from "react";

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "default";
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const el = dialogRef.current;
        if (!el) return;

        if (open && !el.open) {
            el.showModal();
        } else if (!open && el.open) {
            el.close();
        }
    }, [open]);

    // Close on backdrop click
    function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
        if (e.target === dialogRef.current && !busy) {
            onCancel();
        }
    }

    // Close on Escape
    function handleCancel(e: React.SyntheticEvent) {
        e.preventDefault();
        if (!busy) onCancel();
    }

    const confirmBtnClass =
        variant === "danger"
            ? "bg-rose-600 hover:bg-rose-700 text-white"
            : "bg-slate-900 hover:bg-slate-800 text-white";

    if (!open) return null;

    return (
        <dialog
            ref={dialogRef}
            onCancel={handleCancel}
            onClick={handleBackdropClick}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="fixed inset-0 z-[9998] m-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
        >
            <div className="p-6">
                <h3 id={titleId} className="text-base font-semibold text-slate-900">
                    {title}
                </h3>
                <p
                    id={descriptionId}
                    className="mt-2 text-sm leading-relaxed text-slate-600"
                >
                    {message}
                </p>
                <div className="mt-6 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${confirmBtnClass}`}
                    >
                        {busy ? "Processing…" : confirmLabel}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
