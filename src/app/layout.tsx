import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "OLQLAB",
  description: "OLQLAB corporate personality assessment platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable} min-h-screen bg-[radial-gradient(circle_at_10%_15%,#cffafe_0%,transparent_40%),radial-gradient(circle_at_90%_10%,#fde68a_0%,transparent_42%),linear-gradient(180deg,#f8fafc,#e2e8f0)] text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
