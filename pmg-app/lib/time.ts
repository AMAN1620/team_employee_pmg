// The prototype runs on a fixed demo date so every screen matches the Stitch designs.
export const QUARTER_START = "2026-10-01";
export const QUARTER_END = "2026-12-31";

export function today(): string {
  return process.env.PMG_DEMO_DATE ?? "2026-10-29";
}

/** Demo date plus the real time of day, e.g. "2026-10-29T10:12". */
export function now(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${today()}T${hh}:${mm}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(toIso.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Share of the period between start and end that has passed on `on` (0..1). */
export function elapsedFraction(start: string, end: string, on: string): number {
  const total = daysBetween(start, end);
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, daysBetween(start, on) / total));
}

export function weekStart(iso: string): string {
  const d = new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z"));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(iso, -dow);
}

export function isWorkday(iso: string): boolean {
  const dow = new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z")).getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** The working day on which `n` working days of effort starting on `from` end: 1 day from Monday ends Monday. */
export function addWorkdays(from: string, n: number): string {
  let d = from.slice(0, 10);
  while (!isWorkday(d)) d = addDays(d, 1);
  for (let left = Math.max(1, Math.round(n)) - 1; left > 0;) {
    d = addDays(d, 1);
    if (isWorkday(d)) left--;
  }
  return d;
}

export const nextWorkday = (iso: string) => addWorkdays(addDays(iso, 1), 1);
