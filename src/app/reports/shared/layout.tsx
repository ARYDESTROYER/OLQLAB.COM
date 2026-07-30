import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: null,
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
};

export default function SharedReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
