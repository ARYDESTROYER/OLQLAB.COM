/**
 * Circular brass-text badge that rotates slowly. Used in the hero corner
 * to give the page a kinetic moment without competing with the headline.
 *
 * Renders pure SVG + CSS animation — no JS, no client component.
 */
export default function RotatingBadge({
  text = "LEADERSHIP · BEGINS · WITHIN",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  // Repeat the phrase a few times so we always have enough to wrap the
  // circle without an obvious seam — extra runs are simply rendered
  // beyond the path's length.
  const fullText = (text + " · ").repeat(3);

  return (
    <div className={`rotating-badge ${className}`} aria-hidden>
      <svg viewBox="0 0 200 200" className="block h-full w-full">
        <defs>
          <path
            id="badge-circle-path"
            d="M 100,100 m -76,0 a 76,76 0 1,1 152,0 a 76,76 0 1,1 -152,0"
            fill="none"
          />
        </defs>

        {/* Outer ring */}
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="#B5803C"
          strokeWidth="0.6"
          opacity="0.55"
        />

        {/* Inner ring (subtle) */}
        <circle
          cx="100"
          cy="100"
          r="60"
          fill="none"
          stroke="#B5803C"
          strokeWidth="0.4"
          opacity="0.32"
        />

        {/* Centre dot */}
        <circle cx="100" cy="100" r="2.4" fill="#B5803C" />

        {/* Circular text */}
        <text
          fill="#B5803C"
          fontSize="10.5"
          letterSpacing="2.6"
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
          }}
        >
          <textPath href="#badge-circle-path" startOffset="0%">
            {fullText}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
