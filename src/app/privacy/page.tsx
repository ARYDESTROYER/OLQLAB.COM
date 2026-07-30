import Link from "next/link";
import { MarketingChrome } from "@/components/marketing/MarketingChrome";
import { createPageMetadata } from "@/lib/site-metadata";

export const metadata = createPageMetadata({
  title: "Privacy",
  description:
    "How OLQ Lab handles account, assessment, report, communications, and service-operation information.",
  path: "/privacy",
});

const sectionClassName = "border-t border-[#101114]/12 pt-10";
const headingClassName = "font-display text-3xl tracking-[-0.02em] md:text-4xl";
const bodyClassName = "mt-5 space-y-4 text-base leading-relaxed text-[#101114]/75";

export default function PrivacyPage() {
  return (
    <MarketingChrome
      eyebrow="Legal"
      title="Privacy, in plain language."
      description="This notice explains the information used to operate OLQ Lab's website, assessments, and reports."
    >
      <div className="max-w-3xl space-y-14">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#101114]/55">
          Last updated 30 July 2026
        </p>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Information we handle</h2>
          <div className={bodyClassName}>
            <p>
              Account and access information can include your name, work email, Organisation,
              role, manager relationship, invitation and sign-in records, and access settings.
            </p>
            <p>
              Assessment information can include selected responses, free-text responses,
              completion timing, calculated scores, generated or edited report narratives, and
              report PDF files. Contact messages contain the information you choose to send.
            </p>
            <p>
              Hosting and security systems may also process technical information such as IP
              address, browser and device details, requested URLs, timestamps, and error or audit
              events. Essential authentication and security cookies are used to sign users in and
              protect requests.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>How information is used</h2>
          <div className={bodyClassName}>
            <p>
              Information is used to authenticate users, manage assessment access, record and
              score responses, prepare and deliver reports, support authorised administrators and
              leaders, send service email, answer enquiries, maintain reliability, and investigate
              misuse or security incidents.
            </p>
            <p>
              Assessment output is intended for leadership development. Access to an assessment
              or report depends on the enrolment and report-access settings configured for the
              participant and their Organisation.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Report generation and service providers</h2>
          <div className={bodyClassName}>
            <p>
              Some report workflows use an AI service to draft development-focused narrative from
              assessment context and calculated signals. The current application can send a
              participant reference, assessment title, trait signals, and competency signals to
              OpenAI for that purpose. Reports may also be edited by an authorised administrator or
              supplied as a manual PDF.
            </p>
            <p>
              The application uses service providers to operate the product, including Vercel for
              hosting and managed file storage, Neon for the application database, Resend for
              transactional email, and OpenAI when AI-assisted report generation is enabled. These
              providers process information needed to perform their services and may operate from
              more than one country.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Who can receive information</h2>
          <div className={bodyClassName}>
            <p>
              Information can be available to the participant, authorised OLQ Lab personnel,
              authorised Organisation administrators or leaders, and the service providers
              described above. Report-share links can provide access without sign-in to anyone who
              possesses a valid, unexpired link, so recipients should not forward them.
            </p>
            <p>
              Information may also be preserved or disclosed when reasonably necessary to comply
              with applicable law, protect people or the service, or investigate suspected abuse.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Retention and choices</h2>
          <div className={bodyClassName}>
            <p>
              Information is retained for as long as needed to operate the service, provide the
              relevant assessment programme, maintain appropriate records, and meet applicable
              contractual or legal requirements. Different records and report-share tokens can have
              different lifetimes.
            </p>
            <p>
              To ask about your information, request a correction, or raise a privacy concern, use
              the contact details below. A sponsoring Organisation may need to participate in a
              request concerning an Organisation-managed assessment.
            </p>
          </div>
        </section>

        <section className={sectionClassName}>
          <h2 className={headingClassName}>Contact</h2>
          <div className={bodyClassName}>
            <p>
              Email <a className="underline underline-offset-4" href="mailto:hello@olqlab.com">hello@olqlab.com</a>{" "}
              or use the <Link className="underline underline-offset-4" href="/contact">contact page</Link>.
            </p>
          </div>
        </section>
      </div>
    </MarketingChrome>
  );
}
