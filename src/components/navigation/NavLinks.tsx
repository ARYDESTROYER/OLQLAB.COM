"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/framework", label: "Framework" },
  { href: "/assessments", label: "Assessments" },
  { href: "/contact", label: "Contact" },
];

/**
 * The four primary nav links, with the active page highlighted by a
 * persistent brass underline + full ink colour. Inactive links are muted
 * so the active one reads first.
 *
 * Implemented as a client component so it can read the pathname; the parent
 * `PublicHeader` is a server component and handles the session lookup.
 */
export default function NavLinks() {
  const pathname = usePathname() ?? "";

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
        {NAV.map((l) => {
          const isActive = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link key={l.href} href={l.href} aria-current={isActive ? "page" : undefined} data-active={isActive ? "true" : "false"} className="nav-link">
              {l.label}
            </Link>
          );
        })}
      </nav>
      <details className="group relative ml-auto md:hidden">
        <summary className="flex cursor-pointer list-none items-center rounded-lg border border-[#101114]/20 px-3 py-2 text-sm font-medium text-[#101114] marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <span className="group-open:hidden">Menu</span>
          <span className="hidden group-open:inline">Close</span>
        </summary>
        <nav aria-label="Mobile primary" className="absolute right-0 top-[calc(100%+0.75rem)] z-50 grid w-56 gap-1 rounded-xl border border-[#101114]/15 bg-[#F8F3E9] p-2 shadow-xl">
          {NAV.map((l) => {
            const isActive = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-[#101114] text-[#EFE8DA]" : "text-[#101114]/80 hover:bg-[#101114]/5"}`}
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
