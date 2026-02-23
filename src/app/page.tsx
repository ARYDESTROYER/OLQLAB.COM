import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-semibold">PersonaPilot</h1>
        <p className="mt-3 text-slate-700">Invite-only corporate personality assessment platform.</p>
        <Link className="mt-6 inline-block rounded bg-slate-900 px-4 py-2 text-white" href="/signin">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Welcome, {session.user.email}</h1>
      <p className="mt-2 text-sm text-slate-600">Role: {session.user.role}</p>
      <div className="mt-6 flex gap-3">
        <Link className="rounded bg-slate-900 px-4 py-2 text-white" href="/admin">
          Admin
        </Link>
        <Link className="rounded bg-slate-900 px-4 py-2 text-white" href="/assessment/current">
          Take Assessment
        </Link>
      </div>
    </main>
  );
}
