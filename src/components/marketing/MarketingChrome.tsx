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
    <main className="relative min-h-screen bg-[#F4F1EA] text-[#0B0B0C]">
      <PublicHeader />

      <section className="mx-auto max-w-7xl px-6 pt-20 pb-20 md:px-10 md:pt-28 md:pb-28">
        <div className="reveal">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <h1 className="font-display reveal reveal-delay-1 mt-8 max-w-5xl text-balance text-[clamp(2.5rem,7.5vw,7rem)] leading-[0.96] tracking-[-0.03em]">
          {title}
        </h1>
        <p className="reveal reveal-delay-2 mt-8 max-w-2xl text-base leading-relaxed text-[#0B0B0C]/72 md:text-lg">
          {description}
        </p>
      </section>

      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="border-t border-[#0B0B0C]/12" />
      </div>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">{children}</section>

      {tail}

      <EditorialFooter />
    </main>
  );
}
