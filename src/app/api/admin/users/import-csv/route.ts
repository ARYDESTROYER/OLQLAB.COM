import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import {
  hasTenantSeatCapacity,
  lockTenantSeatInventory,
} from "@/lib/tenant-seat-lock";
import { isSchemaCompatibilityError } from "@/lib/prisma-errors";

const MAX_CSV_INPUT_BYTES = 1024 * 1024;
const MAX_IMPORT_ROWS = 1_000;
const MAX_EMAIL_LENGTH = 320;
const MAX_NAME_LENGTH = 100;
const MAX_ORGANISATION_NAME_LENGTH = 160;
const emailSchema = z.string().trim().email().max(MAX_EMAIL_LENGTH);

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
    | "seat_limit_reached"
    | "invalid_name"
    | "invalid_manager";
  message: string;
};

type CandidateRow = {
  rowNumber: number;
  email: string;
  firstName: string;
  lastName: string;
  managerEmail: string;
  soloOrganisationName: string;
};

type PlannedRow = PreviewRow & {
  tenantId: string;
  managerId: string | null;
  existingUserId: string | null;
  needsSeat: boolean;
};

type ImportPlan = {
  previewRows: PreviewRow[];
  issues: ImportIssue[];
  plannedRows: PlannedRow[];
};

type ImportReadClient = Pick<Prisma.TransactionClient, "seat" | "tenant" | "user">;

class ImportStateError extends Error {
  constructor(
    readonly code: "ORGANISATION_NOT_FOUND" | "ORGANISATION_ARCHIVED" | "INVALID_ORGANISATION_TYPE",
    message: string,
  ) {
    super(message);
    this.name = "ImportStateError";
  }
}

function getSoloOrganisationName(record: CsvRecord, email: string) {
  return (
    record.solo_organisation_name?.trim() ||
    record.solo_organization_name?.trim() ||
    record.solo_tenant_name?.trim() ||
    `Solo - ${email}`
  );
}

