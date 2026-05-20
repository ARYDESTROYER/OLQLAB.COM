"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

export default function ProfileMenu({
  role,
  email,
}: {
  role: Role;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        Profile
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]">
          <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Signed in</p>
            <p className="mt-1 truncate text-sm text-slate-800">{email || "Account"}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-800">{role}</p>
          </div>

          <div className="grid gap-1">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/assessment/current"
              className="rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              Assessment Center
            </Link>
            <Link
              href="/reports/current"
              className="rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              My Reports
            </Link>
            {role === "ADMIN" && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                Admin Console
              </Link>
            )}
            <button
              className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
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
