import { NextRequest, NextResponse } from "next/server";
import { addDays } from "date-fns";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { getResend } from "@/lib/resend";
import { getEnv } from "@/lib/env";

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const env = getEnv();
  const resend = getResend();
  const { tenantId } = (await req.json()) as { tenantId: string };

  const seats = await db.seat.findMany({ where: { tenantId, assigned: false } });

  for (const seat of seats) {
    const token = crypto.randomBytes(24).toString("hex");
    await db.invite.create({
      data: {
        tenantId,
        email: seat.userEmail,
        token,
        expiresAt: addDays(new Date(), 7),
      },
    });

    const signInUrl = `${env.NEXTAUTH_URL || "http://localhost:3000"}/signin?email=${encodeURIComponent(
      seat.userEmail,
    )}`;

    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: seat.userEmail,
      subject: "You are invited to complete your personality assessment",
      html: `<p>You are invited to complete your assessment.</p><p><a href="${signInUrl}">Start</a></p>`,
    });
  }

  return NextResponse.json({ invited: seats.length });
}
