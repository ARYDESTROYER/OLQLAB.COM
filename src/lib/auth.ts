import { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { getResend } from "@/lib/resend";

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
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
        const resend = getResend();
        await resend.emails.send({
          from: provider.from as string,
          to: identifier,
          subject: "Your OLQLab Sign in link",
          text: `Hey ${fullName}, click here to sign in to your OLQLab account: ${url}\n\nIf you did not request this link, you may safely ignore this email.\n\nGood day.\n\nRegards\nOLQLab Admin.`,
          html: `<p>Hey ${safeFullName}, <a href="${url}">click here</a> to sign in to your OLQLab account.</p><p>If you did not request this link, you may safely ignore this email.</p><p>Good day.</p><p>Regards<br />OLQLab Admin.</p>`,
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
