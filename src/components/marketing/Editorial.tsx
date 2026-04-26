import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[11px] font-medium uppercase tracking-[0.28em] text-[#0B0B0C]/55 ${className}`}
    >
      {children}
    </p>
  );
}

export function Rule({ className = "" }: { className?: string }) {
  return (
    <div className={`mx-auto max-w-7xl px-6 md:px-10 ${className}`}>
      <div className="border-t border-[#0B0B0C]/12" />
    </div>
  );
}

export function PrimaryCTA({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 bg-[#0B0B0C] px-7 py-4 text-sm font-medium text-[#F4F1EA] transition-colors duration-300 hover:bg-[#1d1d20] ${className}`}
    >
      <span>{children}</span>
      <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

export function SecondaryCTA({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 border border-[#0B0B0C]/85 px-7 py-4 text-sm font-medium text-[#0B0B0C] transition-colors duration-300 hover:bg-[#0B0B0C] hover:text-[#F4F1EA] ${className}`}
    >
      <span>{children}</span>
      <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

export function GhostCTA({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 border border-[#F4F1EA]/80 px-7 py-4 text-sm font-medium text-[#F4F1EA] transition-colors duration-300 hover:bg-[#F4F1EA] hover:text-[#0B0B0C] ${className}`}
    >
      <span>{children}</span>
      <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

export function TextLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`text-sm font-medium text-[#0B0B0C]/80 underline underline-offset-[6px] decoration-[#0B0B0C]/30 transition-colors duration-300 hover:text-[#0B0B0C] hover:decoration-[#0B0B0C] ${className}`}
    >
      {children}
    </Link>
  );
}

export function MailLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`text-sm font-medium text-[#0B0B0C]/80 underline underline-offset-[6px] decoration-[#0B0B0C]/30 transition-colors duration-300 hover:text-[#0B0B0C] hover:decoration-[#0B0B0C] ${className}`}
    >
      {children}
    </a>
  );
}

export function EditorialFooter() {
  return (
    <footer className="border-t border-[#0B0B0C]/12">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt=""
                width={32}
                height={32}
                className="rounded-full opacity-90"
              />
              <span className="font-display text-2xl tracking-tight text-[#0B0B0C]">OLQLAB</span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#0B0B0C]/64">
              Leadership begins within.
            </p>
          </div>
          <FooterColumn
            title="About"
            links={[
              { label: "Our approach", href: "/about" },
              { label: "CPR framework", href: "/framework" },
              { label: "OLQ foundations", href: "/oql" },
            ]}
          />
          <FooterColumn
            title="Practice"
            links={[
              { label: "Assessments", href: "/assessments" },
              { label: "Coaching", href: "/coaching" },
              { label: "Blindspot work", href: "/blindspot" },
            ]}
          />
          <FooterColumn
            title="Contact"
            links={[
              { label: "Get in touch", href: "/contact" },
              { label: "Sign in", href: "/signin" },
            ]}
          />
        </div>
        <div className="mt-16 flex flex-col gap-2 border-t border-[#0B0B0C]/12 pt-8 text-xs text-[#0B0B0C]/55 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} OLQLab. All rights reserved.</p>
          <p>Leadership begins within.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0B0B0C]/55">
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="link-underline text-sm text-[#0B0B0C]/80 transition-colors hover:text-[#0B0B0C]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
