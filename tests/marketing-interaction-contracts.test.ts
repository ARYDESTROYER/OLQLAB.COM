import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlindspotField } from "@/app/blindspot/BlindspotField";
import { ContactBriefBuilder } from "@/app/contact/ContactBriefBuilder";
import CprTriangle, {
  type CprRegion,
} from "@/components/marketing/CprTriangle";

const regions: readonly CprRegion[] = [
  { code: "C", label: "Cognitive", description: "Thinking signal" },
  { code: "P", label: "Personality", description: "Engagement signal" },
  { code: "R", label: "Response", description: "Adaptation signal" },
  { code: "CP", label: "Cognitive and Personality", description: "CP signal" },
  { code: "PR", label: "Personality and Response", description: "PR signal" },
  { code: "CR", label: "Cognitive and Response", description: "CR signal" },
  { code: "CPR", label: "Composite pattern", description: "CPR signal" },
];

describe("public marketing interaction contracts", () => {
  it("renders every CPR node and all twelve relationship segments", () => {
    const markup = renderToStaticMarkup(
      createElement(CprTriangle, { regions }),
    );

    expect(markup.match(/<line\b/g)).toHaveLength(12);
    expect(markup.match(/aria-pressed=/g)).toHaveLength(7);
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
});
