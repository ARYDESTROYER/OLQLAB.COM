"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await signIn("email", {
      email,
      redirect: false,
      callbackUrl: "/dashboard",
    });
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6 md:p-10">
      <section className="rounded-3xl bg-gradient-to-r from-amber-100 via-orange-50 to-cyan-100 p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">OLQLAB Secure Sign-in</h1>
            <p className="mt-2 text-sm text-slate-700">Enter your work email. We will send a one-time magic link.</p>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Back to Landing
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-3"
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
            disabled={state === "sending"}
          >
            {state === "sending" ? "Sending..." : "Send Magic Link"}
          </button>
        </form>

        {state === "sent" && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            Check your inbox for the sign-in link.
          </p>
        )}
        {state === "error" && (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            Could not send sign-in link. Confirm your email is invited.
          </p>
        )}
      </section>
    </main>
  );
}
