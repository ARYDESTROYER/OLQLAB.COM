import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "ADMIN" | "EMPLOYEE" | "LEADER";
      tenantId: string;
      firstName: string;
      lastName: string;
    };
  }
}

declare module "next-auth/jwt" {
  // Claims baked into the signed JWT cookie by the `jwt` callback in
  // `src/lib/auth.ts`. Optional because NextAuth itself sets `sub`/`name`/
  // `email` and we layer our domain fields on top; the `session` callback
  // applies safe fallbacks.
  interface JWT {
    sub?: string;
    role?: "ADMIN" | "EMPLOYEE" | "LEADER";
    tenantId?: string;
    firstName?: string;
    lastName?: string;
  }
}
