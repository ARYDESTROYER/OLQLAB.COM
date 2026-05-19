"use client";

import { useCallback, useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

let toastIdCounter = 0;
let globalAddToast: ((message: string, variant?: ToastVariant) => void) | null = null;

/**
 * Imperative toast API — call from anywhere in the admin client code.
 *
 * Usage:
 *   toast("User created successfully", "success");
 *   toast("Something went wrong", "error");
 *   toast("Loading…", "info");
 */
export function toast(message: string, variant: ToastVariant = "info") {
  globalAddToast?.(message, variant);
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-[#B5803C]/55 bg-[#F4EEE0] text-[#101114]",
  error: "border-[#101114]/30 bg-[#F4EEE0] text-[#101114]",
  info: "border-[#101114]/15 bg-[#F4EEE0] text-[#101114]/82",
};

const variantDot: Record<ToastVariant, string> = {
  success: "bg-[#B5803C]",
  error: "bg-[#101114]",
  info: "bg-[#101114]/35",
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, variant }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    return () => {
      globalAddToast = null;
    };
  }, [addToast]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`animate-slide-in-toast pointer-events-auto flex max-w-sm items-start gap-3 border px-4 py-3 text-sm shadow-[0_18px_40px_-26px_rgba(16,17,20,0.6)] ${variantStyles[t.variant]}`}
        >
          <span
            aria-hidden
            className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${variantDot[t.variant]}`}
          />
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="ml-1 shrink-0 text-xs text-[#101114]/45 transition-opacity hover:text-[#101114]"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
