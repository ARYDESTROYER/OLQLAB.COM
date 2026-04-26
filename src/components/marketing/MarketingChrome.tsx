import type { ReactNode } from "react";
import PublicHeader from "@/components/navigation/PublicHeader";
import { EditorialFooter, Eyebrow } from "@/components/marketing/Editorial";

export function MarketingChrome({
  title,
  description,
  eyebrow = "OLQLAB",
  children,
  tail,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
  /**
   * Optional full-bleed slot rendered after the body content and before the
   * footer. Use for dark CTA bands or any block that should span the full
   * viewport width.
   */
  tail?: ReactNode;
}) {
  return (
    <main className="relative min-h-screen bg-[#EFE8DA] text-[#101114]">
      <PublicHeader />

      <section className="relative mx-auto max-w-7xl px-6 pt-24 pb-24 md:px-10 md:pt-32 md:pb-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 92% 110%, rgba(166,130,74,0.08), transparent 55%)",
          }}
        />
        <div className="relative">
          <div className="reveal">
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
          <HeroTitle title={title} />
          <p className="reveal reveal-delay-2 mt-10 max-w-2xl text-base leading-relaxed text-[#101114]/72 md:text-lg">
            {description}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="border-t border-[#101114]/12" />
      </div>

      <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">{children}</section>

      {tail}

      <EditorialFooter />
    </main>
  );
}

function HeroTitle({ title }: { title: string }) {
  const match = title.match(/^(.*?)([.!?]+)$/);
  const stem = match ? match[1] : title;
  const trailing = match ? match[2] : "";
  const words = stem.split(/\s+/).filter(Boolean);
  const periodDelay = 0.18 + words.length * 0.07 + 0.18;

  return (
    <h1
      aria-label={title}
      className="font-display mt-10 max-w-5xl text-balance text-[clamp(2.5rem,7.5vw,7rem)] leading-[0.96] tracking-[-0.03em]"
    >
      <span className="word-rise" aria-hidden>
        {words.map((word, i) => (
          <span key={`${word}-${i}`}>
            <span
              style={{ animationDelay: `${0.18 + i * 0.07}s` }}
              className="inline-block"
            >
              {word}
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
      {trailing ? (
        <span
          aria-hidden
          className="brass-period inline-block"
          style={{
            opacity: 0,
            animation: `reveal-fade 700ms cubic-bezier(0.2, 0.7, 0.1, 1) ${periodDelay}s forwards`,
          }}
        >
          {trailing}
        </span>
      ) : null}
    </h1>
  );
}
