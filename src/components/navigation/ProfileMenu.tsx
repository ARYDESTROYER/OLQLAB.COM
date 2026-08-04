"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useId, useRef, useState } from "react";
import {
  hasParticipantWorkspaceAccess,
  type WorkspaceRole,
} from "@/lib/workspace-navigation";

export default function ProfileMenu({
  role,
  email,
}: {
  role: WorkspaceRole;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div
      className="relative"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }}
    >
      <button
        ref={buttonRef}
        aria-controls={menuId}
        aria-expanded={open}
        className="min-h-11 rounded-xl border border-ink/20 bg-paper px-3 py-2 text-sm font-semibold text-ink transition hover:border-ink/45 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--focus-light)]"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        Profile
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-12 z-50 max-h-[calc(100svh-6rem)] w-64 overflow-y-auto overscroll-contain rounded-2xl border border-ink/15 bg-paper p-2 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]"
        >
          <div className="mb-2 rounded-xl bg-[var(--cream-warm)] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/62">Signed in</p>
            <p className="mt-1 truncate text-sm text-ink/85">{email || "Account"}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--signal-cognitive-text)]">{role}</p>
          </div>

          <div className="grid gap-1">
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-ink/80 transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus-light)]"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            {hasParticipantWorkspaceAccess(role) && (
              <>
                <Link
                  href="/assessment/current"
                  className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-ink/80 transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus-light)]"
                  onClick={() => setOpen(false)}
                >
                  Assessment Center
                </Link>
                <Link
                  href="/reports/current"
                  className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-ink/80 transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus-light)]"
                  onClick={() => setOpen(false)}
                >
                  My Reports
                </Link>
              </>
            )}
            {role === "LEADER" && (
              <Link
                href="/reports/team"
                className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-ink/80 transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus-light)]"
                onClick={() => setOpen(false)}
              >
                Team Reports
              </Link>
            )}
            {role === "ADMIN" && (
              <Link
                href="/admin"
                className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-ink/80 transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus-light)]"
                onClick={() => setOpen(false)}
              >
                Admin Console
              </Link>
            )}
            <button
              className="min-h-11 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus-light)]"
              onClick={() => signOut({ callbackUrl: "/" })}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
