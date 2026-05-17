"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileMenu from "@/components/navigation/ProfileMenu";

type Role = "ADMIN" | "EMPLOYEE" | "LEADER";
type SessionUser = { role?: Role; email?: string | null } | undefined;

// Module-level promise cache so client-side route hops (`/about` → `/framework`
// via `<Link>`) share one `/api/auth/session` round-trip per SPA session.
let cached: Promise<SessionUser> | null = null;

function loadSession(): Promise<SessionUser> {
  if (cached) return cached;
  cached = fetch("/api/auth/session", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => data?.user as SessionUser)
    .catch(() => undefined);
  return cached;
}

/**
 * Client island that decides whether to render the anonymous "Sign in" link
 * or the signed-in "Dashboard + Profile" treatment. Default render (used in
 * both SSR and pre-fetch) is the anonymous state, which lets every marketing
 * page that embeds `<PublicHeader />` be statically rendered and CDN-cached.
 */
export default function HeaderAuthSlot() {
  const [user, setUser] = useState<SessionUser>(undefined);

  useEffect(() => {
    let alive = true;
    loadSession().then((u) => {
      if (alive) setUser(u);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!user?.role) {
    return (
      <Link
        href="/signin"
        className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <Link
        href="/dashboard"
        className="link-underline text-sm font-medium text-[#101114]/80 transition-colors duration-200 hover:text-[#101114]"
      >
        Dashboard
      </Link>
      <ProfileMenu role={user.role} email={user.email} />
    </div>
  );
}
