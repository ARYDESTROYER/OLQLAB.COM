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
    success:
        "border-emerald-300 bg-emerald-50 text-emerald-900",
    error:
        "border-rose-300 bg-rose-50 text-rose-900",
    info:
        "border-sky-300 bg-sky-50 text-sky-900",
};

const variantIcons: Record<ToastVariant, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
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
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    role="alert"
                    className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg animate-slide-in-toast max-w-sm ${variantStyles[t.variant]}`}
                >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/60 text-xs font-bold">
                        {variantIcons[t.variant]}
                    </span>
                    <span className="flex-1 leading-snug">{t.message}</span>
                    <button
                        onClick={() => dismiss(t.id)}
                        className="ml-1 shrink-0 text-xs opacity-50 hover:opacity-100 transition-opacity"
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}
