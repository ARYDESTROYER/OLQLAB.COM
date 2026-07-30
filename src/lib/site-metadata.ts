import type { Metadata } from "next";

export const SITE_NAME = "OLQ Lab";
export const SITE_URL = "https://www.olqlab.com";
export const DEFAULT_DESCRIPTION =
  "Leadership assessment and development grounded in behavioral science and military-tested wisdom.";

export function createPageMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const socialTitle = `${input.title} | ${SITE_NAME}`;

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: input.path,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: socialTitle,
      description: input.description,
      url: input.path,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "OLQ Lab — Leadership begins within",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: input.description,
      images: ["/opengraph-image"],
    },
  };
}
