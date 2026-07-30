import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Terms",
  description: "Terms for authorised use of the OLQ Lab website, assessments, and reports.",
  path: "/terms",
});

const sectionClassName = "border-t border-[#101114]/12 pt-10";
const headingClassName = "font-display text-3xl tracking-[-0.02em] md:text-4xl";
const bodyClassName = "mt-5 space-y-4 text-base leading-relaxed text-[#101114]/75";

export default function TermsPage() {
  return (
    <MarketingChrome
      eyebrow="Legal"
      title="Terms of use."
      description="These terms set expectations for using OLQ Lab's website, assessments, and reports."
    >
      <div className="max-w-3xl space-y-14">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#101114]/55">
          Last updated 30 July 2026
        </p>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Authorised access</h2>
          <div className={bodyClassName}>
            <p>
              Assessment and report areas are available only to people who have been given access
              by OLQ Lab or an authorised Organisation. Keep magic links, authenticated sessions,
              and report-share links private. Do not use another person&apos;s identity or access.
            </p>
            <p>
              You are responsible for providing accurate information and for using the service in
              accordance with applicable workplace policies and law.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Assessment and report context</h2>
          <div className={bodyClassName}>
            <p>
              OLQ Lab assessments and reports are development tools. They are not medical,
              clinical, or diagnostic services, and results should be interpreted alongside role
              context, observed behaviour, and informed human judgement.
            </p>
            <p>
              Reports may combine calculated assessment signals, rule-based narrative,
              AI-assisted narrative, and authorised administrator edits or uploaded PDFs. Output
              can contain errors or require context; it should not be treated as the sole basis for
              a significant employment or personal decision.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Acceptable use</h2>
          <div className={bodyClassName}>
            <p>
              Do not attempt to bypass access controls, probe another participant&apos;s records,
              automate unsolicited email, interfere with service availability, upload malicious
              content, scrape protected assessment material, or reverse engineer restricted
              functionality except where applicable law expressly permits it.
            </p>
            <p>
              OLQ Lab may restrict access when reasonably necessary to protect participants,
              Organisations, the service, or assessment integrity.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Content and intellectual property</h2>
          <div className={bodyClassName}>
            <p>
              The service, assessment content, report formats, branding, and supporting materials
              belong to their respective owners. Access does not grant permission to republish,
              resell, or distribute protected content or another person&apos;s report.
            </p>
            <p>
              You retain responsibility for content you submit and confirm that you are authorised
              to provide it for the relevant assessment or support purpose.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Availability and changes</h2>
          <div className={bodyClassName}>
            <p>
              The service may change as assessment programmes and operational requirements evolve.
              Interruptions can occur for maintenance, provider incidents, or security reasons. No
              website or automated report can be guaranteed to be continuously available or
              error-free.
            </p>
            <p>
              Material changes to these terms will be reflected by updating this page and its
              revision date. Continued authorised use after an update is subject to the revised
              terms.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Privacy and contact</h2>
          <div className={bodyClassName}>
            <p>
              The <Link className="underline underline-offset-4" href="/privacy">privacy notice</Link>{" "}
              explains how information is handled. Questions about these terms can be sent to{" "}
              <a className="underline underline-offset-4" href="mailto:hello@olqlab.com">hello@olqlab.com</a>{" "}
              or through the <Link className="underline underline-offset-4" href="/contact">contact page</Link>.
            </p>
          </div>
        </section>
      </div>
    </MarketingChrome>
  );
}
