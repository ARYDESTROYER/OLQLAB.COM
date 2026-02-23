"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const res = await signIn("email", { email, redirect: false, callbackUrl: "/" });
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2"
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          disabled={state === "sending"}
        >
          {state === "sending" ? "Sending..." : "Send magic link"}
        </button>
      </form>
      {state === "sent" && <p className="mt-4 text-sm text-emerald-700">Check your email for the sign-in link.</p>}
      {state === "error" && <p className="mt-4 text-sm text-red-700">Could not send sign-in link.</p>}
    </main>
  );
}
