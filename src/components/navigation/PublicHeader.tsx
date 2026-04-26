import Link from "next/link";
import Image from "next/image";
import { getServerAuthSession } from "@/lib/auth";
import ProfileMenu from "@/components/navigation/ProfileMenu";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/framework", label: "Framework" },
  { href: "/assessments", label: "Assessments" },
  { href: "/contact", label: "Contact" },
];

export default async function PublicHeader() {
  const session = await getServerAuthSession();
  const role = session?.user?.role;
  const email = session?.user?.email;

  return (
    <header className="sticky top-0 z-40 border-b border-[#0B0B0C]/10 bg-[#F4F1EA]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="rounded-full opacity-90"
            priority
          />
          <span className="font-display text-xl tracking-tight text-[#0B0B0C]">OLQLAB</span>
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="link-underline text-sm font-medium text-[#0B0B0C]/72 transition-colors duration-200 hover:text-[#0B0B0C]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {!session?.user ? (
          <Link
            href="/signin"
            className="text-sm font-medium text-[#0B0B0C] underline underline-offset-[6px] decoration-[#0B0B0C]/30 transition-colors duration-200 hover:decoration-[#0B0B0C]"
          >
            Sign in
          </Link>
        ) : (
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-[#0B0B0C] underline underline-offset-[6px] decoration-[#0B0B0C]/30 transition-colors duration-200 hover:decoration-[#0B0B0C]"
            >
              Dashboard
            </Link>
            {role && <ProfileMenu role={role} email={email} />}
          </div>
        )}
      </div>
    </header>
  );
}
