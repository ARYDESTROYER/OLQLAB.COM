"use client";

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
    <section className="mx-auto max-w-7xl px-6 pt-20 pb-24 md:px-10 md:pt-28 md:pb-32">
      <div className="grid gap-14 md:grid-cols-[5fr_7fr] md:gap-20">
        <div className="reveal">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#0B0B0C]/55">
            Sign in
          </p>
          <h1 className="font-display mt-8 text-balance text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.96] tracking-[-0.03em]">
            Welcome back.
          </h1>
          <p className="mt-8 max-w-md text-base leading-relaxed text-[#0B0B0C]/72 md:text-lg">
            Enter your work email. We&rsquo;ll send a one-time link to sign you in safely.
          </p>
        </div>

        <div className="reveal reveal-delay-1">
          <form onSubmit={onSubmit} className="border-t border-[#0B0B0C]/15 pt-8 md:pt-10">
            <label
              htmlFor="email"
              className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#0B0B0C]/55"
            >
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state === "sending" || state === "sent"}
              className="font-display mt-3 w-full border-b border-[#0B0B0C]/30 bg-transparent pb-3 text-2xl tracking-tight text-[#0B0B0C] placeholder:text-[#0B0B0C]/30 outline-none transition-colors duration-300 focus:border-[#0B0B0C] disabled:opacity-60 md:text-3xl"
            />

            <button
              type="submit"
              disabled={state === "sending" || state === "sent"}
              className="group mt-10 inline-flex items-center gap-3 bg-[#0B0B0C] px-7 py-4 text-sm font-medium text-[#F4F1EA] transition-colors duration-300 hover:bg-[#1d1d20] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{state === "sending" ? "Sending..." : "Send sign-in link"}</span>
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </button>

            {state === "sent" && (
              <p className="mt-8 border-l border-[#0B0B0C] pl-5 font-display text-xl leading-snug tracking-tight">
                Check your inbox. A sign-in link is on its way.
              </p>
            )}
            {state === "error" && (
              <p className="mt-8 border-l border-[#0B0B0C] pl-5 text-base leading-relaxed text-[#0B0B0C]/82">
                We couldn&rsquo;t send the sign-in link. Confirm your email is invited and try
                again.
              </p>
            )}

            <p className="mt-12 text-sm leading-relaxed text-[#0B0B0C]/64">
              Not invited yet?{" "}
              <a
                href="/contact"
                className="link-underline text-[#0B0B0C] transition-colors hover:text-[#0B0B0C]"
              >
                Get in touch
              </a>
              .
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
