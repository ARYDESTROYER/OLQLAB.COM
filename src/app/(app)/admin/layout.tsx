import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerAuthSession } from "@/lib/auth";
import ToastContainer from "@/components/admin/Toast";
import AdminSubNav from "@/components/admin/AdminSubNav";

const links = [
  { href: "/admin", label: "Overview", matchPrefix: "/admin", exact: true },
  { href: "/admin/users", label: "Users", matchPrefix: "/admin/users", exact: false },
  { href: "/admin/tenants", label: "Organisations", matchPrefix: "/admin/tenants", exact: false },
  { href: "/admin/assessments", label: "Assessments", matchPrefix: "/admin/assessments", exact: false },
  { href: "/admin/settings", label: "Settings", matchPrefix: "/admin/settings", exact: false },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <main className="mx-auto max-w-7xl px-6 pt-12 pb-24 md:px-10 md:pt-16 md:pb-32">
      <header>
        <p className="inline-flex items-center text-[11px] font-medium uppercase tracking-[0.28em] text-[#101114]/55">
          <span className="brass-dot" aria-hidden /> Admin console
        </p>
        <h1 className="font-display mt-8 text-balance text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.03em]">
          Operations<span className="brass-period">.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#101114]/64 md:text-base">
          Manage users, organisations, global assessments, enrollments, and access lifecycle.
        </p>

        <AdminSubNav links={links} />
      </header>

      <div className="mt-[var(--workspace-section-y)]">{children}</div>
      <ToastContainer />
    </main>
  );
}
