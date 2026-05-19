"use client";

import { useEffect, useRef } from "react";

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

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9998] m-auto w-full max-w-md border border-[#101114]/10 bg-[#EFE8DA] p-0 shadow-[0_24px_60px_-30px_rgba(16,17,20,0.55)] backdrop:bg-[#101114]/35 backdrop:backdrop-blur-[2px]"
    >
      <div className="border-t-2 border-[#B5803C]" />
      <div className="p-6 md:p-7">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#B5803C]">
          {variant === "danger" ? "Destructive" : "Confirm"}
        </p>
        <h3 className="font-display mt-3 text-xl tracking-tight text-[#101114]">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-[#101114]/70">{message}</p>
        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="workspace-btn-secondary disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="workspace-btn-primary disabled:opacity-50"
          >
            {busy ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
