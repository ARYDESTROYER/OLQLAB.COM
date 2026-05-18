"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

function roleLabel(role: Role) {
  if (role === "ADMIN") return "Admin";
  if (role === "LEADER") return "Leader";
  return "Participant";
}

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
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full border border-[#101114]/15 bg-[#F4EEE0]/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[#101114]/72 transition-colors duration-200 hover:border-[#B5803C]/55 hover:text-[#101114]"
      >
        <span className="brass-dot" aria-hidden />
        <span>Profile</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-72 origin-top-right border border-[#101114]/10 bg-[#EFE8DA] p-2 shadow-[0_24px_60px_-30px_rgba(16,17,20,0.45)]"
        >
          <div className="border-b border-[#101114]/10 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#101114]/55">
              Signed in
            </p>
            <p className="font-display mt-1 truncate text-base tracking-tight text-[#101114]">
              {email || "Account"}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-[#B5803C]">
              {roleLabel(role)}
            </p>
          </div>

          <div className="grid gap-0.5 pt-2">
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-[#101114]/80 transition-colors duration-200 hover:bg-[#F4EEE0] hover:text-[#101114]"
            >
              Dashboard
            </Link>
            <Link
              href="/assessment/current"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-[#101114]/80 transition-colors duration-200 hover:bg-[#F4EEE0] hover:text-[#101114]"
            >
              Assessment Center
            </Link>
            <Link
              href="/reports/current"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-[#101114]/80 transition-colors duration-200 hover:bg-[#F4EEE0] hover:text-[#101114]"
            >
              My Reports
            </Link>
            {role === "ADMIN" && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-[#101114]/80 transition-colors duration-200 hover:bg-[#F4EEE0] hover:text-[#101114]"
              >
                Admin Console
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mt-1 border-t border-[#101114]/10 px-4 py-2.5 text-left text-sm font-medium text-[#101114] transition-colors duration-200 hover:bg-[#F4EEE0]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
