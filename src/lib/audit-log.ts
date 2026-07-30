import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type AuditLogClient = Pick<Prisma.TransactionClient, "auditLog">;

type AuditLogInput = {
  tenantId: string;
  actorId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
};

export async function recordAuditLog(
  input: AuditLogInput,
  client: AuditLogClient = db,
) {
  return client.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId || null,
      action: input.action,
      metadata: JSON.stringify(input.metadata || {}),
    },
  });
}
