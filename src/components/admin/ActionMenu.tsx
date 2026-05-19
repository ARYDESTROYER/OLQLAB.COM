"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  default: "text-[#101114]/82 hover:bg-[#F4EEE0]",
  primary: "text-[#B5803C] hover:bg-[#F4EEE0]",
  danger: "text-[#101114] hover:bg-[#F4EEE0]",
};

export default function ActionMenu({ actions, triggerLabel }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(0);
  const [menuLeft, setMenuLeft] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const estimatedMenuHeight = 180;
  const menuWidth = 180;
  const viewportPadding = 8;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const clickedTrigger = menuRef.current?.contains(target);
      const clickedPortalMenu = portalMenuRef.current?.contains(target);
      if (clickedTrigger || clickedPortalMenu) return;
      setOpen(false);
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

  function updateMenuPosition() {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 6;
    if (spaceBelow < estimatedMenuHeight && spaceAbove > estimatedMenuHeight) {
      top = Math.max(viewportPadding, rect.top - estimatedMenuHeight - 6);
    }

    let left = rect.right - menuWidth;
    left = Math.max(
      viewportPadding,
      Math.min(left, window.innerWidth - menuWidth - viewportPadding),
    );

    setMenuTop(top);
    setMenuLeft(left);
  }

  function handleToggleMenu() {
    if (!open) {
      updateMenuPosition();
      setOpen(true);
      return;
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handleViewportChange() {
      updateMenuPosition();
    }
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  const visibleActions = actions.filter((a) => !a.hidden);
  if (visibleActions.length === 0) return null;

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggleMenu}
        className="inline-flex items-center gap-1 border border-[#101114]/20 bg-[#F4EEE0]/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#101114]/72 transition-colors duration-200 hover:border-[#B5803C]/55 hover:text-[#101114]"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {triggerLabel || "Actions ▾"}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={portalMenuRef}
            className="animate-slide-in-menu fixed z-[10000] min-w-[160px] border border-[#101114]/10 bg-[#EFE8DA] py-1 shadow-[0_24px_60px_-30px_rgba(16,17,20,0.55)]"
            style={{ top: menuTop, left: menuLeft, width: menuWidth }}
          >
            {visibleActions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                }}
                className={`w-full px-3.5 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  variantClasses[action.variant || "default"]
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
