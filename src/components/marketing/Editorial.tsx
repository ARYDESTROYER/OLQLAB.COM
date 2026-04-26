import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function Eyebrow({
  children,
  className = "",
  withDot = true,
  tone = "dark",
}: {
  children: ReactNode;
  className?: string;
  withDot?: boolean;
  tone?: "dark" | "light";
}) {
  const toneClass =
    tone === "light" ? "text-[#EFE8DA]/55" : "text-[#101114]/55";
  return (
    <p
      className={`text-[11px] font-medium uppercase tracking-[0.28em] ${toneClass} ${className}`}
    >
      {withDot && (
        <span
          className="brass-dot"
          style={tone === "light" ? { background: "#C9A777" } : undefined}
          aria-hidden
        />
      )}
      {children}
    </p>
  );
}

/**
 * Display headline that animates word-by-word on first paint. Splits the text
 * on whitespace and assigns staggered animation-delays.
 */
export function WordReveal({
  children,
  className = "",
  startDelay = 0.15,
  step = 0.08,
}: {
  children: string;
  className?: string;
  startDelay?: number;
  step?: number;
}) {
  const words = children.split(/(\s+)/);
  return (
    <span className={`word-rise ${className}`}>
      {words.map((w, i) => {
        if (/^\s+$/.test(w)) return <span key={i}>{w}</span>;
        const delay = startDelay + Math.floor(i / 2) * step;
        return (
          <span
            key={i}
            style={{ animationDelay: `${delay}s` }}
            className="inline-block"
          >
            {w}
          </span>
        );
      })}
    </span>
  );
}

/** A brass dot inline for decorative use in body copy. */
export function BrassDot() {
  return <span className="brass-dot" aria-hidden />;
}

/** A scrolling band of pill-style labels for atmospheric texture. */
export function Marquee({ items }: { items: string[] }) {
  // Render twice for seamless loop
  const track = [...items, ...items];
  return (
    <div className="marquee py-10 md:py-14">
      <div className="marquee-track">
        {track.map((item, i) => (
          <span
            key={i}
            className="font-display text-3xl tracking-tight text-[#101114]/82 md:text-5xl"
          >
            {item}
            <span className="brass-dot ml-12 mr-0 align-middle" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Animated chevron + label nudging the visitor to scroll. */
export function ScrollCue({ children = "Scroll" }: { children?: ReactNode }) {
  return (
    <span className="scroll-cue">
      <span>{children}</span>
      <span className="scroll-cue__line" aria-hidden />
    </span>
  );
}

export function Rule({ className = "" }: { className?: string }) {
  return (
    <div className={`mx-auto max-w-7xl px-6 md:px-10 ${className}`}>
      <div className="border-t border-[#101114]/12" />
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
      className={`group inline-flex items-center gap-3 bg-[#101114] px-7 py-4 text-sm font-medium text-[#EFE8DA] transition-colors duration-300 hover:bg-[#1d1d20] ${className}`}
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
      className={`group inline-flex items-center gap-3 border border-[#101114]/85 px-7 py-4 text-sm font-medium text-[#101114] transition-colors duration-300 hover:bg-[#101114] hover:text-[#EFE8DA] ${className}`}
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
      className={`group inline-flex items-center gap-3 border border-[#EFE8DA]/80 px-7 py-4 text-sm font-medium text-[#EFE8DA] transition-colors duration-300 hover:bg-[#EFE8DA] hover:text-[#101114] ${className}`}
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
      className={`text-sm font-medium text-[#101114]/80 underline underline-offset-[6px] decoration-[#101114]/30 transition-colors duration-300 hover:text-[#101114] hover:decoration-[#101114] ${className}`}
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
      className={`text-sm font-medium text-[#101114]/80 underline underline-offset-[6px] decoration-[#101114]/30 transition-colors duration-300 hover:text-[#101114] hover:decoration-[#101114] ${className}`}
    >
      {children}
    </a>
  );
}

export function EditorialFooter() {
  return (
    <footer className="border-t border-[#101114]/12">
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
              <span className="font-display text-2xl tracking-tight text-[#101114]">OLQLAB</span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#101114]/64">
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
        <div className="mt-16 flex flex-col gap-2 border-t border-[#101114]/12 pt-8 text-xs text-[#101114]/55 md:flex-row md:justify-between">
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
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#101114]/55">
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="link-underline text-sm text-[#101114]/80 transition-colors hover:text-[#101114]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
