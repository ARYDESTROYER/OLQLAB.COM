import { ImageResponse } from "next/og";

export const alt = "OLQ Lab — Leadership begins within";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#EFE8DA",
          color: "#101114",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px 84px",
          width: "100%",
        }}
      >
        <div
          style={{
            color: "#9C6F31",
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.18em",
          }}
        >
          OLQ LAB
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontFamily: "serif", fontSize: 88, lineHeight: 1 }}>
            Leadership begins within.
          </div>
          <div style={{ color: "#4C4A45", display: "flex", fontSize: 29 }}>
            Assessment · Blindspot work · Coaching
          </div>
        </div>
        <div style={{ background: "#B5803C", display: "flex", height: 8, width: 180 }} />
      </div>
    ),
    size,
  );
}
