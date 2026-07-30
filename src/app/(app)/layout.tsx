import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/navigation/AppShell";
import { getLiveSession } from "@/lib/api-auth";

export const metadata: Metadata = {
  alternates: {
    canonical: null,
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const check = await getLiveSession();

  if (!check) {
    redirect("/signin");
  }

  return (
    <AppShell role={check.session.user.role} email={check.session.user.email}>
      {children}
    </AppShell>
  );
}
