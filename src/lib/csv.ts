export type CsvValue = string | number | boolean | Date | null | undefined;
export type CsvRow = CsvValue[];

function escapeCsvValue(value: CsvValue) {
  if (value === null || typeof value === "undefined") return "";

  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "boolean"
        ? (value ? "true" : "false")
        : String(value);

  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function buildCsv(headers: string[], rows: CsvRow[]) {
  const lines = [headers.map((item) => escapeCsvValue(item)).join(",")];

  for (const row of rows) {
    lines.push(row.map((item) => escapeCsvValue(item)).join(","));
  }

  return `${lines.join("\n")}\n`;
}
