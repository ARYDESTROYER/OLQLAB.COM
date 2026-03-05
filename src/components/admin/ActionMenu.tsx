"use client";

import { useEffect, useRef, useState } from "react";

export type ActionItem = {
    label: string;
    onClick: () => void;
    variant?: "default" | "danger" | "primary";
    disabled?: boolean;
    hidden?: boolean;
};

type ActionMenuProps = {
    actions: ActionItem[];
    /** Optional label override for the trigger button */
    triggerLabel?: string;
};

const variantClasses: Record<string, string> = {
    default: "text-slate-700 hover:bg-slate-50",
    primary: "text-cyan-700 hover:bg-cyan-50",
    danger: "text-rose-600 hover:bg-rose-50",
};

export default function ActionMenu({ actions, triggerLabel }: ActionMenuProps) {
    const [open, setOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open]);

    function handleToggleMenu() {
        const nextOpen = !open;
        if (nextOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const estimatedMenuHeight = 180;
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            setOpenUpward(spaceBelow < estimatedMenuHeight && spaceAbove > estimatedMenuHeight);
        }
        setOpen(nextOpen);
    }

    const visibleActions = actions.filter((a) => !a.hidden);
    if (visibleActions.length === 0) return null;

    return (
        <div className="relative inline-block" ref={menuRef}>
            <button
                ref={triggerRef}
                onClick={handleToggleMenu}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50 transition-colors"
                aria-haspopup="true"
                aria-expanded={open}
            >
                {triggerLabel || "Actions ▾"}
            </button>

            {open && (
                <div
                    className={`absolute right-0 z-50 min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl animate-slide-in-menu ${
                        openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
                    }`}
                >
                    {visibleActions.map((action, idx) => (
                        <button
                            key={idx}
                            disabled={action.disabled}
                            onClick={() => {
                                action.onClick();
                                setOpen(false);
                            }}
                            className={`w-full px-3.5 py-2 text-left text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[action.variant || "default"]
                                }`}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
