import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OLQ Lab",
    short_name: "OLQ Lab",
    description:
      "Leadership assessment and development grounded in behavioral science and military-tested wisdom.",
    start_url: "/",
    display: "standalone",
    background_color: "#EFE8DA",
    theme_color: "#101114",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
