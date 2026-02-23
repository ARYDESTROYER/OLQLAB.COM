import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const body = await req.json();
  const { tenantId, csvText } = body as { tenantId: string; csvText: string };
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<{
    email: string;
    first_name: string;
    last_name: string;
    manager_email?: string;
  }>;

  const created = [];
  const skipped = [];
  let seatCount = await db.seat.count({ where: { tenantId } });

  for (const row of records) {
    const email = row.email?.toLowerCase();
    if (!email || !email.includes("@")) {
      skipped.push({ email: row.email, reason: "invalid_email" });
      continue;
    }

    const existingSeat = await db.seat.findUnique({
      where: { tenantId_userEmail: { tenantId, userEmail: email } },
    });

    if (existingSeat) {
      skipped.push({ email, reason: "duplicate" });
      continue;
    }

    if (seatCount >= tenant.seatLimit) {
      skipped.push({ email, reason: "seat_limit_reached" });
      continue;
    }

    await db.seat.create({
      data: { tenantId, userEmail: email },
    });
    seatCount += 1;

    const manager = row.manager_email
      ? await db.user.findFirst({
          where: {
            email: row.manager_email.toLowerCase(),
            tenantId,
          },
        })
      : null;

    await db.user.upsert({
      where: { email },
      create: {
        email,
        firstName: row.first_name || "Employee",
        lastName: row.last_name || "User",
        role: "EMPLOYEE",
        tenantId,
        managerId: manager?.id,
      },
      update: {
        firstName: row.first_name || undefined,
        lastName: row.last_name || undefined,
        tenantId,
        managerId: manager?.id,
      },
    });

    created.push(email);
  }

  return NextResponse.json({ createdCount: created.length, created, skipped });
}
