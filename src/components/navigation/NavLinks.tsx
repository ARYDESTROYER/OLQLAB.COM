"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const PUBLIC_NAV_ITEMS = [
  { href: "/about", label: "About" },
  { href: "/framework", label: "Framework" },
  { href: "/assessments", label: "Assessments" },
  { href: "/work", label: "Work in practice" },
  { href: "/blindspot", label: "Blindspot Work" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * The six primary nav links, with the active page highlighted by a
 * persistent brass underline + full ink colour. Inactive links are muted
 * so the active one reads first.
 *
 * Implemented as a client component so it can read the pathname; the parent
 * `PublicHeader` stays static while its separate auth slot hydrates session
 * state client-side.
 */
export default function NavLinks() {
  const pathname = usePathname() ?? "";

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden items-center gap-5 lg:flex xl:gap-8"
      >
        {PUBLIC_NAV_ITEMS.map((l) => {
          const isActive = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link key={l.href} href={l.href} aria-current={isActive ? "page" : undefined} data-active={isActive ? "true" : "false"} className="nav-link">
              {l.label}
            </Link>
          );
        })}
      </nav>
      <details className="group relative ml-auto lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-ink/20 px-3 py-2 text-sm font-medium text-ink marker:hidden focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--focus-light)]">
          <span className="group-open:hidden">Menu</span>
          <span className="hidden group-open:inline">Close</span>
        </summary>
        <nav
          aria-label="Mobile primary"
          className="absolute right-0 top-[calc(100%+0.75rem)] z-50 grid max-h-[calc(100svh-6rem)] w-56 gap-1 overflow-y-auto overscroll-contain rounded-xl border border-ink/15 bg-paper p-2 shadow-xl"
        >
          {PUBLIC_NAV_ITEMS.map((l) => {
            const isActive = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--focus-light)] ${isActive ? "bg-ink text-cream" : "text-ink/80 hover:bg-ink/5"}`}
                onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </details>
    </>
  );
}
