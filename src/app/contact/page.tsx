import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import {
  Eyebrow,
  PrimaryCTA,
  SecondaryCTA,
  MailLink,
} from "@/components/marketing/Editorial";

export default function ContactPage() {
  return (
    <MarketingChrome
      eyebrow="Contact"
      title="Let’s have an honest conversation."
      description="Share your team size, goals, and timeline. We will recommend the right diagnostic and coaching track."
    >
      {/* CONSULTATION */}
      <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
        <div className="reveal-on-scroll">
          <Eyebrow>Consultation</Eyebrow>
          <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
            For enterprise programs.
          </h2>
        </div>
        <div>
          <p className="reveal-on-scroll text-base leading-relaxed text-[#0B0B0C]/82 md:text-lg">
            Include cohort size, leadership levels, and the timeline you want to run.
            We will recommend the right diagnostic and coaching track.
          </p>
          <div className="reveal-on-scroll mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
            <PrimaryCTA href="mailto:hello@olqlab.com?subject=OLQLAB%20Consultation">
              Email the team
            </PrimaryCTA>
            <MailLink href="mailto:hello@olqlab.com">hello@olqlab.com</MailLink>
          </div>
        </div>
      </div>

      <div className="mt-32 md:mt-40">
        <div className="border-t border-[#0B0B0C]/12" />
      </div>

      {/* EXISTING CLIENTS */}
      <div className="mt-32 md:mt-40">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal-on-scroll">
            <Eyebrow>Existing clients</Eyebrow>
            <h2 className="font-display mt-6 text-balance text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.04] tracking-[-0.025em]">
              Already enrolled?
            </h2>
          </div>
          <div>
            <p className="reveal-on-scroll text-base leading-relaxed text-[#0B0B0C]/82 md:text-lg">
              Access your workspace, assessments, and reports directly.
            </p>
            <div className="reveal-on-scroll mt-12">
              <SecondaryCTA href="/signin">Client sign in</SecondaryCTA>
            </div>
          </div>
        </div>
      </div>
    </MarketingChrome>
  );
}
