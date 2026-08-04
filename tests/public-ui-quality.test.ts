import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("public UI quality contracts", () => {
  it("uses the shared sticky progress model and keeps the landing opening restrained", () => {
    const page = read("../src/app/page.tsx");
    const motion = read("../src/app/LandingOverture.module.css");
    const globals = read("../src/app/globals.css");
    const scrollMotion = read("../src/components/effects/ScrollMotion.tsx");

    expect(page).toContain('progressMode="sticky"');
    expect(page).toContain(
      'enhancementQuery="(min-width: 64rem) and (min-height: 44rem) and (hover: hover) and (pointer: fine)"',
    );
    expect(page).toContain("stickyOffset={72}");
    expect(motion).toContain(
      "--overture-progress: var(--scroll-progress, 0)",
    );
    expect(motion).toContain(
      "@media (min-width: 64rem) and (max-height: 43.99rem)",
    );
    expect(page).not.toContain("landing-hero__spectrum");
    expect(page).toContain("Scroll to reveal");
    expect(motion).not.toContain("@keyframes arrow-fall");
    expect(globals).not.toContain("@keyframes landing-rail-in");
    expect(globals).toContain(
      "--dimension-signal: var(--signal-cognitive-vivid)",
    );
    expect(globals).toContain(
      "--dimension-on-signal: var(--on-signal-vivid)",
    );
    expect(scrollMotion).toContain("enhancementCapability?.matches === false");
    expect(globals).toContain(".animate-slide-in-panel {");
    expect(globals).toContain("animation: none !important;");
  });

  it("bounds narrow navigation and removes the redundant mobile dashboard link", () => {
    const nav = read("../src/components/navigation/NavLinks.tsx");
    const auth = read("../src/components/navigation/HeaderAuthSlot.tsx");
    const profile = read("../src/components/navigation/ProfileMenu.tsx");

    expect(nav).toContain("max-h-[calc(100svh-6rem)]");
    expect(nav).toContain("overflow-y-auto overscroll-contain");
    expect(nav).toContain("min-h-11");
    expect(auth).toContain("sm:inline-block");
    expect(profile).toContain("aria-expanded={open}");
    expect(profile).not.toContain("aria-haspopup");
    expect(profile).toContain('event.key !== "Escape"');
    expect(profile).not.toContain("onMouseEnter");
    expect(profile).not.toContain("onMouseLeave");
    expect(profile).toContain("max-h-[calc(100svh-6rem)]");
  });

  it("keeps sign-in landmarks, focus indicators, and readable brass accents", () => {
    const signInPage = read("../src/app/(auth)/signin/page.tsx");
    const confirmPage = read("../src/app/(auth)/signin/confirm/page.tsx");
    const form = read("../src/app/(auth)/signin/SignInForm.tsx");
    const continueButton = read(
      "../src/app/(auth)/signin/confirm/ContinueButton.tsx",
    );

    expect(signInPage).toContain('href="#signin-content"');
    expect(signInPage).toContain('id="signin-content"');
    expect(signInPage).toContain("tabIndex={-1}");
    expect(confirmPage.match(/href="#signin-confirm-content"/g)).toHaveLength(
      2,
    );
    expect(confirmPage.match(/id="signin-confirm-content"/g)).toHaveLength(2);
    expect(form).toContain("text-[#101114]");
    expect(form).toContain("placeholder:text-[#101114]/62");
    expect(form).toContain("border-[#735027]");
    expect(form).toContain("focus-visible:outline-[#735027]");
    expect(form).toContain("link-underline text-[#735027]");
    expect(continueButton).toContain("focus-visible:outline-[var(--focus-light)]");
    expect(signInPage).toContain("scroll-mt-24");
    expect(confirmPage.match(/scroll-mt-24/g)).toHaveLength(2);
  });
});
