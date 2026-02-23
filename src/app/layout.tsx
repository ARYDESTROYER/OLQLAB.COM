import type { Metadata } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "PersonaPilot",
  description: "Corporate personality assessment platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${plexMono.variable} min-h-screen bg-[radial-gradient(circle_at_15%_20%,#fff7ed_0%,transparent_45%),radial-gradient(circle_at_85%_10%,#e0f2fe_0%,transparent_42%),linear-gradient(180deg,#f8fafc,#eef2ff)] text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
