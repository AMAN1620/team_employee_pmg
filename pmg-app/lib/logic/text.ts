const STOP = new Set(
  "a an the and or but of for to in on at by with from into is are was were be been it its this that these those i im i'm we our my me you your still also need needs needed waiting wait on for once have has had get got went up down so as than then there their them they".split(" "),
);

/** Lowercase content words with hyphens split, for rough keyword matching. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .split(" ")
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));
}

export function overlap(a: string, b: string): number {
  const bs = new Set(tokens(b));
  return new Set(tokens(a).filter((t) => bs.has(t))).size;
}

export function sentences(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim().replace(/[.!?]+$/, "")).filter(Boolean);
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
