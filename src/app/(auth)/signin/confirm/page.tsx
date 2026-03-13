import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { validateVerificationCallbackUrl } from "@/lib/magic-link-continue";

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
      <main className="mx-auto max-w-xl space-y-6 p-6 md:p-10">
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-rose-900">Sign-in link is invalid</h1>
          <p className="mt-3 text-sm text-rose-800">
            This sign-in link cannot be used. Please request a fresh sign-in link.
          </p>
          <div className="mt-6">
            <Link
              href="/signin"
              className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-900"
            >
              Back to Sign-in
            </Link>
          </div>
        </section>
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
    <main className="mx-auto max-w-xl space-y-6 p-6 md:p-10">
      <section className="rounded-3xl bg-gradient-to-r from-amber-100 via-orange-50 to-cyan-100 p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to OLQLab, {fullName}</h1>
        <p className="mt-3 text-sm text-slate-700">
          Click continue below to complete your secure sign-in.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <form action="/api/auth/continue" method="post" className="space-y-4">
          <input type="hidden" name="tokenUrl" value={validated.absoluteUrl} />
          <button className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white" type="submit">
            Continue to Sign-in
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Sign-in is completed only after pressing Continue.
        </p>
      </section>
    </main>
  );
}
