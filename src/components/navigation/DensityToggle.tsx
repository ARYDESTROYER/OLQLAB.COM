"use client";

import { useEffect, useState } from "react";

type Density = "tight" | "roomy";

const STORAGE_KEY = "olqlab-workspace-density";

function readDensity(): Density {
  if (typeof window === "undefined") return "roomy";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "tight" || stored === "roomy") return stored;
  } catch {
    // localStorage might be blocked; fall through to default.
  }
  return "roomy";
}

/**
 * Small chip-style toggle that switches workspace pages between `tight`
 * (dense, table-friendly) and `roomy` (generous, editorial) spacing.
 *
 * Server renders default "roomy". On first client mount the lazy state
 * initializer reads localStorage; we acknowledge the potential hydration
 * mismatch on the visible label with `suppressHydrationWarning`.
 */
export default function DensityToggle() {
  const [density, setDensity] = useState<Density>(readDensity);

  // Apply the data-density attribute whenever `density` changes. Doing it
  // in a layout/regular effect (not in the lazy initial) keeps the rule
  // `react-hooks/set-state-in-effect` happy — we only call `setAttribute`
  // here, never `setState`.
  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  function flip() {
    const next: Density = density === "tight" ? "roomy" : "tight";
    setDensity(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — in-memory state still works for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${density === "tight" ? "roomy" : "tight"} layout`}
      title={`Density: ${density}`}
      suppressHydrationWarning
      className="hidden items-center gap-2 rounded-full border border-[#101114]/15 bg-[#F4EEE0]/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#101114]/72 transition-colors duration-200 hover:border-[#B5803C]/55 hover:text-[#101114] md:inline-flex"
    >
      <span
        aria-hidden
        suppressHydrationWarning
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          density === "tight" ? "bg-[#B5803C]" : "bg-[#101114]/35"
        }`}
      />
      <span suppressHydrationWarning>{density}</span>
    </button>
  );
}
