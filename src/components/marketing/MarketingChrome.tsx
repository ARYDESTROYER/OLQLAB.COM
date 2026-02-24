import Link from "next/link";
import type { ReactNode } from "react";
import PublicHeader from "@/components/navigation/PublicHeader";

export function MarketingChrome({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative overflow-hidden pb-20">
      <div className="ambient-orb animate-aurora-one -top-40 left-[-140px] h-[460px] w-[460px] bg-cyan-300/60" />
      <div className="ambient-orb animate-aurora-two -right-24 top-24 h-[420px] w-[420px] bg-amber-200/70" />
      <div className="ambient-orb animate-aurora-three bottom-14 left-1/3 h-[360px] w-[360px] bg-emerald-200/45" />

      <PublicHeader />

      <section className="mx-auto mt-10 max-w-7xl px-6 md:px-10">
        <div className="section-frame glass-panel rounded-[2rem] p-8 md:p-12">
          <p className="hero-chip">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
            OLQLAB Resources
          </p>
          <h1 className="font-display mt-5 text-4xl leading-tight text-slate-900 md:text-6xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-700 md:text-base">{description}</p>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-7xl px-6 md:px-10">{children}</section>

      <footer className="mx-auto mt-16 max-w-7xl px-6 md:px-10">
        <div className="section-frame glass-panel rounded-[2rem] p-7 md:p-10">
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">About</h4>
              <div className="mt-3 space-y-2">
                <Link href="/about" className="block text-sm text-slate-600 hover:text-slate-900">Our Approach</Link>
                <Link href="/framework" className="block text-sm text-slate-600 hover:text-slate-900">CPR Framework</Link>
                <Link href="/oql" className="block text-sm text-slate-600 hover:text-slate-900">OLQ Foundations</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Services</h4>
              <div className="mt-3 space-y-2">
                <Link href="/assessments" className="block text-sm text-slate-600 hover:text-slate-900">Assessments</Link>
                <Link href="/coaching" className="block text-sm text-slate-600 hover:text-slate-900">Coaching</Link>
                <Link href="/blindspot" className="block text-sm text-slate-600 hover:text-slate-900">Blindspot Assessment</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Resources</h4>
              <div className="mt-3 space-y-2">
                <Link href="/framework" className="block text-sm text-slate-600 hover:text-slate-900">Framework Notes</Link>
                <Link href="/contact" className="block text-sm text-slate-600 hover:text-slate-900">Contact</Link>
                <Link href="/assessments" className="block text-sm text-slate-600 hover:text-slate-900">Offerings</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Connect</h4>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Have questions? We are here to support your leadership journey.
              </p>
            </div>
          </div>

          <div className="mt-7 border-t border-slate-200 pt-7">
            <p className="text-center text-sm text-slate-600">&copy; 2026 OLQLab. All rights reserved.</p>
            <p className="mt-2 text-center text-sm text-slate-500">Leadership begins within.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
