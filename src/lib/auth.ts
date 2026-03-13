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
  session: { strategy: "database" },
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

        const renderedSubject = renderSignInEmailTemplate({
          template: settings.emailSubjectTemplate,
          firstName,
          lastName,
          fullName,
          magicLinkUrl: url,
          expiryLabel,
        });
        const renderedText = renderSignInEmailTemplate({
          template: settings.emailTextTemplate,
          firstName,
          lastName,
          fullName,
          magicLinkUrl: url,
          expiryLabel,
        });
        const renderedHtml = renderSignInEmailTemplate({
          template: settings.emailHtmlTemplate,
          firstName: escapeHtml(firstName),
          lastName: escapeHtml(lastName),
          fullName: safeFullName,
          magicLinkUrl: url,
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
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            tenantId: true,
            firstName: true,
            lastName: true,
          },
        });
        session.user.id = user.id;
        session.user.role = dbUser?.role || "EMPLOYEE";
        session.user.tenantId = dbUser?.tenantId || "";
        session.user.firstName = dbUser?.firstName || "";
        session.user.lastName = dbUser?.lastName || "";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
