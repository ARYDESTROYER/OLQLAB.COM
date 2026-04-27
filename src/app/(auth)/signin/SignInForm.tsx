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
    <section className="mx-auto w-full max-w-3xl px-6 pt-16 pb-24 text-center md:px-10 md:pt-24 md:pb-32">
      <div className="reveal">
        <h1 className="font-display text-balance text-[clamp(2.5rem,7vw,5rem)] leading-[0.96] tracking-[-0.03em]">
          Welcome back<span className="brass-period">.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-[#101114]/72 md:text-lg">
          Enter your work email. We&rsquo;ll send a one-time link to sign you in safely.
        </p>
      </div>

      <div className="reveal reveal-delay-1 mx-auto mt-12 max-w-lg">
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-[#B5803C]/55 bg-[#F4EEE0]/60 p-6 text-left md:p-8"
        >
          <label
            htmlFor="email"
            className="block text-[11px] font-medium uppercase tracking-[0.22em] text-[#101114]/55"
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
            className="mt-3 w-full rounded-md border border-[#B5803C]/65 bg-[#EFE8DA]/80 px-4 py-3.5 text-base text-[#101114] placeholder:text-[#101114]/35 outline-none transition-colors duration-200 focus:border-[#B5803C] focus:bg-[#EFE8DA] disabled:opacity-60 md:text-lg"
          />

          <button
            type="submit"
            disabled={state === "sending" || state === "sent"}
            className="cta-shimmer group mt-5 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#B5803C] px-7 py-3.5 text-sm font-medium text-[#EFE8DA] transition-colors duration-300 hover:bg-[#9C6F31] disabled:cursor-not-allowed disabled:opacity-60"
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
            <p
              className="mt-6 rounded-md border border-[#B5803C]/40 bg-[#F4EEE0] px-4 py-3 font-display text-base leading-snug tracking-tight text-[#101114]"
              role="status"
            >
              Check your inbox. A sign-in link is on its way.
            </p>
          )}
          {state === "error" && (
            <p
              className="mt-6 rounded-md border border-[#101114]/20 bg-[#EFE8DA] px-4 py-3 text-sm leading-relaxed text-[#101114]/82"
              role="alert"
            >
              We couldn&rsquo;t send the sign-in link. Confirm your email is invited and try
              again.
            </p>
          )}
        </form>

        <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.22em] text-[#101114]/55">
          Not invited yet?{" "}
          <a
            href="/contact"
            className="link-underline text-[#B5803C] transition-colors duration-200 hover:text-[#9C6F31]"
          >
            Get in touch{" "}
            <span aria-hidden>→</span>
          </a>
        </p>
      </div>
    </section>
  );
}
