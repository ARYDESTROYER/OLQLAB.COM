import Link from "next/link";
import Image from "next/image";
import { getServerAuthSession } from "@/lib/auth";
import ProfileMenu from "@/components/navigation/ProfileMenu";
import NavLinks from "@/components/navigation/NavLinks";

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
            width={32}
            height={32}
            className="rounded-full opacity-90"
            priority
          />
          <span className="font-display text-lg tracking-tight text-[#101114]">
            OLQLAB
          </span>
        </Link>

        <NavLinks />

        {!session?.user ? (
          <Link
            href="/signin"
            className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
          >
            Sign in
          </Link>
        ) : (
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
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
