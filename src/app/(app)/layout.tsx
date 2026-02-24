import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "@/components/navigation/AppShell";
import { getServerAuthSession } from "@/lib/auth";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <AppShell role={session.user.role} email={session.user.email}>
      {children}
    </AppShell>
  );
}
