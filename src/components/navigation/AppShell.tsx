"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import ProfileMenu from "@/components/navigation/ProfileMenu";
import DensityToggle from "@/components/navigation/DensityToggle";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";

type NavLinkSpec = { href: string; label: string; matchPrefix: string };

/**
 * Editorial workspace shell. Sticky cream-glass header + minimal focused
 * variant for the in-progress assessment screen. All chrome uses the cream
 * / ink / brass design tokens defined in `globals.css`.
 */
export default function AppShell({
  role,
  email,
  children,
}: {
  role: Role;
  email?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const focusedSession = pathname.startsWith("/assessment/session/");

  const links: NavLinkSpec[] = useMemo(() => {
    const base: NavLinkSpec[] = [
      { href: "/dashboard", label: "Dashboard", matchPrefix: "/dashboard" },
      { href: "/assessment/current", label: "Assessment Center", matchPrefix: "/assessment" },
      { href: "/reports/current", label: "My Reports", matchPrefix: "/reports" },
      { href: "/", label: "Landing", matchPrefix: "/" },
    ];

    if (role === "ADMIN") {
      base.splice(3, 0, { href: "/admin", label: "Admin", matchPrefix: "/admin" });
    }

    return base;
  }, [role]);

  if (focusedSession) {
    return (
      <main className="min-h-screen bg-[#EFE8DA] text-[#101114]">
        <header className="sticky top-0 z-40 border-b border-[#101114]/10 bg-[#EFE8DA]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4 md:px-10">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt=""
                width={32}
                height={32}
                className="rounded-full opacity-90"
                priority
              />
              <span className="font-display text-lg tracking-tight text-[#101114]">
                OLQLAB
              </span>
            </Link>

            <div className="flex items-center gap-4 md:gap-5">
              <Link
                href="/assessment/current"
                className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
              >
                Exit assessment
              </Link>
              <Link
                href="/reports/current"
                className="link-underline hidden text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114] md:inline-block"
              >
                My reports
              </Link>
              <ProfileMenu role={role} email={email} />
            </div>
          </div>
        </header>

        <div>{children}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#EFE8DA] text-[#101114]">
      <header className="sticky top-0 z-40 border-b border-[#101114]/10 bg-[#EFE8DA]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-5 md:px-10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              className="rounded-full opacity-90"
              priority
            />
            <span className="font-display text-lg tracking-tight text-[#101114]">
              OLQLAB
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-[#101114]/55 md:inline-block">
              Workspace
            </span>
          </Link>

          <nav aria-label="Workspace" className="hidden items-center gap-8 md:flex">
            {links.map((item) => {
              const isActive =
                item.matchPrefix === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.matchPrefix);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  data-active={isActive ? "true" : "false"}
                  className="nav-link"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 md:gap-5">
            <DensityToggle />
            <button
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="workspace-mobile-nav"
              className="rounded-full border border-[#101114]/15 bg-[#F4EEE0]/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[#101114]/72 transition-colors duration-200 hover:border-[#B5803C]/55 hover:text-[#101114] md:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
            <ProfileMenu role={role} email={email} />
          </div>
        </div>

        {mobileOpen && (
          <div
            id="workspace-mobile-nav"
            className="border-t border-[#101114]/10 bg-[#EFE8DA] px-6 py-4 md:hidden"
          >
            <div className="grid gap-1">
              {links.map((item) => {
                const isActive =
                  item.matchPrefix === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.matchPrefix);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`block py-2.5 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "text-[#101114]"
                        : "text-[#101114]/70 hover:text-[#101114]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <div>{children}</div>
    </main>
  );
}
