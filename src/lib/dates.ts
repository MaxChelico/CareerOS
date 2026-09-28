// Dates are stored as local-time strings: "YYYY-MM-DD" for days, "YYYY-MM-DDTHH:mm" for times.

export function today(): string {
  return localIso(new Date()).slice(0, 10);
}

export function now(): string {
  return localIso(new Date());
}

function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Parse as local time (plain "YYYY-MM-DD" would otherwise be read as UTC midnight).
function parse(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00` : value);
}

export function daysSince(value: string): number {
  return Math.floor((Date.now() - parse(value).getTime()) / 86_400_000);
}

export function formatDate(value: string): string {
  return parse(value).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export function formatDateTime(value: string): string {
  return parse(value).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
