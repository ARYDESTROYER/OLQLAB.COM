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
  title: "OLQLAB",
  description: "OLQLAB enterprise personality and workstyle assessment program",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${instrumentSerif.variable} ${plexMono.variable} min-h-screen bg-[radial-gradient(circle_at_10%_15%,#d9f9f3_0%,transparent_40%),radial-gradient(circle_at_90%_10%,#fde7b3_0%,transparent_44%),linear-gradient(180deg,#f8fafc,#e2e8f0)] text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
