"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import ProfileMenu from "@/components/navigation/ProfileMenu";
import WorkspaceLinkStatus from "@/components/navigation/WorkspaceLinkStatus";
import WorkspaceRouteWarmer from "@/components/navigation/WorkspaceRouteWarmer";
import {
  getFocusedSessionNavigation,
  hasParticipantWorkspaceAccess,
  type WorkspaceRole,
} from "@/lib/workspace-navigation";

type WorkspaceLink = {
  href: string;
  label: string;
  matchPrefixes: string[];
};

function isActiveLink(pathname: string, item: WorkspaceLink) {
  return item.matchPrefixes.some((prefix) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix),
  );
}

function BrandMark({ focused = false }: { focused?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="group flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--focus-light)]"
    >
      <span className="workspace-mark" aria-hidden="true">
        OQ
      </span>
      <span
        className={`${focused ? "hidden sm:block" : ""} text-sm font-bold tracking-[0.14em] text-ink`}
      >
        OLQLAB
        {!focused ? <span className="hidden font-medium text-ink/55 xl:inline"> / Workspace</span> : null}
      </span>
      <WorkspaceLinkStatus label="Dashboard" />
    </Link>
  );
}

function NavigationLink({
  item,
  active,
  mobile = false,
  onNavigate,
}: {
  item: WorkspaceLink;
  active: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${mobile ? "workspace-mobile-link" : "workspace-nav-link"} ${
        active ? "is-active" : ""
      }`}
      onNavigate={onNavigate}
    >
      <span>{item.label}</span>
      <WorkspaceLinkStatus label={item.label} />
    </Link>
  );
}

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
  const mobileMenuId = useId();
  const headerRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setMobileOpen(false);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    function closeOnPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    }

    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  const links = useMemo<WorkspaceLink[]>(() => {
    const base: WorkspaceLink[] = [
      { href: "/dashboard", label: "Dashboard", matchPrefixes: ["/dashboard"] },
    ];

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
      <div className="workspace-shell min-h-screen">
        <a className="skip-link" href="#workspace-content">
          Skip to workspace content
        </a>
        <header className="workspace-header" ref={headerRef}>
          <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-5 md:px-10">
            <BrandMark focused />
            <div className="flex items-center gap-2">
              <Link
                href={focusedNavigation.exitHref}
                aria-label={focusedNavigation.exitLabel}
                className="workspace-action-link"
              >
                <span className="hidden sm:inline">{focusedNavigation.exitLabel}</span>
                <span className="sm:hidden" aria-hidden="true">Exit</span>
                <WorkspaceLinkStatus label={focusedNavigation.exitLabel} />
              </Link>
              {focusedNavigation.showMyReports ? (
                <Link href="/reports/current" className="workspace-action-link hidden md:inline-flex">
                  <span>My Reports</span>
                  <WorkspaceLinkStatus label="My Reports" />
                </Link>
              ) : null}
              <ProfileMenu role={role} email={email} />
            </div>
          </div>
        </header>
        <div id="workspace-content" tabIndex={-1}>{children}</div>
      </div>
    );
  }

  return (
    <div className="workspace-shell min-h-screen">
      <WorkspaceRouteWarmer role={role} />
      <a className="skip-link" href="#workspace-content">
        Skip to workspace content
      </a>
      <header
        className="workspace-header"
        ref={headerRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setMobileOpen(false);
          }
        }}
      >
        <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-5 md:px-10">
          <BrandMark />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Workspace">
            {links.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                active={isActiveLink(pathname, item)}
              />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              ref={menuButtonRef}
              aria-controls={mobileMenuId}
              aria-expanded={mobileOpen}
              className="workspace-menu-button lg:hidden"
              onClick={() => setMobileOpen((previous) => !previous)}
              type="button"
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
            <ProfileMenu role={role} email={email} />
          </div>
        </div>

        {mobileOpen ? (
          <nav
            id={mobileMenuId}
            aria-label="Workspace mobile"
            className="max-h-[calc(100svh-4.5rem)] overflow-y-auto overscroll-contain border-t border-ink/12 bg-[var(--paper)] px-5 py-3 lg:hidden"
          >
            <div className="mx-auto grid max-w-7xl gap-1">
              {links.map((item) => (
                <NavigationLink
                  key={item.href}
                  item={item}
                  active={isActiveLink(pathname, item)}
                  mobile
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <div id="workspace-content" tabIndex={-1}>{children}</div>
    </div>
  );
}