async function getTargetOrganization(client: ImportReadClient, tenantId: string) {
  try {
    return await client.tenant.findUnique({
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

    const legacyTenant = await client.tenant.findUnique({
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

function normalizeRows(records: CsvRecord[], mode: ImportMode) {
  const candidates: CandidateRow[] = [];
  const issues: ImportIssue[] = [];
  const seenEmails = new Set<string>();

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    const email = record.email ? normalizeEmail(record.email) : "";
    const firstName = record.first_name?.trim() || "";
    const lastName = record.last_name?.trim() || "";
    const managerEmail = record.manager_email ? normalizeEmail(record.manager_email) : "";
    const soloOrganisationName = getSoloOrganisationName(record, email);

    if (!emailSchema.safeParse(email).success) {
      issues.push({
        rowNumber,
        email: record.email?.trim() || "",
        reason: "invalid_email",
        message: "Email is missing or invalid.",
      });
      continue;
    }
    if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
      issues.push({
        rowNumber,
        email,
        reason: "invalid_name",
        message: `Names must be ${MAX_NAME_LENGTH} characters or fewer.`,
      });
      continue;
    }
    if (
      mode === "SOLO" &&
      (!soloOrganisationName || soloOrganisationName.length > MAX_ORGANISATION_NAME_LENGTH)
    ) {
      issues.push({
        rowNumber,
        email,
        reason: "invalid_name",
        message: `Solo Organisation names must be between 1 and ${MAX_ORGANISATION_NAME_LENGTH} characters.`,
      });
      continue;
    }
    if (mode === "SOLO" && managerEmail) {
      issues.push({
        rowNumber,
        email,
        reason: "invalid_manager",
        message: "Solo participants cannot be assigned an Organisation manager.",
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
    candidates.push({
      rowNumber,
      email,
      firstName,
      lastName,
      managerEmail,
      soloOrganisationName,
    });
  }

  return { candidates, issues };
}

async function buildImportPlan(input: {
  client: ImportReadClient;
  records: CsvRecord[];
  mode: ImportMode;
  tenantId?: string;
}): Promise<ImportPlan> {
  const normalized = normalizeRows(input.records, input.mode);
  const issues = [...normalized.issues];
  const plannedRows: PlannedRow[] = [];
  const emails = normalized.candidates.map((row) => row.email);
  const existingUsers = emails.length
    ? await input.client.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true, tenantId: true },
      })
    : [];
  const usersByEmail = new Map(existingUsers.map((user) => [user.email, user]));

  if (input.mode === "SOLO") {
    for (const row of normalized.candidates) {
      if (usersByEmail.has(row.email)) {
        issues.push({
          rowNumber: row.rowNumber,
          email: row.email,
          reason: "already_exists",
          message: "This email already belongs to an existing user and cannot be imported as solo.",
        });
        continue;
      }

      plannedRows.push({
        ...row,
        targetName: row.soloOrganisationName,
        action: "CREATE_SOLO_USER",
        tenantId: crypto.randomUUID(),
        managerId: null,
        existingUserId: null,
        needsSeat: true,
      });
    }

    return {
      previewRows: plannedRows,
      issues,
      plannedRows,
    };
  }

  if (!input.tenantId) {
    throw new ImportStateError("ORGANISATION_NOT_FOUND", "Organisation is required.");
  }
  const targetOrganization = await getTargetOrganization(input.client, input.tenantId);
  if (!targetOrganization) {
    throw new ImportStateError("ORGANISATION_NOT_FOUND", "Organisation not found.");
  }
  if (targetOrganization.isArchived) {
    throw new ImportStateError(
      "ORGANISATION_ARCHIVED",
      "Organisation is archived. Restore it before importing users.",
    );
  }
  if (targetOrganization.type !== "ORGANIZATION") {
    throw new ImportStateError(
      "INVALID_ORGANISATION_TYPE",
      "Bulk organisation import only supports shared organisations.",
    );
  }

  const [existingSeats, managers, currentSeatCount] = await Promise.all([
    emails.length
      ? input.client.seat.findMany({
          where: {
            tenantId: input.tenantId,
            userEmail: { in: emails },
          },
          select: { userEmail: true },
        })
      : [],
    normalized.candidates.some((row) => row.managerEmail)
      ? input.client.user.findMany({
          where: {
            tenantId: input.tenantId,
            role: "LEADER",
            email: {
              in: normalized.candidates
                .map((row) => row.managerEmail)
                .filter(Boolean),
            },
          },
          select: { id: true, email: true },
        })
      : [],
    input.client.seat.count({ where: { tenantId: input.tenantId } }),
  ]);
  const seatEmails = new Set(existingSeats.map((seat) => seat.userEmail));
  const managersByEmail = new Map(managers.map((manager) => [manager.email, manager]));
  let projectedSeatCount = currentSeatCount;

  for (const row of normalized.candidates) {
    const existingUser = usersByEmail.get(row.email);
    if (existingUser && existingUser.tenantId !== input.tenantId) {
      issues.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: "belongs_to_other_organisation",
        message: "This email already belongs to a different organisation.",
      });
      continue;
    }

    const manager = row.managerEmail ? managersByEmail.get(row.managerEmail) : null;
    if (row.managerEmail && !manager) {
      issues.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: "invalid_manager",
        message: "Manager must be an existing Leader in the selected Organisation.",
      });
      continue;
    }
    if (manager?.id === existingUser?.id) {
      issues.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: "invalid_manager",
        message: "A user cannot be assigned as their own manager.",
      });
      continue;
    }

    const existingSeat = seatEmails.has(row.email);
    if (existingSeat && existingUser) {
      issues.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: "duplicate",
        message: "This user already exists in the selected organisation.",
      });
      continue;
    }

    const needsSeat = !existingSeat;
    const repairingExistingUser = Boolean(existingUser);
    if (
      !hasTenantSeatCapacity({
        seatLimit: targetOrganization.seatLimit,
        currentSeatCount: projectedSeatCount,
        hasExistingSeat: existingSeat,
      })
    ) {
      issues.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: "seat_limit_reached",
        message: `Seat limit reached for ${targetOrganization.name}.`,
      });
      continue;
    }

    if (needsSeat) projectedSeatCount += 1;
    plannedRows.push({
      ...row,
      targetName: targetOrganization.name,
      action: repairingExistingUser
        ? "REPAIR_ORGANIZATION_USER"
        : "CREATE_ORGANIZATION_USER",
      tenantId: input.tenantId,
      managerId: manager?.id || null,
      existingUserId: existingUser?.id || null,
      needsSeat,
    });
  }

  return {
    previewRows: plannedRows,
    issues,
    plannedRows,
  };
}

