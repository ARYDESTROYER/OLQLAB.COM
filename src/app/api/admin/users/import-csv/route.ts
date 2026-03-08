import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type ImportMode = "ORGANIZATION" | "SOLO";

type CsvRecord = {
  email?: string;
  first_name?: string;
  last_name?: string;
  manager_email?: string;
  solo_organisation_name?: string;
  solo_organization_name?: string;
  solo_tenant_name?: string;
};

type PreviewRow = {
  rowNumber: number;
  email: string;
  firstName: string;
  lastName: string;
  managerEmail: string;
  targetName: string;
  action: "CREATE_ORGANIZATION_USER" | "REPAIR_ORGANIZATION_USER" | "CREATE_SOLO_USER";
};

type ImportIssue = {
  rowNumber: number;
  email: string;
  reason:
    | "invalid_email"
    | "duplicate_in_file"
    | "belongs_to_other_organisation"
    | "already_exists"
    | "duplicate"
    | "seat_limit_reached";
  message: string;
};

function getSoloOrganisationName(record: CsvRecord, email: string) {
  return (
    record.solo_organisation_name?.trim() ||
    record.solo_organization_name?.trim() ||
    record.solo_tenant_name?.trim() ||
    `Solo - ${email}`
  );
}

async function getTargetOrganization(tenantId: string) {
  try {
    return await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        seatLimit: true,
        isArchived: true,
        type: true,
      },
    });
  } catch (error) {
    if (!isSchemaCompatibilityError(error)) throw error;

    const legacyTenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        seatLimit: true,
      },
    });

    return legacyTenant
      ? {
          ...legacyTenant,
          isArchived: false,
          type: "ORGANIZATION" as const,
        }
      : null;
  }
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const body = (await req.json().catch(() => null)) as {
    mode?: ImportMode;
    tenantId?: string;
    csvText?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const mode: ImportMode = body.mode === "SOLO" ? "SOLO" : "ORGANIZATION";
  const csvText = body.csvText?.trim();
  if (!csvText) {
    return NextResponse.json({ error: "CSV content is required." }, { status: 400 });
  }

  const tenantId = body.tenantId?.trim();
  const targetOrganization =
    mode === "ORGANIZATION" && tenantId ? await getTargetOrganization(tenantId) : null;

  if (mode === "ORGANIZATION" && !tenantId) {
    return NextResponse.json({ error: "Organisation is required." }, { status: 400 });
  }

  if (mode === "ORGANIZATION" && !targetOrganization) {
    return NextResponse.json({ error: "Organisation not found." }, { status: 404 });
  }

  if (targetOrganization?.isArchived) {
    return NextResponse.json(
      { error: "Organisation is archived. Restore it before importing users." },
      { status: 400 },
    );
  }

  if (targetOrganization?.type === "SOLO") {
    return NextResponse.json(
      { error: "Bulk organisation import only supports shared organisations." },
      { status: 400 },
    );
  }

  let records: CsvRecord[];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRecord[];
  } catch {
    return NextResponse.json({ error: "Invalid CSV format." }, { status: 400 });
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "CSV does not contain any data rows." }, { status: 400 });
  }

  const previewRows: PreviewRow[] = [];
  const issues: ImportIssue[] = [];
  const created: string[] = [];
  const repaired: string[] = [];
  const seenEmails = new Set<string>();
  let seatCount =
    mode === "ORGANIZATION" && tenantId
      ? await db.seat.count({ where: { tenantId } })
      : 0;

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    const email = record.email ? normalizeEmail(record.email) : "";
    const firstName = record.first_name?.trim() || "";
    const lastName = record.last_name?.trim() || "";
    const managerEmail = record.manager_email ? normalizeEmail(record.manager_email) : "";

    if (!email || !email.includes("@")) {
      issues.push({
        rowNumber,
        email: record.email?.trim() || "",
        reason: "invalid_email",
        message: "Email is missing or invalid.",
      });
      continue;
    }

    if (seenEmails.has(email)) {
      issues.push({
        rowNumber,
        email,
        reason: "duplicate_in_file",
        message: "This email appears more than once in the uploaded CSV.",
      });
      continue;
    }
    seenEmails.add(email);

    if (mode === "SOLO") {
      const existingUser = await db.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        issues.push({
          rowNumber,
          email,
          reason: "already_exists",
          message: "This email already belongs to an existing user and cannot be imported as solo.",
        });
        continue;
      }

      const soloOrganisationName = getSoloOrganisationName(record, email);
      previewRows.push({
        rowNumber,
        email,
        firstName,
        lastName,
        managerEmail,
        targetName: soloOrganisationName,
        action: "CREATE_SOLO_USER",
      });

      if (dryRun) {
        continue;
      }

      let soloTenant;
      try {
        soloTenant = await db.tenant.create({
          data: {
            name: soloOrganisationName,
            type: "SOLO",
            seatLimit: 1,
          },
          select: { id: true },
        });
      } catch (error) {
        if (!isSchemaCompatibilityError(error)) throw error;
        soloTenant = await db.tenant.create({
          data: {
            name: soloOrganisationName,
            seatLimit: 1,
          },
          select: { id: true },
        });
      }

      await db.seat.create({
        data: {
          tenantId: soloTenant.id,
          userEmail: email,
          assigned: false,
        },
      });

      await db.user.create({
        data: {
          email,
          firstName,
          lastName,
          role: "EMPLOYEE",
          tenantId: soloTenant.id,
        },
      });

      created.push(email);
      continue;
    }

    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true },
    });

    if (existingUser && existingUser.tenantId !== tenantId) {
      issues.push({
        rowNumber,
        email,
        reason: "belongs_to_other_organisation",
        message: "This email already belongs to a different organisation.",
      });
      continue;
    }

    const existingSeat = await db.seat.findUnique({
      where: { tenantId_userEmail: { tenantId: tenantId!, userEmail: email } },
      select: { id: true },
    });

    if (existingSeat && existingUser) {
      issues.push({
        rowNumber,
        email,
        reason: "duplicate",
        message: "This user already exists in the selected organisation.",
      });
      continue;
    }

    const needsSeat = !existingSeat;
    const repairingExistingUser = Boolean(existingUser && existingUser.tenantId === tenantId);
    if (needsSeat && seatCount >= targetOrganization!.seatLimit && !repairingExistingUser) {
      issues.push({
        rowNumber,
        email,
        reason: "seat_limit_reached",
        message: `Seat limit reached for ${targetOrganization!.name}.`,
      });
      continue;
    }

    previewRows.push({
      rowNumber,
      email,
      firstName,
      lastName,
      managerEmail,
      targetName: targetOrganization!.name,
      action: repairingExistingUser ? "REPAIR_ORGANIZATION_USER" : "CREATE_ORGANIZATION_USER",
    });

    if (needsSeat) {
      seatCount += 1;
    }

    if (dryRun) {
      continue;
    }

    if (needsSeat) {
      await db.seat.create({
        data: { tenantId: tenantId!, userEmail: email, assigned: false },
      });
    }

    const manager = managerEmail
      ? await db.user.findFirst({
          where: {
            email: managerEmail,
            tenantId: tenantId!,
          },
          select: { id: true },
        })
      : null;

    await db.user.upsert({
      where: { email },
      create: {
        email,
        firstName,
        lastName,
        role: "EMPLOYEE",
        tenantId: tenantId!,
        managerId: manager?.id,
      },
      update: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        tenantId: tenantId!,
        managerId: manager?.id,
      },
    });

    if (repairingExistingUser) {
      repaired.push(email);
    } else {
      created.push(email);
    }
  }

  const summary = {
    mode,
    requestedCount: records.length,
    readyCount: previewRows.length,
    skippedCount: issues.length,
    createdCount: created.length,
    repairedCount: repaired.length,
  };

  if (dryRun) {
    return NextResponse.json({
      summary,
      previewRows: previewRows.slice(0, 25),
      issues: issues.slice(0, 50),
    });
  }

  return NextResponse.json({
    summary,
    created,
    repaired,
    issues: issues.slice(0, 50),
  });
}
