import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: "400",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "OLQLAB — Leadership begins within",
  description:
    "OLQLAB is a leadership development practice grounded in behavioral science and military-tested wisdom.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${instrumentSerif.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen bg-[#F4F1EA] text-[#0B0B0C] antialiased">{children}</body>
    </html>
  );
}
