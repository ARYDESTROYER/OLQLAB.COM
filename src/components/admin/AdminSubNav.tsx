"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  matchPrefix: string;
  exact: boolean;
};

/**
 * Editorial sub-nav rail for the /admin tree. Renders each section as a
 * small chip with a brass dot for the active page.
 */
export default function AdminSubNav({ links }: { links: Item[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Admin sections"
      className="mt-10 flex flex-wrap items-center gap-2 border-t border-[#101114]/12 pt-6"
    >
      {links.map((item) => {
        const isActive = item.exact
          ? pathname === item.matchPrefix
          : pathname === item.matchPrefix || pathname.startsWith(item.matchPrefix + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] transition-colors duration-200 ${
              isActive
                ? "border-[#B5803C]/55 bg-[#F4EEE0] text-[#101114]"
                : "border-[#101114]/15 bg-[#F4EEE0]/40 text-[#101114]/68 hover:border-[#B5803C]/40 hover:text-[#101114]"
            }`}
          >
            {isActive && <span className="brass-dot" aria-hidden />}
            <span>{item.label}</span>
          </Link>
        );
      })}
      <span className="ml-auto">
        <Link
          href="/dashboard"
          className="link-underline text-sm font-medium text-[#101114]/68 transition-colors duration-200 hover:text-[#101114]"
        >
          Dashboard
        </Link>
      </span>
    </nav>
  );
}
