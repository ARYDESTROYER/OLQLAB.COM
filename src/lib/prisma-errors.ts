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

export function isMissingColumnError(error: unknown, columnName?: string) {
  if (!isPrismaKnownRequestError(error)) return false;
  if (error.code !== "P2022") return false;
  if (!columnName) return true;

  const column = String(
    (error.meta as { column?: unknown } | undefined)?.column ?? "",
  ).toLowerCase();

  return column.includes(columnName.toLowerCase());
}

export function isSchemaCompatibilityError(error: unknown) {
  return isMissingTableError(error) || isMissingColumnError(error);
}
