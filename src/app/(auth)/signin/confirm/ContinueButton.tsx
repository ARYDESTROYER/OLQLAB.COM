"use client";

import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import RotatingBadge from "@/components/marketing/RotatingBadge";

type SubmitState = "idle" | "signing" | "completing" | "error";

const SAFE_FALLBACK_URL = "/dashboard";
const SAFE_ERROR_URL = "/signin?error=invalid_link";

const MIN_HOLD_MS = 1200;
const COMPLETE_HOLD_MS = 700;
const ERROR_HOLD_MS = 1400;

export default function ContinueButton({ tokenUrl }: { tokenUrl: string }) {
  const [state, setState] = useState<SubmitState>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state !== "idle") return;

    const form = event.currentTarget;
    setState("signing");

    const startedAt = Date.now();

    try {
      const response = await fetch("/api/auth/continue", {
        method: "POST",
        body: new FormData(form),
        credentials: "include",
        redirect: "follow",
      });

      const destination = new URL(response.url || SAFE_FALLBACK_URL, window.location.origin);
      const failedDestination =
        destination.origin !== window.location.origin ||
        destination.pathname === "/signin" ||
        destination.pathname.startsWith("/api/auth/error") ||
        destination.pathname.startsWith("/api/auth/callback/");
      if (!response.ok || failedDestination) {
        throw new Error("The sign-in link is invalid or has already been used.");
      }

      const sessionResponse = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
      });
      const sessionData = (await sessionResponse.json().catch(() => null)) as
        | { user?: { id?: string } }
        | null;
      if (!sessionResponse.ok || !sessionData?.user?.id) {
        throw new Error("The sign-in session was not created.");
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_HOLD_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_HOLD_MS - elapsed));
      }

      setState("completing");
      await new Promise((resolve) => setTimeout(resolve, COMPLETE_HOLD_MS));

      window.location.assign(destination.pathname + destination.search + destination.hash);
    } catch {
      setState("error");
      await new Promise((resolve) => setTimeout(resolve, ERROR_HOLD_MS));
      window.location.assign(SAFE_ERROR_URL);
    }
  }

  const overlayVisible = state !== "idle";

  return (
    <>
      <form
        action="/api/auth/continue"
        method="post"
        onSubmit={handleSubmit}
        className="border-t border-[#101114]/15 pt-8 md:pt-10"
      >
        <input type="hidden" name="tokenUrl" value={tokenUrl} />
        <button
          type="submit"
          disabled={state !== "idle"}
          className="group inline-flex items-center gap-3 bg-[#101114] px-7 py-4 text-sm font-medium text-[#EFE8DA] transition-colors duration-300 hover:bg-[#1d1d20] disabled:cursor-wait disabled:opacity-70"
        >
          <span>{state === "idle" ? "Continue to sign-in" : "Signing you in"}</span>
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

      {overlayVisible
        ? createPortal(<SignInOverlay state={state} />, document.body)
        : null}
    </>
  );
}

function SignInOverlay({ state }: { state: SubmitState }) {
  const headline =
    state === "completing"
      ? "Welcome back"
      : state === "error"
        ? "Something went wrong"
        : "Securely signing you in";

  const subtitle =
    state === "completing"
      ? "Bringing you to your workspace."
      : state === "error"
        ? "Please request a fresh sign-in link."
        : "This takes a moment. Please don't close this window.";

  return (
    <div
      className="signin-overlay"
      role="status"
      aria-live="polite"
      data-state={state}
    >
      <div className="signin-overlay-inner">
        <div className="signin-badge-wrap">
          <RotatingBadge />
        </div>
        <div className="signin-copy">
          <p className="signin-eyebrow">
            <span className="brass-dot" aria-hidden /> One last step
          </p>
          <h2 className="font-display signin-headline">
            {headline}
            <span className="brass-period">.</span>
          </h2>
          <p className="signin-subtitle">{subtitle}</p>
          <div className="signin-progress" aria-hidden>
            <span className="signin-progress-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}
