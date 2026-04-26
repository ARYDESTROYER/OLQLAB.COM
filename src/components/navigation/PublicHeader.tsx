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
    <header className="sticky top-0 z-40 border-b border-[#101114]/10 bg-[#EFE8DA]/85 backdrop-blur-md">
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
          <span className="font-display text-xl tracking-tight text-[#101114]">OLQLAB</span>
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="link-underline text-sm font-medium text-[#101114]/72 transition-colors duration-200 hover:text-[#101114]"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {!session?.user ? (
          <Link
            href="/signin"
            className="text-sm font-medium text-[#101114] underline underline-offset-[6px] decoration-[#101114]/30 transition-colors duration-200 hover:decoration-[#101114]"
          >
            Sign in
          </Link>
        ) : (
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-[#101114] underline underline-offset-[6px] decoration-[#101114]/30 transition-colors duration-200 hover:decoration-[#101114]"
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
