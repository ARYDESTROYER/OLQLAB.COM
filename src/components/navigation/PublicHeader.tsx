import Link from "next/link";
import Image from "next/image";
import NavLinks from "@/components/navigation/NavLinks";
import HeaderAuthSlot from "@/components/navigation/HeaderAuthSlot";

/**
 * Marketing-site header. Pure server component — renders the static logo +
 * primary navigation, then defers the "Sign in" vs "Dashboard + Profile"
 * decision to `<HeaderAuthSlot />`, a client island that fetches
 * `/api/auth/session` after mount.
 *
 * This component intentionally does NOT call `getServerAuthSession()` so that
 * every marketing route (`/`, `/about`, `/framework`, `/assessments`,
 * `/coaching`, `/blindspot`, `/contact`, `/oql`) has zero dynamic-API
 * dependencies and can be statically generated and CDN-cached.
 */
export default function PublicHeader() {
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

        <HeaderAuthSlot />
      </div>
    </header>
  );
}
