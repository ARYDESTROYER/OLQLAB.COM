"use client";

import { FormEvent, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { requestMagicLink } from "@/lib/magic-link-request";

export default function SignInForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<"idle" | "sending" | "accepted" | "error">("idle");
  const emailInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const result = await requestMagicLink({
      email,
      signInRequest: signIn,
    });
    setState(result);
  }

  function useDifferentEmail() {
    setState("idle");
    requestAnimationFrame(() => {
      emailInputRef.current?.focus();
      emailInputRef.current?.select();
    });
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
          aria-busy={state === "sending"}
          className="rounded-2xl border border-[#B5803C]/55 bg-[#F4EEE0]/60 p-6 text-left md:p-8"
        >
          <label
            htmlFor="email"
            className="block text-[11px] font-medium uppercase tracking-[0.22em] text-[#101114]/55"
          >
            Work email
          </label>
          <input
            ref={emailInputRef}
            id="email"
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state === "sending" || state === "accepted"}
            className="mt-3 w-full rounded-md border border-[#B5803C]/65 bg-[#EFE8DA]/80 px-4 py-3.5 text-base text-[#101114] placeholder:text-[#101114]/35 outline-none transition-colors duration-200 focus:border-[#B5803C] focus:bg-[#EFE8DA] disabled:opacity-60 md:text-lg"
          />

          <button
            type="submit"
            disabled={state === "sending" || state === "accepted"}
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

          {state === "sending" && (
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              Requesting a sign-in link.
            </p>
          )}

          {state === "accepted" && (
            <div className="mt-6 rounded-md border border-[#B5803C]/40 bg-[#F4EEE0] px-4 py-3 text-[#101114]">
              <div role="status" aria-atomic="true">
                <p className="font-display text-base leading-snug tracking-tight">
                  Request received.
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#101114]/72">
                  For privacy, we can&rsquo;t confirm whether an email was sent. If a link
                  doesn&rsquo;t arrive, check spam, wait a few minutes, or ask your administrator
                  to confirm your access.
                </p>
              </div>
              <button
                type="button"
                onClick={useDifferentEmail}
                className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#9C6F31] underline decoration-[#B5803C]/45 underline-offset-4 transition-colors hover:text-[#101114] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9C6F31]"
              >
                Use a different email
              </button>
            </div>
          )}
          {state === "error" && (
            <p
              className="mt-6 rounded-md border border-[#101114]/20 bg-[#EFE8DA] px-4 py-3 text-sm leading-relaxed text-[#101114]/82"
              role="alert"
            >
              We couldn&rsquo;t complete the sign-in request. Please try again shortly or
              contact your administrator.
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
