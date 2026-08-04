import type { ReactNode } from "react";
import PublicHeader from "@/components/navigation/PublicHeader";
import ScrollMotion from "@/components/effects/ScrollMotion";
import MarketingEffects from "@/components/marketing/MarketingEffects";
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
    <div className="relative min-h-screen bg-cream text-ink">
      <MarketingEffects />
      <a className="skip-link" href="#marketing-content">
        Skip to content
      </a>
      <PublicHeader />

      <main id="marketing-content" tabIndex={-1}>
        <ScrollMotion className="marketing-chrome-motion">
          <section className="marketing-chrome-hero relative mx-auto max-w-7xl overflow-hidden px-6 pt-24 pb-24 md:px-10 md:pt-32 md:pb-32">
            <div
              className="marketing-chrome-spectrum-motion"
              data-scroll-layer="far"
              aria-hidden
            >
              <div className="marketing-chrome-spectrum">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="relative z-[2]">
              <div className="reveal">
                <Eyebrow>{eyebrow}</Eyebrow>
              </div>
              <HeroTitle title={title} />
              <p className="reveal reveal-delay-2 mt-10 max-w-2xl text-base leading-relaxed text-ink/72 md:text-lg">
                {description}
              </p>
            </div>
          </section>
        </ScrollMotion>

        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="border-t border-ink/12" />
        </div>

        <section className="mx-auto max-w-7xl px-6 py-24 md:px-10 md:py-32">
          {children}
        </section>

        {tail}
      </main>

      <EditorialFooter />
    </div>
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
      <span className="hero-word-rise" aria-hidden>
        {words.map((word, i) => {
          const isLast = i === words.length - 1;
          return (
            <span
              className="hero-word-clip"
              key={`${word}-${i}`}
              style={{
                marginRight: isLast ? 0 : "0.28em",
              }}
            >
              <span
                className="hero-word"
                data-direction={i % 3 === 1 ? "down" : "up"}
                style={{ animationDelay: `${0.12 + i * 0.055}s` }}
              >
                {word}
              </span>
            </span>
          );
        })}
      </span>
      {trailing ? (
        <span
          aria-hidden
          className="brass-period word-rise-period inline-block"
          style={{
            animationDelay: `${periodDelay}s`,
          }}
        >
          {trailing}
        </span>
      ) : null}
    </h1>
  );
}
