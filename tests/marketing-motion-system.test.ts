import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

function blockAfter(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Missing contract marker: ${marker}`);

  const openIndex = source.indexOf("{", markerIndex);
  if (openIndex === -1)
    throw new Error(`Missing opening brace after: ${marker}`);

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }

  throw new Error(`Unclosed contract block after: ${marker}`);
}

describe("public marketing motion system", () => {
  it("exposes one semantic Warm Signal palette and bounded reveal variants", () => {
    const css = read("../src/app/globals.css");

    [
      "--signal-cognitive:",
      "--signal-cognitive-vivid:",
      "--signal-personality:",
      "--signal-personality-vivid:",
      "--signal-response:",
      "--signal-response-vivid:",
      "--focus-light:",
      "--ease-editorial:",
      '[data-reveal="rise"]',
      '[data-reveal="fade"]',
      '[data-reveal="scale"]',
      '[data-reveal="wipe"]',
      '[data-reveal="line"]',
      "[data-reveal-group] > [data-reveal-item]",
    ].forEach((contract) => expect(css).toContain(contract));

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (scripting: none)");
    expect(css).toContain(".stepper-vpanel");
    expect(css).toContain("grid-template-rows: 1fr");

    const reducedMotion = css.slice(
      css.indexOf("/* Reduced motion"),
      css.indexOf("@media (scripting: none)", css.indexOf("/* Reduced motion")),
    );
    [
      ".stepper-vpanel",
      ".stepper-vcircle",
      ".stepper-vnum",
      ".stepper-vlabel",
    ].forEach((selector) => expect(reducedMotion).toContain(selector));
  });

  it("keeps Blindspot full-bleed, bounded, and static in every fallback", () => {
    const field = read("../src/app/blindspot/BlindspotField.tsx");
    const css = read("../src/app/blindspot/blindspot.module.css");
    const desktop = blockAfter(
      css,
      "@media (min-width: 72rem) and (min-height: 44rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const compact = blockAfter(
      css,
      "@media (max-width: 71.99rem), (max-height: 43.99rem)",
    );
    const coarse = blockAfter(css, "@media (hover: none), (pointer: coarse)");
    const reduced = blockAfter(css, "@media (prefers-reduced-motion: reduce)");
    const noScript = blockAfter(css, "@media (scripting: none)");
    const forcedColors = blockAfter(css, "@media (forced-colors: active)");

    expect(field).toContain('progressMode="sticky"');
    expect(field).toContain("stickyOffset={72}");
    expect(field).not.toContain('window.addEventListener("scroll"');
    expect(field).not.toContain('window.addEventListener("resize"');
    expect(css).toMatch(/\.fieldMotion\s*\{[\s\S]*?width:\s*100%/);
    expect(css).toMatch(/\.fieldFrame\s*\{[\s\S]*?min-height:\s*calc\(100svh - 4\.5rem\)/);
    expect(desktop).toMatch(
      /\.fieldMotion\[data-scroll-enhanced="true"\]\s*\{[\s\S]*?min-height:\s*165svh/,
    );
    expect(desktop).toMatch(
      /\.fieldMotion\[data-scroll-enhanced="true"\] \.field\s*\{[\s\S]*?min-height:\s*165svh/,
    );
    expect(desktop).toMatch(
      /\.fieldMotion\[data-scroll-enhanced="true"\] \.fieldStage\s*\{[\s\S]*?position:\s*sticky/,
    );

    for (const fallback of [compact, coarse, reduced, noScript, forcedColors]) {
      expect(fallback).toMatch(/\.fieldMotion\s*\{[\s\S]*?min-height:\s*auto/);
      expect(fallback).toMatch(
        /\.fieldStage\s*\{[\s\S]*?position:\s*relative[\s\S]*?top:\s*auto/,
      );
      expect(fallback).not.toContain("position: sticky");
    }

    for (const fallback of [compact, coarse, reduced, noScript, forcedColors]) {
      expect(fallback).toContain("mask-image: none");
    }
  });

  it("fails open when reveal or scroll capabilities are unavailable", () => {
    const reveal = read("../src/components/effects/ScrollReveal.tsx");
    const motion = read("../src/components/effects/ScrollMotion.tsx");

    expect(reveal).toContain('typeof IntersectionObserver === "undefined"');
    expect(reveal).toContain("[data-reveal-parts]");
    expect(reveal).toContain("[data-reveal-group]");
    expect(reveal).toContain('element.classList.add("is-revealed")');
    expect(motion).toContain('typeof IntersectionObserver === "undefined"');
    expect(motion).toContain('typeof ResizeObserver === "undefined"');
    expect(motion).toContain("clearMotion();");
  });

  it("includes Work in practice in the shared public scroll progress system", () => {
    const progress = read("../src/components/effects/ScrollProgress.tsx");
    const workCss = read("../src/app/work/work.module.css");
    const previewCss = read(
      "../src/components/marketing/WorkInPracticePreview.module.css",
    );

    expect(progress).toContain('"/work"');
    expect(workCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(workCss).toContain("@media (forced-colors: active)");
    expect(previewCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(previewCss).toContain("@media (forced-colors: active)");
    expect(workCss).not.toContain("animation-iteration-count: infinite");
    expect(previewCss).not.toContain("animation-iteration-count: infinite");
  });

  it("coalesces pointer and all scroll scenes through shared animation frames", () => {
    const magnetic = read("../src/components/effects/Magnetic.tsx");
    const motion = read("../src/components/effects/ScrollMotion.tsx");

    expect(magnetic).toContain("window.requestAnimationFrame(update)");
    expect(magnetic).toContain("(pointer: fine)");
    expect(magnetic).toContain("(prefers-reduced-motion: reduce)");
    expect(motion).toContain(
      "const motionSubscribers = new Set<MotionSubscriber>()",
    );
    expect(motion).toContain(
      "window.requestAnimationFrame(flushMotionSubscribers)",
    );
    expect(motion.match(/window\.addEventListener\("scroll"/g)).toHaveLength(1);
    expect(motion.match(/window\.addEventListener\("resize"/g)).toHaveLength(1);
    expect(motion).toMatch(/\{\s*passive:\s*true,?\s*\}/);
  });

  it("isolates nested scroll scenes and only promotes active layers", () => {
    const motion = read("../src/components/effects/ScrollMotion.tsx");
    const css = read("../src/components/effects/ScrollMotion.module.css");

    expect(motion).toContain('element.closest("[data-scroll-scene]") === root');
    expect(motion).toContain("data-scroll-scene={sceneId}");
    expect(motion).toContain("element.dataset.scrollOwner = sceneId");
    expect(motion).toContain("element.dataset.scrollAmbientOwner = sceneId");
    expect(css).toContain("[data-scroll-enhanced-owner]");
    expect(css).toContain("[data-scroll-active-owner]");
    expect(css).toContain("[data-scroll-ambient-active-owner]");
    expect(css).not.toContain(
      '.scene[data-scroll-active="true"] [data-scroll-layer]',
    );
  });

  it("batches dynamic reveal scans and fails open immediately for focus", () => {
    const reveal = read("../src/components/effects/ScrollReveal.tsx");
    const css = read("../src/app/globals.css");

    expect(reveal).toContain("new MutationObserver(scheduleScan)");
    expect(reveal).toContain("window.requestAnimationFrame(() =>");
    expect(reveal).toContain(
      'document.addEventListener("focusin", onFocusIn, true)',
    );
    expect(reveal).toContain('element.dataset.revealFocus = "true"');
    expect(reveal).toContain('child.style.setProperty("--reveal-index"');
    expect(css).toContain('[data-reveal-focus="true"]');
    expect(css).toContain('[data-reveal-pending="true"]');
    expect(css).not.toMatch(/\.reveal-on-scroll\s*\{[^}]*will-change:/);
  });

  it("keeps the landing overture's CTA targets stationary and unpins every fallback", () => {
    const page = read("../src/app/page.tsx");
    const css = read("../src/app/LandingOverture.module.css");
    const actions = page.match(
      /<div className="landing-hero__actions">([\s\S]*?)<\/div>/,
    )?.[1];

    expect(actions).toBeDefined();
    expect(actions).toContain('href="/assessments"');
    expect(actions).toContain('href="/about"');
    expect(actions).not.toContain("data-scroll-layer");
    expect(css).not.toMatch(/\.landing-hero__actions\s*\{[\s\S]*?transform:/);
    expect(css).not.toMatch(/\.landing-cta\s*\{[\s\S]*?transform:/);

    const desktop = blockAfter(
      css,
      "@media (min-width: 64rem) and (min-height: 44rem) and (hover: hover) and (pointer: fine)",
    );
    const mobile = blockAfter(css, "@media (max-width: 63.99rem)");
    const coarse = blockAfter(css, "@media (hover: none), (pointer: coarse)");
    const reduced = blockAfter(css, "@media (prefers-reduced-motion: reduce)");
    const noScript = blockAfter(css, "@media (scripting: none)");

    expect(css.match(/position:\s*sticky/g)).toHaveLength(1);
    expect(desktop).toMatch(
      /\.motion\[data-scroll-enhanced="true"\] \.stage\s*\{[\s\S]*position:\s*sticky/,
    );
    expect(mobile).not.toContain("position: sticky");
    expect(mobile).toMatch(/\.headlineCopy,[\s\S]*transform:\s*none/);
    expect(css).toContain(
      '.motion:not([data-scroll-enhanced="true"]) .chapterMark',
    );

    for (const fallback of [coarse, reduced, noScript]) {
      expect(fallback).toMatch(/\.motion\s*\{[\s\S]*min-height:\s*auto/);
      expect(fallback).toMatch(
        /\.stage\s*\{[\s\S]*position:\s*relative[\s\S]*top:\s*auto/,
      );
      expect(fallback).toMatch(
        /\.headlineCopy,[\s\S]*opacity:\s*1[\s\S]*transform:\s*none/,
      );
      expect(fallback).not.toContain("position: sticky");
    }
  });

  it("gives the assessment expansion a static coarse, reduced, and no-script state", () => {
    const explorer = read(
      "../src/components/marketing/AssessmentSignalExplorer.tsx",
    );
    const explorerCss = read(
      "../src/components/marketing/AssessmentSignalExplorer.module.css",
    );
    const triangleCss = read(
      "../src/components/marketing/CprTriangle.module.css",
    );

    expect(explorer).toContain("activeCode={activeCode}");
    expect(explorer).toContain("onActiveChange={setActiveCode}");
    expect(explorer).toContain('defaultActive="CPR"');
    expect(explorer).toContain("styles.noScriptCatalogue");

    const coarseAndReduced = blockAfter(
      explorerCss,
      "@media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)",
    );
    const noScript = blockAfter(explorerCss, "@media (scripting: none)");

    for (const fallback of [coarseAndReduced, noScript]) {
      expect(fallback).toMatch(/\.scene\s*\{[\s\S]*min-height:\s*0/);
      expect(fallback).toMatch(
        /\.pin\s*\{[\s\S]*position:\s*relative\s*!important[\s\S]*top:\s*auto\s*!important[\s\S]*height:\s*auto\s*!important/,
      );
      expect(fallback).toMatch(
        /\.expansionPlane,[\s\S]*animation:\s*none\s*!important[\s\S]*transform:\s*none\s*!important[\s\S]*transition:\s*none\s*!important/,
      );
    }

    expect(noScript).toMatch(
      /\.mapHint,[\s\S]*\.detail\s*\{[\s\S]*display:\s*none/,
    );
    expect(noScript).toMatch(/\.noScriptCatalogue\s*\{[\s\S]*display:\s*grid/);

    const triangleNoScript = blockAfter(
      triangleCss,
      "@media (scripting: none)",
    );
    expect(triangleNoScript).toMatch(
      /\.nodes\[data-interactive="true"\]\s*\{[\s\S]*display:\s*none/,
    );
    expect(triangleNoScript).toMatch(
      /\.staticNodes\s*\{[\s\S]*display:\s*block/,
    );
    expect(triangleNoScript).toMatch(
      /\.edge,[\s\S]*opacity:\s*var\(--connector-opacity\)/,
    );
  });

  it("assembles OQL and coaching collections as groups, never per-card scenes", () => {
    const oql = read("../src/components/marketing/OqlQualityField.tsx");
    const coaching = read("../src/components/marketing/CoachingJourney.tsx");

    for (const source of [oql, coaching]) {
      expect(source).toContain('data-reveal-group="assembly"');
      expect(source).toContain("data-reveal-item");
    }

    expect(oql.match(/<ScrollMotion\b/g)).toHaveLength(1);
    expect(coaching).not.toContain("ScrollMotion");
    expect(oql).not.toMatch(/qualities\.map\([\s\S]*?<ScrollMotion\b/);
    expect(coaching).not.toMatch(/stages\.map\([\s\S]*?<ScrollMotion\b/);
  });

  it("shows clipped hero words and one settled CTA arrow in every fallback", () => {
    const chrome = read("../src/components/marketing/MarketingChrome.tsx");
    const editorial = read("../src/components/marketing/Editorial.tsx");
    const css = read("../src/app/globals.css");

    expect(chrome).toContain("aria-label={title}");
    expect(chrome).toContain('className="hero-word-rise" aria-hidden');
    expect(chrome).toContain('className="hero-word-clip"');
    expect(css).toMatch(/\.hero-word-clip\s*\{[\s\S]*overflow:\s*clip/);
    expect(editorial.match(/className="cta-arrow-exchange"/g)).toHaveLength(3);

    const reduced = blockAfter(css, "@media (prefers-reduced-motion: reduce)");
    const noScript = blockAfter(css, "@media (scripting: none)");

    for (const fallback of [reduced, noScript]) {
      expect(fallback).toMatch(
        /\.hero-word\s*\{[\s\S]*animation:\s*none\s*!important[\s\S]*opacity:\s*1\s*!important[\s\S]*transform:\s*none\s*!important/,
      );
      expect(fallback).toMatch(
        /\.cta-exchange-label,[\s\S]*\.cta-arrow-exchange\s*>\s*span[\s\S]*transition:\s*none\s*!important[\s\S]*transform:\s*none\s*!important/,
      );
    }

    expect(reduced).toMatch(
      /\.group:hover \.cta-exchange-label,[\s\S]*transform:\s*none\s*!important/,
    );
    expect(noScript).toMatch(
      /\.cta-arrow-exchange\s*>\s*span:first-child\s*\{[\s\S]*opacity:\s*1\s*!important/,
    );
    expect(noScript).toMatch(
      /\.cta-arrow-exchange\s*>\s*span:last-child\s*\{[\s\S]*display:\s*none\s*!important[\s\S]*opacity:\s*0\s*!important/,
    );

    expect(css).toMatch(
      /\.cta-arrow-exchange\s*>\s*span:last-child\s*\{[\s\S]*opacity:\s*0/,
    );
  });

  it("unsubscribes shared scroll motion for coarse and reduced capabilities", () => {
    const motion = read("../src/components/effects/ScrollMotion.tsx");
    const capabilityChange = blockAfter(
      motion,
      "const onMotionCapabilityChange = () =>",
    );

    expect(motion).toMatch(
      /window\.matchMedia\(\s*"\(prefers-reduced-motion: reduce\)",?\s*\)/,
    );
    expect(motion).toContain(
      'window.matchMedia("(hover: none), (pointer: coarse)")',
    );
    expect(motion).toMatch(
      /const motionIsDisabled = \(\) =>[\s\S]*motionPreference\.matches \|\| coarsePointer\.matches/,
    );
    expect(motion).toContain(
      "if (!motionIsDisabled()) startViewportSubscription();",
    );
    expect(motion).toContain(
      'root.style.setProperty("--scroll-progress", "1")',
    );
    expect(capabilityChange).toContain("stopViewportSubscription();");
    expect(capabilityChange).toContain("clearMotion();");
    expect(capabilityChange).toContain("startViewportSubscription();");
    expect(motion).toContain(
      'motionPreference.addEventListener("change", onMotionCapabilityChange)',
    );
    expect(motion).toContain(
      'coarsePointer.addEventListener("change", onMotionCapabilityChange)',
    );
    expect(motion).toContain(
      'motionPreference.removeEventListener("change", onMotionCapabilityChange)',
    );
    expect(motion).toContain(
      'coarsePointer.removeEventListener("change", onMotionCapabilityChange)',
    );
  });

  it("stops scroll-progress tracking while reduced motion is active", () => {
    const progress = read("../src/components/effects/ScrollProgress.tsx");
    const startTracking = blockAfter(progress, "const startTracking = () =>");
    const preferenceChange = blockAfter(
      progress,
      "const onPreferenceChange = () =>",
    );

    expect(progress).toMatch(
      /window\.matchMedia\(\s*"\(prefers-reduced-motion: reduce\)",?\s*\)/,
    );
    expect(startTracking).toContain(
      "if (tracking || motionPreference.matches) return;",
    );
    expect(startTracking).toContain(
      'window.addEventListener("scroll", onScroll, { passive: true })',
    );
    expect(preferenceChange).toContain("stopTracking();");
    expect(preferenceChange).toContain(
      'el.style.setProperty("--scroll-progress", "0")',
    );
    expect(preferenceChange).toContain("startTracking();");
    expect(progress).toContain(
      'motionPreference.addEventListener("change", onPreferenceChange)',
    );
    expect(progress).toContain(
      'motionPreference.removeEventListener("change", onPreferenceChange)',
    );
    expect(progress).toMatch(/return \(\) => \{[\s\S]*stopTracking\(\)/);
  });

  it("promotes magnetic layers only for fine-pointer motion-safe interaction", () => {
    const css = read("../src/app/globals.css");
    const magneticRules = css.slice(
      css.indexOf("/* Magnetic hover"),
      css.indexOf("/* Reduced motion", css.indexOf("/* Magnetic hover")),
    );
    const baseMagnetic = blockAfter(magneticRules, ".magnetic {");
    const promoted = blockAfter(
      magneticRules,
      "@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );

    expect(baseMagnetic).toContain("will-change: auto");
    expect(baseMagnetic).not.toContain("will-change: transform");
    expect(promoted).toContain(".magnetic:hover");
    expect(promoted).toContain(".magnetic:focus-visible");
    expect(promoted).toContain("will-change: transform");
    expect(magneticRules.match(/will-change:\s*transform/g)).toHaveLength(1);
  });
});
