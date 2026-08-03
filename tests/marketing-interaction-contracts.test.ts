import { readFileSync } from "node:fs";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlindspotField } from "@/app/blindspot/BlindspotField";
import BlindspotPage from "@/app/blindspot/page";
import { ContactBriefBuilder } from "@/app/contact/ContactBriefBuilder";
import AboutPage from "@/app/about/page";
import ContactPage from "@/app/contact/page";
import FrameworkPage from "@/app/framework/page";
import HomePage from "@/app/page";
import OqlPage from "@/app/oql/page";
import WorkPage from "@/app/work/page";
import SectionSignalRail from "@/components/effects/SectionSignalRail";
import AssessmentSignalExplorer from "@/components/marketing/AssessmentSignalExplorer";
import CprTriangle, {
  type CprRegion,
} from "@/components/marketing/CprTriangle";
import {
  EditorialFooter,
  PrimaryCTA,
} from "@/components/marketing/Editorial";
import { PUBLIC_NAV_ITEMS } from "@/components/navigation/NavLinks";
import StepperFlow from "@/components/marketing/StepperFlow";
import WorkInPracticePreview from "@/components/marketing/WorkInPracticePreview";

const regions: readonly CprRegion[] = [
  { code: "C", label: "Cognitive", description: "Thinking signal" },
  { code: "P", label: "Personality", description: "Engagement signal" },
  { code: "R", label: "Response", description: "Adaptation signal" },
  { code: "CP", label: "Cognitive and Personality", description: "CP signal" },
  { code: "PR", label: "Personality and Response", description: "PR signal" },
  { code: "CR", label: "Cognitive and Response", description: "CR signal" },
  { code: "CPR", label: "Composite pattern", description: "CPR signal" },
];

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function inspectScrollLayers(markup: string) {
  const stack: Array<{ tag: string; hidden: boolean }> = [];
  const layers: Array<{ tag: string; hidden: boolean; openingTag: string }> =
    [];
  const tokens = markup.match(/<\/?[a-z][^>]*>/gi) ?? [];

  for (const token of tokens) {
    const closing = token.startsWith("</");
    const match = token.match(/^<\/?([a-z][\w-]*)/i);
    if (!match) continue;
    const tag = match[1].toLowerCase();

    if (closing) {
      const openIndex = stack.map((frame) => frame.tag).lastIndexOf(tag);
      if (openIndex !== -1) stack.splice(openIndex);
      continue;
    }

    const hidden =
      (stack.at(-1)?.hidden ?? false) || /\baria-hidden="true"/.test(token);
    if (/\bdata-scroll-layer=/.test(token)) {
      layers.push({ tag, hidden, openingTag: token });
    }

    if (!token.endsWith("/>") && !voidElements.has(tag)) {
      stack.push({ tag, hidden });
    }
  }

  return layers;
}

