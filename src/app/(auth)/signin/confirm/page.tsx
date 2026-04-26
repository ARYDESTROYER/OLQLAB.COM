import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { validateVerificationCallbackUrl } from "@/lib/magic-link-continue";
import PublicHeader from "@/components/navigation/PublicHeader";
import { EditorialFooter, Eyebrow } from "@/components/marketing/Editorial";

type ConfirmSignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function ConfirmSignInPage({ searchParams }: ConfirmSignInPageProps) {
  const session = await getServerAuthSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const rawTokenUrl = getSingleParam(params.tokenUrl);
  const rawEmail = getSingleParam(params.email).toLowerCase().trim();
  const validated = validateVerificationCallbackUrl(rawTokenUrl);

  if (!validated) {
    return (
      <main className="relative flex min-h-screen flex-col bg-[#EFE8DA] text-[#101114]">
        <PublicHeader />
        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pt-20 pb-24 md:px-10 md:pt-28 md:pb-32">
          <div className="reveal">
            <Eyebrow>Sign-in</Eyebrow>
            <h1 className="font-display mt-8 text-balance text-[clamp(2.25rem,6vw,4.5rem)] leading-[1] tracking-[-0.03em]">
              This sign-in link is invalid<span className="brass-period">.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-[#101114]/72 md:text-lg">
              The link can no longer be used. Request a fresh sign-in link to continue.
            </p>
            <div className="mt-12">
              <Link
                href="/signin"
                className="group inline-flex items-center gap-3 bg-[#101114] px-7 py-4 text-sm font-medium text-[#EFE8DA] transition-colors duration-300 hover:bg-[#1d1d20]"
              >
                <span>Back to sign-in</span>
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </section>
        <EditorialFooter />
      </main>
    );
  }

  const lookupEmail = rawEmail || validated.email;
  const user = await db.user.findUnique({
    where: { email: lookupEmail },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  const fullName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "there";

  return (
    <main className="relative flex min-h-screen flex-col bg-[#EFE8DA] text-[#101114]">
      <PublicHeader />

      <section className="mx-auto w-full max-w-7xl flex-1 px-6 pt-20 pb-24 md:px-10 md:pt-28 md:pb-32">
        <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
          <div className="reveal">
            <Eyebrow>One last step</Eyebrow>
            <h1 className="font-display mt-8 text-balance text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.96] tracking-[-0.03em]">
              Welcome back, {fullName}<span className="brass-period">.</span>
            </h1>
            <p className="mt-8 max-w-md text-base leading-relaxed text-[#101114]/72 md:text-lg">
              Click continue below to complete your secure sign-in.
            </p>
          </div>

          <div className="reveal reveal-delay-1">
            <form
              action="/api/auth/continue"
              method="post"
              className="border-t border-[#101114]/15 pt-8 md:pt-10"
            >
              <input type="hidden" name="tokenUrl" value={validated.absoluteUrl} />
              <button
                type="submit"
                className="group inline-flex items-center gap-3 bg-[#101114] px-7 py-4 text-sm font-medium text-[#EFE8DA] transition-colors duration-300 hover:bg-[#1d1d20]"
              >
                <span>Continue to sign-in</span>
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </button>
              <p className="mt-8 text-sm leading-relaxed text-[#101114]/64">
                Sign-in is completed only after pressing continue.
              </p>
            </form>
          </div>
        </div>
      </section>

      <EditorialFooter />
    </main>
  );
}
