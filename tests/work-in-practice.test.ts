import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import WorkPage from "@/app/work/page";
import { WORK_EVENTS, WORK_IMAGES } from "@/content/work-events";

describe("Work in practice content", () => {
  it("keeps every field note complete, uniquely addressable, and captioned", () => {
    expect(WORK_EVENTS).toHaveLength(4);
    expect(new Set(WORK_EVENTS.map((event) => event.slug)).size).toBe(
      WORK_EVENTS.length,
    );

    for (const event of WORK_EVENTS) {
      expect(event.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(event.title.length).toBeGreaterThan(8);
      expect(event.description.length).toBeGreaterThan(40);
      expect(event.location.length).toBeGreaterThan(2);
      expect(event.format.length).toBeGreaterThan(5);
      expect(event.dateTime).toMatch(/^\d{4}-\d{2}(?:-\d{2})?$/);
      expect(event.images.length).toBeGreaterThan(0);

      for (const image of event.images) {
        expect(image.src).toMatch(/^\/work\/[a-z0-9-]+\.webp$/);
        expect(image.alt.length).toBeGreaterThan(20);
        expect(image.caption.length).toBeGreaterThan(20);
        expect(image.width).toBeGreaterThan(1000);
        expect(image.height).toBeGreaterThan(1000);
      }
    }

    const offsite = WORK_EVENTS.find(
      (event) => event.slug === "experiential-leadership-offsite",
    );
    expect(offsite?.images).toHaveLength(7);
    expect(offsite?.images.map((image) => image.src)).toEqual([
      "/work/offsite-orientation.webp",
      "/work/offsite-individual-attempt.webp",
      "/work/offsite-response.webp",
      "/work/offsite-trust.webp",
      "/work/offsite-team-effort.webp",
      "/work/offsite-coordination.webp",
      "/work/offsite-courage.webp",
    ]);
  });

  it("ships bounded WebP derivatives without embedded metadata", async () => {
    for (const image of Object.values(WORK_IMAGES)) {
      const path = resolve(process.cwd(), "public", image.src.slice(1));
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size, image.src).toBeLessThan(450_000);

      const metadata = await sharp(path).metadata();
      expect(metadata.format, image.src).toBe("webp");
      expect(metadata.width, image.src).toBe(image.width);
      expect(metadata.height, image.src).toBe(image.height);
      expect(metadata.exif, image.src).toBeUndefined();
      expect(metadata.iptc, image.src).toBeUndefined();
      expect(metadata.xmp, image.src).toBeUndefined();
    }
  });

  it("renders an event-led archive with visible dates, places, and captions", () => {
    const markup = renderToStaticMarkup(createElement(WorkPage));

    expect(markup).toContain('id="work-content"');
    expect(markup).toContain("Work in practice");
    expect(markup.match(/data-work-event="true"/g)).toHaveLength(4);
    expect(markup.match(/<time dateTime=/g)).toHaveLength(4);
    expect(markup.match(/<figure/g)).toHaveLength(12);
    expect(markup.match(/<figcaption/g)).toHaveLength(12);
    expect(markup.match(/data-reveal-group="assembly"/g)).toHaveLength(4);
    expect(markup).toContain("Kopargaon, Maharashtra");
    expect(markup).toContain('href="/contact"');
    expect(markup).not.toContain("carousel");
    expect(markup).not.toContain("autoplay");
  });

  it("publishes the Work in practice route in the sitemap", () => {
    expect(sitemap()).toContainEqual(
      expect.objectContaining({
        url: "https://www.olqlab.com/work",
        changeFrequency: "monthly",
      }),
    );
  });
});
