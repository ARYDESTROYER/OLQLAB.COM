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
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-10 md:py-5">
        <Link
          href="/"
          className="flex items-center gap-3 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-light)]"
        >
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="rounded-full opacity-90"
            priority
          />
          <span className="font-display text-lg tracking-tight text-ink">
            OLQLAB
          </span>
        </Link>

        <NavLinks />

        <HeaderAuthSlot />
      </div>
    </header>
  );
}
