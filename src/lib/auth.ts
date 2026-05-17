import { cache } from "react";
import { getServerSession, type NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { getResend } from "@/lib/resend";
import {
  formatMagicLinkExpiryLabel,
  getAuthSignInSettings,
  getDefaultAuthSignInSettings,
  renderSignInEmailTemplate,
} from "@/lib/admin-auth-settings";
import { buildMagicLinkContinueUrl } from "@/lib/magic-link-continue";

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const baseAuthAdapter = PrismaAdapter(db) as Adapter;
const createVerificationToken = baseAuthAdapter.createVerificationToken?.bind(baseAuthAdapter);

export const authOptions: NextAuthOptions = {
  adapter: {
    ...baseAuthAdapter,
    async createVerificationToken(token) {
      if (!createVerificationToken) {
        throw new Error("Auth adapter is missing createVerificationToken implementation.");
      }

      try {
        const settings = await getAuthSignInSettings();
        const expires = new Date(Date.now() + settings.magicLinkExpiryMinutes * 60_000);
        return await createVerificationToken({ ...token, expires });
      } catch (error) {
        console.error("Failed to apply dynamic sign-in token expiry. Using fallback expiry.", error);
        const fallback = getDefaultAuthSignInSettings();
        const expires = new Date(Date.now() + fallback.magicLinkExpiryMinutes * 60_000);
        return await createVerificationToken({ ...token, expires });
      }
    },
  },
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const existingUser = await db.user.findUnique({
          where: { email: identifier.toLowerCase() },
          select: {
            firstName: true,
            lastName: true,
          },
        });
        const fullName =
          `${existingUser?.firstName || ""} ${existingUser?.lastName || ""}`.trim() || "there";
        const safeFullName = escapeHtml(fullName);
        const firstName = (existingUser?.firstName || "there").trim() || "there";
        const lastName = (existingUser?.lastName || "").trim();

        const settings = await getAuthSignInSettings().catch((error) => {
          console.error("Failed to load auth sign-in settings for email rendering.", error);
          return getDefaultAuthSignInSettings();
        });
        const expiryLabel = formatMagicLinkExpiryLabel(settings.magicLinkExpiryMinutes);
        const continueSignInUrl = buildMagicLinkContinueUrl({
          verificationUrl: url,
          email: identifier,
        });

        const renderedSubject = renderSignInEmailTemplate({
          template: settings.emailSubjectTemplate,
          firstName,
          lastName,
          fullName,
          magicLinkUrl: continueSignInUrl,
          expiryLabel,
        });
        const renderedText = renderSignInEmailTemplate({
          template: settings.emailTextTemplate,
          firstName,
          lastName,
          fullName,
          magicLinkUrl: continueSignInUrl,
          expiryLabel,
        });
        const renderedHtml = renderSignInEmailTemplate({
          template: settings.emailHtmlTemplate,
          firstName: escapeHtml(firstName),
          lastName: escapeHtml(lastName),
          fullName: safeFullName,
          magicLinkUrl: continueSignInUrl,
          expiryLabel: escapeHtml(expiryLabel),
        });

        const resend = getResend();
        await resend.emails.send({
          from: provider.from as string,
          to: identifier,
          subject: renderedSubject,
          text: renderedText,
          html: renderedHtml,
        });
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();
      const existingUser = await db.user.findUnique({
        where: { email },
      });
      if (!existingUser) return false;

      const invitedSeat = await db.seat.findUnique({
        where: {
          tenantId_userEmail: {
            tenantId: existingUser.tenantId,
            userEmail: email,
          },
        },
      });
      if (!invitedSeat) return false;

      if (!invitedSeat.assigned) {
        await db.seat.update({
          where: {
            tenantId_userEmail: {
              tenantId: existingUser.tenantId,
              userEmail: email,
            },
          },
          data: { assigned: true },
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      // First call after sign-in: `user` is the freshly authenticated User row.
      // Fetch role/tenantId/firstName/lastName once and bake them into the JWT
      // so subsequent reads (every authenticated page render) don't hit the DB.
      if (user?.id) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            tenantId: true,
            firstName: true,
            lastName: true,
          },
        });
        token.sub = user.id;
        token.role = dbUser?.role || "EMPLOYEE";
        token.tenantId = dbUser?.tenantId || "";
        token.firstName = dbUser?.firstName || "";
        token.lastName = dbUser?.lastName || "";
      }
      return token;
    },
    async session({ session, token }) {
      // Decode the signed JWT into the session object. Pure in-memory work,
      // no DB roundtrip. Token claims are populated in the `jwt` callback above
      // at sign-in time. Role changes in the database do NOT propagate until the
      // user signs out + back in (documented trade-off of jwt session strategy).
      if (session.user && token) {
        session.user.id = (token.sub as string) || "";
        session.user.role = (token.role as "ADMIN" | "EMPLOYEE" | "LEADER") || "EMPLOYEE";
        session.user.tenantId = (token.tenantId as string) || "";
        session.user.firstName = (token.firstName as string) || "";
        session.user.lastName = (token.lastName as string) || "";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Wrapped in React's `cache()` so multiple calls within the same request
// (e.g. (app)/layout.tsx + page.tsx) dedupe to one underlying invocation.
// Pairs with the jwt session strategy above: session reads are now pure
// cookie-decode in the warm path, and cache() ensures we don't even repeat
// the cookie-decode within a single render.
export const getServerAuthSession = cache(() => getServerSession(authOptions));
