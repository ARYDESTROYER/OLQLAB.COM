import { cache } from "react";
import { headers } from "next/headers";
import { getServerSession, type NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { sendEmailOrThrow } from "@/lib/resend";
import { attemptMagicLinkDelivery } from "@/lib/magic-link-delivery";
import {
  formatMagicLinkExpiryLabel,
  getAuthSignInSettings,
  getDefaultAuthSignInSettings,
  renderSignInEmailTemplate,
} from "@/lib/admin-auth-settings";
import { buildMagicLinkContinueUrl } from "@/lib/magic-link-continue";
import {
  consumeMagicLinkRateLimit,
  extractClientIp,
  isMagicLinkRecipientEligible,
  resolveVerificationRequestDecision,
} from "@/lib/auth-security";

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

async function findEligibleMagicLinkRecipient(identifier: string) {
  const email = identifier.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      tenantId: true,
      tenant: {
        select: {
          type: true,
          isArchived: true,
        },
      },
    },
  });

  if (!user) return null;

  const seat = await db.seat.findUnique({
    where: {
      tenantId_userEmail: {
        tenantId: user.tenantId,
        userEmail: email,
      },
    },
    select: {
      id: true,
      assigned: true,
    },
  });

  const eligible = isMagicLinkRecipientEligible({
    hasUser: true,
    hasSeat: Boolean(seat),
    tenantArchived: user.tenant.isArchived,
    tenantType: user.tenant.type,
    role: user.role,
  });

  return eligible ? { ...user, seat } : null;
}

type VerificationRequest = {
  identifier: string;
  url: string;
  provider: {
    from: string;
  };
};

const emailFrom = process.env.EMAIL_FROM || "";

const emailProvider = {
  id: "email" as const,
  type: "email" as const,
  name: "Email" as const,
  server: "",
  from: emailFrom,
  maxAge: 24 * 60 * 60,
  options: {
    from: emailFrom,
  },
  async sendVerificationRequest({ identifier, url, provider }: VerificationRequest) {
    const email = identifier.trim().toLowerCase();
    const existingUser = await findEligibleMagicLinkRecipient(email);
    if (!existingUser) return;

    const fullName =
      `${existingUser.firstName || ""} ${existingUser.lastName || ""}`.trim() || "there";
    const safeFullName = escapeHtml(fullName);
    const firstName = (existingUser.firstName || "there").trim() || "there";
    const lastName = (existingUser.lastName || "").trim();

    const settings = await getAuthSignInSettings().catch((error) => {
      console.error("Failed to load auth sign-in settings for email rendering.", error);
      return getDefaultAuthSignInSettings();
    });
    const expiryLabel = formatMagicLinkExpiryLabel(settings.magicLinkExpiryMinutes);
    const continueSignInUrl = buildMagicLinkContinueUrl({
      verificationUrl: url,
      email,
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

    await attemptMagicLinkDelivery(() =>
      sendEmailOrThrow({
        from: provider.from,
        to: email,
        subject: renderedSubject,
        text: renderedText,
        html: renderedHtml,
      }),
    );
  },
};

export const authOptions: NextAuthOptions = {
  adapter: {
    ...baseAuthAdapter,
    async createVerificationToken(token) {
      if (!createVerificationToken) {
        throw new Error("Auth adapter is missing createVerificationToken implementation.");
      }

      // Email sign-in runs token persistence and delivery concurrently. Do the same
      // recipient eligibility check here so unknown/unseated attempts do not leave
      // usable verification-token rows behind.
      const recipient = await findEligibleMagicLinkRecipient(token.identifier);

      try {
        const settings = await getAuthSignInSettings();
        const expires = new Date(Date.now() + settings.magicLinkExpiryMinutes * 60_000);
        if (!recipient) return { ...token, expires };
        return await createVerificationToken({ ...token, expires });
      } catch (error) {
        console.error("Failed to apply dynamic sign-in token expiry. Using fallback expiry.", error);
        const fallback = getDefaultAuthSignInSettings();
        const expires = new Date(Date.now() + fallback.magicLinkExpiryMinutes * 60_000);
        if (!recipient) return { ...token, expires };
        return await createVerificationToken({ ...token, expires });
      }
    },
  },
  session: { strategy: "jwt" },
  providers: [emailProvider],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ user, email: verification }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      if (verification?.verificationRequest) {
        const requestHeaders = await headers();
        const [rateLimitPassed, recipient] = await Promise.all([
          consumeMagicLinkRateLimit({
            email,
            ip: extractClientIp(requestHeaders),
          }),
          findEligibleMagicLinkRecipient(email),
        ]);
        const recipientEligible = Boolean(recipient);

        if (!rateLimitPassed || !recipientEligible) {
          console.warn("Magic-link request suppressed before provider delivery.", {
            rateLimitPassed,
            recipientEligible,
          });
        }

        return resolveVerificationRequestDecision({
          rateLimitPassed,
          recipientEligible,
          authOrigin: process.env.NEXTAUTH_URL || "http://localhost:3000",
        });
      }

      const existingUser = await findEligibleMagicLinkRecipient(email);
      if (!existingUser) return false;

      await db.seat.updateMany({
        where: {
          tenantId: existingUser.tenantId,
          userEmail: email,
          assigned: false,
        },
        data: { assigned: true },
      });

      return true;
    },
    async jwt({ token, user }) {
      // First call after sign-in: persist identity hints in the signed JWT for
      // NextAuth compatibility and client-side display. Authorization never trusts
      // these claims alone; authenticated layouts and API guards reload the live
      // user/organisation through getLiveSession().
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
      // Decode JWT identity hints into NextAuth's session object. Callers making an
      // authorization decision must use getLiveSession()/require* so database role,
      // deletion, seat, and organisation changes take effect on the next request.
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

// Wrapped in React's `cache()` so multiple calls within one server render dedupe the
// NextAuth cookie decode. Live authorization is separately request-cached in
// src/lib/api-auth.ts.
export const getServerAuthSession = cache(() => getServerSession(authOptions));
