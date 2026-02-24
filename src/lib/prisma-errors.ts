import { Prisma } from "@prisma/client";

export function isPrismaKnownRequestError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function isMissingTableError(error: unknown, tableName?: string) {
  if (!isPrismaKnownRequestError(error)) return false;
  if (error.code !== "P2021") return false;
  if (!tableName) return true;

  const table = String(
    (error.meta as { table?: unknown } | undefined)?.table ?? "",
  ).toLowerCase();

  return table.includes(tableName.toLowerCase());
}