describe("public marketing interaction contracts", () => {
  it("renders every CPR node and all twelve relationship segments", () => {
    const markup = renderToStaticMarkup(
      createElement(CprTriangle, { regions }),
    );

    expect(markup.match(/<line\b/g)).toHaveLength(12);
    expect(markup.match(/aria-pressed=/g)).toHaveLength(7);
    expect(markup).toContain("data-reveal-parts");
    expect(markup).not.toContain("stroke-dashoffset");
  });

  it("keeps the Contact brief local and exposes semantic progress", () => {
    const markup = renderToStaticMarkup(createElement(ContactBriefBuilder));

    expect(markup.match(/type="radio"/g)).toHaveLength(19);
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).toContain("mailto:hello@olqlab.com");
    expect(markup).not.toContain("<form");
  });

  it("gives the Blindspot field four labelled controls and a static fallback", () => {
    const markup = renderToStaticMarkup(createElement(BlindspotField));
    const css = readFileSync(
      new URL("../src/app/blindspot/blindspot.module.css", import.meta.url),
      "utf8",
    );
    const source = readFileSync(
      new URL("../src/app/blindspot/BlindspotField.tsx", import.meta.url),
      "utf8",
    );
    const coarseStart = css.indexOf("@media (hover: none), (pointer: coarse)");
    const coarseEnd = css.indexOf("@media", coarseStart + 1);
    const coarseFallback = css.slice(coarseStart, coarseEnd);

    expect(markup.match(/aria-label="Reveal /g)).toHaveLength(4);
    expect(markup).toContain('id="perception-field"');
    expect(markup).toContain("<noscript>");
    expect(markup).toContain("Unspoken friction");
    expect(markup).toContain("Intent / impact");
    expect(coarseStart).toBeGreaterThan(-1);
    expect(coarseFallback).toContain("mask-image: none");
    expect(coarseFallback).toContain(".fieldFrame::after");
    expect(coarseFallback).toContain("display: none");
    expect(source).toContain("pointerFrameRef");
    expect(source).toContain("window.requestAnimationFrame");
  });

  it("places Blindspot Work before Contact in both public navigation modes", () => {
    expect(PUBLIC_NAV_ITEMS.map((item) => item.label)).toEqual([
      "About",
      "Framework",
      "Assessments",
      "Blindspot Work",
      "Contact",
    ]);
  });

  it("offers one stationary, color-coded next-step pathway in every footer", () => {
    const markup = renderToStaticMarkup(createElement(EditorialFooter));

    expect(markup).toContain('aria-label="Explore OLQ Lab by what you need"');
    expect(markup).toContain("Choose your next move.");
    expect(markup).toContain("See my pattern");
    expect(markup).toContain("Understand the model");
    expect(markup).toContain("Work a blindspot");
    expect(markup).toContain("Start a conversation");
    expect(markup.match(/class="footer-pathway__item"/g)).toHaveLength(4);
    expect(markup).toContain("data-reveal-parts");
    expect(markup).not.toContain("data-scroll-layer");
    expect(markup).toContain('href="/work"');
  });

  it("presents real workshop photography as a captioned landing pathway", () => {
    const markup = renderToStaticMarkup(createElement(WorkInPracticePreview));

    expect(markup).toContain('aria-labelledby="work-preview-title"');
    expect(markup).toContain("Inside the work");
    expect(markup).toContain("Leadership becomes visible");
    expect(markup.match(/<figure/g)).toHaveLength(2);
    expect(markup.match(/<figcaption/g)).toHaveLength(2);
    expect(markup).toContain('href="/work"');
    expect(markup).not.toContain("data-scroll-layer");
    expect(markup.indexOf("solution-mindset-campus.webp")).toBeLessThan(
      markup.indexOf("learning-through-action.webp"),
    );
    expect(markup.indexOf("01 / IN THE ROOM")).toBeLessThan(
      markup.indexOf("02 / IN PRACTICE"),
    );
  });

  it("associates every coaching control with its changing detail", () => {
    const markup = renderToStaticMarkup(
      createElement(StepperFlow, {
        stages: [
          { code: "notice", label: "Notice", description: "Read the signal." },
          { code: "name", label: "Name", description: "Make it discussable." },
        ],
      }),
    );

    expect(markup).toContain("data-reveal-parts");
    expect(markup.match(/aria-controls=/g)).toHaveLength(4);
    expect(markup.match(/aria-expanded=/g)).toHaveLength(2);
    expect(markup.match(/role="region"/g)).toHaveLength(2);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("<noscript>");
    expect(markup).toContain('aria-label="Coaching stages"');
    expect(markup.match(/Read the signal\./g)).toHaveLength(3);
    expect(markup.match(/Make it discussable\./g)).toHaveLength(2);
  });

  it("keeps the assessment triangle controlled while motion stays decorative", () => {
    const markup = renderToStaticMarkup(
      createElement(AssessmentSignalExplorer, { regions }),
    );
    const source = readFileSync(
      new URL(
        "../src/components/marketing/AssessmentSignalExplorer.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const layers = inspectScrollLayers(markup);
    const noScriptCatalogue = markup.match(
      /<noscript>([\s\S]*?)<\/noscript>/,
    )?.[1];

    expect(markup.match(/aria-pressed=/g)).toHaveLength(7);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("12 relationships · 7 tracks");
    expect(source).toContain("activeCode={activeCode}");
    expect(source).toContain("onActiveChange={setActiveCode}");
    expect(source).toContain(
      'className={styles.expansionPlane} aria-hidden="true"',
    );
    expect(noScriptCatalogue).toBeDefined();
    expect(noScriptCatalogue?.match(/<dt>/g)).toHaveLength(7);
    expect(noScriptCatalogue).toContain("Composite pattern");
    expect(layers).toHaveLength(4);
    layers.forEach((layer) => {
      expect(layer.hidden, layer.openingTag).toBe(true);
      expect([
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "summary",
      ]).not.toContain(layer.tag);
    });
  });

  it("renders the signal rail as silent visual orientation, never navigation", () => {
    const markup = renderToStaticMarkup(
      createElement(SectionSignalRail, {
        items: [
          { id: "first", label: "Notice", tone: "cognitive" },
          { id: "second", label: "Practise", tone: "response" },
        ],
      }),
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-active-index="0"');
    expect(markup).not.toContain("aria-live");
    expect(markup).not.toMatch(/<(?:a|button|input|select|textarea|summary)\b/);
    expect(markup).not.toContain("tabindex=");
    expect(markup).not.toContain('role="navigation"');
  });

  it("keeps the CTA arrow exchange inside one stable link target", () => {
    const markup = renderToStaticMarkup(
      createElement(
        PrimaryCTA,
        { href: "/contact" } as ComponentProps<typeof PrimaryCTA>,
        "Start a conversation",
      ),
    );
    const arrow = markup.match(
      /<span aria-hidden="true" class="cta-arrow-exchange">([\s\S]*?)<\/span>/,
    )?.[1];

    expect(markup.match(/<a\b/g)).toHaveLength(1);
    expect(markup).toContain('href="/contact"');
    expect(markup).toContain('class="cta-exchange-label"');
    expect(arrow).toBeDefined();
    expect(markup.match(/→/g)).toHaveLength(2);
  });

  it("keeps every public scroll layer hidden from accessibility and focus", () => {
    const markup = [
      createElement(HomePage),
      createElement(AboutPage),
      createElement(BlindspotPage),
      createElement(FrameworkPage),
      createElement(ContactPage),
      createElement(OqlPage),
      createElement(WorkPage),
      createElement(AssessmentSignalExplorer, { regions }),
    ]
      .map((element) => renderToStaticMarkup(element))
      .join("");
    const layers = inspectScrollLayers(markup);

    expect(layers.length).toBeGreaterThan(20);
    for (const layer of layers) {
      expect(layer.hidden, layer.openingTag).toBe(true);
      expect([
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "summary",
      ]).not.toContain(layer.tag);
      expect(layer.openingTag).not.toMatch(/\btabindex="(?:0|[1-9]\d*)"/);
      expect(layer.openingTag).not.toMatch(/\brole="(?:button|link)"/);
    }
  });
});
