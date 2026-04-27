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
    <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
      {NAV.map((l) => {
        const isActive =
          pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive ? "page" : undefined}
            data-active={isActive ? "true" : "false"}
            className="nav-link"
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
