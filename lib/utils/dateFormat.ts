import { format, parseISO } from "date-fns";

export function safeFormatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr as string);
    if (isNaN(date.getTime())) return "—";

    const diffMs    = Date.now() - date.getTime();
    const diffMins  = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays  = Math.floor(diffMs / 86_400_000);

    if (diffMins  <  1) return "Just now";
    if (diffMins  < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays  <  7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function safeFormat(
  dateStr: string | Date | null | undefined,
  formatStr: string,
  fallback = "—"
): string {
  if (!dateStr) return fallback;
  try {
    const date = typeof dateStr === "string" ? parseISO(dateStr) : dateStr;
    if (isNaN(date.getTime())) return fallback;
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}
