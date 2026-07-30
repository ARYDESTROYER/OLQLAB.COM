export type LocalDateTimeStyle = "medium" | "long";

export function formatLocalDateTime(
  input: string | number | Date | null | undefined,
  options: {
    fallback?: string;
    dateStyle?: LocalDateTimeStyle;
  } = {},
) {
  const fallback = options.fallback || "Not available";
  if (input === null || input === undefined || input === "") return fallback;

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: options.dateStyle === "medium" ? "short" : "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
