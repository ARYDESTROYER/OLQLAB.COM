import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerAuthSession } from "@/lib/auth";
import ToastContainer from "@/components/admin/Toast";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/assessments", label: "Assessments" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect("/signin");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="rounded-3xl bg-gradient-to-r from-amber-100 via-orange-50 to-cyan-100 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">Admin Console</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Operations Center</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-700">
          Manage users, tenants, global assessments, enrollments, and access lifecycle.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {children}
      <ToastContainer />
    </main>
  );
}

