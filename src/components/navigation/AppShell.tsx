"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import ProfileMenu from "@/components/navigation/ProfileMenu";
import {
  getFocusedSessionNavigation,
  hasParticipantWorkspaceAccess,
  type WorkspaceRole,
} from "@/lib/workspace-navigation";

export default function AppShell({
  role,
  email,
  children,
}: {
  role: WorkspaceRole;
  email?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const focusedSession = pathname.startsWith("/assessment/session/");
  const focusedNavigation = getFocusedSessionNavigation(pathname, role);

  const links = useMemo(() => {
    const base = [{ href: "/dashboard", label: "Dashboard", matchPrefixes: ["/dashboard"] }];

    if (hasParticipantWorkspaceAccess(role)) {
      base.push(
        {
          href: "/assessment/current",
          label: "Assessment Center",
          matchPrefixes: ["/assessment"],
        },
        {
          href: "/reports/current",
          label: "My Reports",
          matchPrefixes: ["/reports/current", "/reports/me"],
        },
      );
    }

    if (role === "LEADER") {
      base.push({
        href: "/reports/team",
        label: "Team Reports",
        matchPrefixes: ["/reports/team", "/reports/leader"],
      });
    }
    if (role === "ADMIN") {
      base.push({ href: "/admin", label: "Admin", matchPrefixes: ["/admin"] });
    }

    base.push({ href: "/", label: "Landing", matchPrefixes: ["/"] });

    return base;
  }, [role]);

  if (focusedSession) {
    return (
      <main className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-slate-200/75 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4 md:px-10">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="gradient-ring flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                OQ
              </div>
              <p className="text-sm font-semibold tracking-[0.12em] text-slate-900">OLQLAB</p>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href={focusedNavigation.exitHref}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {focusedNavigation.exitLabel}
              </Link>
              {focusedNavigation.showMyReports && (
                <Link
                  href="/reports/current"
                  className="hidden rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 md:inline-block"
                >
                  My Reports
                </Link>
              )}
              <ProfileMenu role={role} email={email} />
            </div>
          </div>
        </header>

        <div>{children}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/75 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4 md:px-10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="gradient-ring flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              OQ
            </div>
            <p className="text-sm font-semibold tracking-[0.12em] text-slate-900">OLQLAB Workspace</p>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  item.matchPrefixes.some((prefix) =>
                    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix),
                  )
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 md:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              type="button"
            >
              Menu
            </button>
            <ProfileMenu role={role} email={email} />
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-200 bg-white px-6 py-3 md:hidden">
            <div className="grid gap-2">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    item.matchPrefixes.some((prefix) =>
                      prefix === "/" ? pathname === "/" : pathname.startsWith(prefix),
                    )
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <div>{children}</div>
    </main>
  );
}
