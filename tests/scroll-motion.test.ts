import { describe, expect, it } from "vitest";
import {
  calculateScrollMotion,
  calculateStickyScrollProgress,
} from "@/lib/scroll-motion";

describe("calculateScrollMotion", () => {
  it("starts at zero before a scene enters the viewport", () => {
    expect(calculateScrollMotion(900, 400, 800).progress).toBe(0);
  });

  it("is halfway when the scene and viewport centres align", () => {
    expect(calculateScrollMotion(200, 400, 800).progress).toBe(0.5);
  });

  it("ends at one after the scene leaves through the top edge", () => {
    expect(calculateScrollMotion(-500, 400, 800).progress).toBe(1);
  });

  it("clamps degenerate geometry and keeps all layer values finite", () => {
    const values = calculateScrollMotion(Number.POSITIVE_INFINITY, -20, 0);

    expect(values.progress).toBe(0);
    Object.values(values).forEach((value) => expect(Number.isFinite(value)).toBe(true));
  });

  it("keeps motion bounded at both ends of the scene", () => {
    const start = calculateScrollMotion(800, 400, 800);
    const end = calculateScrollMotion(-400, 400, 800);

    expect(start).toMatchObject({ farY: -8, midY: 15, nearY: -24, turn: -1.2 });
    expect(end).toMatchObject({ farY: 8, midY: -15, nearY: 24, turn: 1.2 });
  });
});

describe("calculateStickyScrollProgress", () => {
  it("advances only across the bounded sticky travel", () => {
    expect(calculateStickyScrollProgress(72, 1320, 800, 72)).toBe(0);
    expect(calculateStickyScrollProgress(-224, 1320, 800, 72)).toBe(0.5);
    expect(calculateStickyScrollProgress(-520, 1320, 800, 72)).toBe(1);
  });

  it("clamps progress outside the sticky scene", () => {
    expect(calculateStickyScrollProgress(900, 1320, 800, 72)).toBe(0);
    expect(calculateStickyScrollProgress(-900, 1320, 800, 72)).toBe(1);
  });
});
