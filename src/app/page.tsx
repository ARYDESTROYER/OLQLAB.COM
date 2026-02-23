import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-4xl space-y-8 p-6 md:p-10">
        <section className="rounded-3xl bg-gradient-to-r from-amber-100 via-orange-50 to-cyan-100 p-8">
          <h1 className="text-4xl font-semibold tracking-tight">PersonaPilot</h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            Personality and scenario-based development assessments for corporate teams.
          </p>
          <Link className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 font-medium text-white" href="/signin">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <section className="rounded-3xl bg-gradient-to-r from-cyan-100 via-sky-50 to-lime-100 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome, {session.user.email}</h1>
        <p className="mt-2 text-sm text-slate-700">Role: {session.user.role}</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Link className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400" href="/assessment/current">
          <h2 className="text-lg font-semibold">Take Assessment</h2>
          <p className="mt-1 text-sm text-slate-600">Complete the active personality and scenario quiz.</p>
        </Link>

        <Link className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400" href="/admin">
          <h2 className="text-lg font-semibold">Admin Studio</h2>
          <p className="mt-1 text-sm text-slate-600">Manage clients, import employees, build and publish assessments.</p>
        </Link>
      </section>
    </main>
  );
}
