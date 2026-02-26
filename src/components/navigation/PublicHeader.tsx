import Link from "next/link";
import Image from "next/image";
import { getServerAuthSession } from "@/lib/auth";
import ProfileMenu from "@/components/navigation/ProfileMenu";

export default async function PublicHeader() {
  const session = await getServerAuthSession();
  const role = session?.user?.role;
  const email = session?.user?.email;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/75 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="OLQLab Logo"
            width={44}
            height={44}
            className="rounded-full"
            priority
          />
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] text-slate-900">OLQLAB</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Leadership Development</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/about" className="transition hover:text-slate-900">About</Link>
          <Link href="/framework" className="transition hover:text-slate-900">Framework</Link>
          <Link href="/assessments" className="transition hover:text-slate-900">Assessments</Link>
          <Link href="/contact" className="transition hover:text-slate-900">Contact</Link>
        </nav>

        {!session?.user ? (
          <Link
            href="/signin"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
          >
            Sign In
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-700"
            >
              My Dashboard
            </Link>
            {role && <ProfileMenu role={role} email={email} />}
          </div>
        )}
      </div>
    </header>
  );
}
