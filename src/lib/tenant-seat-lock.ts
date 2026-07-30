import { Prisma } from "@prisma/client";

export async function lockTenantSeatInventory(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtext(${`olq-tenant-seat-inventory:${tenantId}`})
    ) IS NULL AS "lockResult"
  `);
}

export function hasTenantSeatCapacity(input: {
  seatLimit: number;
  currentSeatCount: number;
  hasExistingSeat: boolean;
}) {
  return input.hasExistingSeat || input.currentSeatCount < input.seatLimit;
}
