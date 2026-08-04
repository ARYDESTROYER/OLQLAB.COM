import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

const footerPathways = [
  {
    code: "01 / SEE",
    title: "See my pattern",
    detail: "Explore the assessment paths.",
    href: "/assessments",
    tone: "cognitive",
  },
  {
    code: "02 / UNDERSTAND",
    title: "Understand the model",
    detail: "Read the CPR framework.",
    href: "/framework",
    tone: "personality",
  },
  {
    code: "03 / NOTICE",
    title: "Work a blindspot",
    detail: "Surface what is hard to see alone.",
    href: "/blindspot",
    tone: "response",
  },
  {
    code: "04 / BEGIN",
    title: "Start a conversation",
    detail: "Shape the right starting point together.",
    href: "/contact",
    tone: "ink",
  },
] as const;

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
  const toneClass = tone === "light" ? "text-cream/65" : "text-ink/65";
  return (
    <p
      className={`text-[11px] font-medium uppercase tracking-[0.28em] ${toneClass} ${className}`}
    >
      {withDot && (
        <span
          className="brass-dot"
          style={
            tone === "light" ? { background: "var(--brass-soft)" } : undefined
          }
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
            className="font-display text-3xl tracking-tight text-ink/82 md:text-5xl"
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
      <div className="border-t border-ink/12" />
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
      className={`group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-cream transition-colors duration-300 hover:bg-[var(--ink-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-light)] ${className}`}
    >
      <span className="cta-exchange-label">{children}</span>
      <span aria-hidden className="cta-arrow-exchange">
        <span>→</span>
        <span>→</span>
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
      className={`group inline-flex items-center gap-3 rounded-full border border-ink/30 bg-transparent px-7 py-3.5 text-sm font-medium text-ink transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-cream focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-light)] ${className}`}
    >
      <span className="cta-exchange-label">{children}</span>
      <span aria-hidden className="cta-arrow-exchange">
        <span>→</span>
        <span>→</span>
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
      className={`group inline-flex items-center gap-3 rounded-full border border-cream/80 px-7 py-3.5 text-sm font-medium text-cream transition-colors duration-300 hover:bg-cream hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-dark)] ${className}`}
    >
      <span className="cta-exchange-label">{children}</span>
      <span aria-hidden className="cta-arrow-exchange">
        <span>→</span>
        <span>→</span>
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
      className={`text-sm font-medium text-ink/80 underline decoration-ink/30 underline-offset-[6px] transition-colors duration-300 hover:text-ink hover:decoration-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-light)] ${className}`}
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
      className={`text-sm font-medium text-ink/80 underline decoration-ink/30 underline-offset-[6px] transition-colors duration-300 hover:text-ink hover:decoration-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-light)] ${className}`}
    >
      {children}
    </a>
  );
}

export function EditorialFooter() {
  return (
    <footer className="border-t border-ink/12">
      <nav
        className="footer-pathway"
        aria-label="Explore OLQ Lab by what you need"
        data-reveal-parts
      >
        <div className="footer-pathway__intro">
          <p>START WHERE YOU ARE</p>
          <h2>Choose your next move.</h2>
        </div>
        <ol className="footer-pathway__list">
          {footerPathways.map((pathway) => (
            <li
              className="footer-pathway__item"
              data-tone={pathway.tone}
              key={pathway.href}
            >
              <Link href={pathway.href}>
                <span className="footer-pathway__code">{pathway.code}</span>
                <span className="footer-pathway__title">{pathway.title}</span>
                <span className="footer-pathway__detail">{pathway.detail}</span>
                <span className="footer-pathway__arrow" aria-hidden>
                  ↗
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
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
              <span className="font-display text-2xl tracking-tight text-ink">
                OLQLAB
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink/64">
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
              { label: "Work in practice", href: "/work" },
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
        <div className="mt-16 flex flex-col gap-2 border-t border-ink/12 pt-8 text-xs text-ink/65 md:flex-row md:justify-between">
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
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink/65">
        {title}
      </h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="link-underline text-sm text-ink/80 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-light)]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
