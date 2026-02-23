import { getServerSession, type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { getResend } from "@/lib/resend";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const resend = getResend();
        await resend.emails.send({
          from: provider.from as string,
          to: identifier,
          subject: "Your sign-in link",
          html: `<p>Sign in to continue:</p><p><a href="${url}">Sign in</a></p>`,
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
      const invitedSeat = await db.seat.findFirst({
        where: { userEmail: user.email.toLowerCase() },
      });
      return Boolean(invitedSeat);
    },
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await db.user.findUnique({ where: { id: user.id } });
        session.user.id = user.id;
        session.user.role = dbUser?.role || "EMPLOYEE";
        session.user.tenantId = dbUser?.tenantId || "";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}