function importSummary(mode: ImportMode, records: CsvRecord[], plan: ImportPlan) {
  return {
    mode,
    requestedCount: records.length,
    readyCount: plan.plannedRows.length,
    skippedCount: plan.issues.length,
    createdCount: plan.plannedRows.filter((row) => row.action !== "REPAIR_ORGANIZATION_USER").length,
    repairedCount: plan.plannedRows.filter((row) => row.action === "REPAIR_ORGANIZATION_USER").length,
  };
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
  const tenantId = body.tenantId?.trim();
  const csvText = body.csvText?.trim();
  if (!csvText) {
    return NextResponse.json({ error: "CSV content is required." }, { status: 400 });
  }
  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_INPUT_BYTES) {
    return NextResponse.json(
      { error: "CSV content exceeds the 1 MB import limit." },
      { status: 413 },
    );
  }
  if (mode === "ORGANIZATION" && !tenantId) {
    return NextResponse.json({ error: "Organisation is required." }, { status: 400 });
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
  if (records.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `CSV cannot contain more than ${MAX_IMPORT_ROWS} data rows.` },
      { status: 413 },
    );
  }

  try {
    if (dryRun) {
      const plan = await buildImportPlan({ client: db, records, mode, tenantId });
      return NextResponse.json({
        summary: importSummary(mode, records, plan),
        previewRows: plan.previewRows.slice(0, 25),
        issues: plan.issues.slice(0, 50),
      });
    }

    const result = await db.$transaction(
      async (tx) => {
        if (mode === "ORGANIZATION" && tenantId) {
          await lockTenantSeatInventory(tx, tenantId);
        }
        const plan = await buildImportPlan({ client: tx, records, mode, tenantId });
        const soloRows = plan.plannedRows.filter(
          (row) => row.action === "CREATE_SOLO_USER",
        );
        const newUsers = plan.plannedRows.filter((row) => !row.existingUserId);
        const repairs = plan.plannedRows.filter(
          (row): row is PlannedRow & { existingUserId: string } => Boolean(row.existingUserId),
        );
        const seats = plan.plannedRows.filter((row) => row.needsSeat);

        if (soloRows.length) {
          await tx.tenant.createMany({
            data: soloRows.map((row) => ({
              id: row.tenantId,
              name: row.targetName,
              type: "SOLO",
              seatLimit: 1,
            })),
          });
        }
        if (seats.length) {
          await tx.seat.createMany({
            data: seats.map((row) => ({
              tenantId: row.tenantId,
              userEmail: row.email,
              assigned: false,
            })),
          });
        }
        if (newUsers.length) {
          await tx.user.createMany({
            data: newUsers.map((row) => ({
              email: row.email,
              firstName: row.firstName,
              lastName: row.lastName,
              role: "EMPLOYEE",
              tenantId: row.tenantId,
              managerId: row.managerId,
            })),
          });
        }
        for (const row of repairs) {
          await tx.user.update({
            where: { id: row.existingUserId },
            data: {
              firstName: row.firstName || undefined,
              lastName: row.lastName || undefined,
              managerId: row.managerId,
            },
          });
        }

        const summary = importSummary(mode, records, plan);
        await recordAuditLog(
          {
            tenantId: tenantId || check.liveUser.tenantId,
            actorId: check.liveUser.id,
            action: "admin.user.csv_imported",
            metadata: {
              ...summary,
              transactionMode: "ALL_OR_NOTHING",
            },
          },
          tx,
        );

        return {
          summary,
          created: plan.plannedRows
            .filter((row) => row.action !== "REPAIR_ORGANIZATION_USER")
            .map((row) => row.email),
          repaired: repairs.map((row) => row.email),
          issues: plan.issues.slice(0, 50),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 30_000,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImportStateError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "ORGANISATION_NOT_FOUND" ? 404 : 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return NextResponse.json(
        {
          error:
            "The import state changed concurrently. No rows were imported; refresh the preview and retry.",
          code: "IMPORT_CONFLICT",
          committed: false,
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
