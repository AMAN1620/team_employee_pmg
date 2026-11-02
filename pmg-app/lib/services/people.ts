import { get, run } from "@/lib/db";
import { listPeople, listTeams } from "@/lib/repo";

export type ImportRow = { name: string; email: string; team: string; manager_email: string; role: string };
export type ImportPreview = { file: string; mapping: [string, string, boolean][]; rows: ImportRow[]; ready: ImportRow[]; issues: string[] };

const FIELDS: Record<string, string> = { name: "Name", email: "Email", team: "Team", manager_email: "Manager", role: "PMG role" };

/** Minimal CSV parser: commas, quoted fields with escaped quotes, header row. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

export function buildPreview(file: string, text: string): ImportPreview {
  const records = parseCsv(text);
  const cols = Object.keys(records[0] ?? {});
  const mapping = Object.keys(FIELDS).map((k) => [k, FIELDS[k], cols.includes(k)] as [string, string, boolean]);
  const rows = records.map((r) => ({ name: r.name ?? "", email: (r.email ?? "").toLowerCase(), team: r.team ?? "", manager_email: (r.manager_email ?? "").toLowerCase(), role: (r.role ?? "employee").toLowerCase() }));
  const emails = new Set([...listPeople().map((p) => p.email), ...rows.map((r) => r.email)]);
  const issues: string[] = [];
  const ready = rows.filter((r, i) => {
    const problems = [
      !r.name && "missing name", !/^[^@\s]+@[^@\s]+$/.test(r.email) && "invalid email",
      !r.manager_email && r.role !== "hr" && "missing manager", r.manager_email && !emails.has(r.manager_email) && "manager not found",
      !["employee", "manager", "hr"].includes(r.role) && `unknown role “${r.role}”`,
    ].filter(Boolean);
    if (problems.length) issues.push(`Row ${i + 2} (${r.name || r.email || "blank"}): ${problems.join(", ")}`);
    return problems.length === 0;
  });
  return { file, mapping, rows, ready, issues };
}

/** Adds or updates people from preview rows. Unknown teams are created. Returns how many were imported. */
export function importRows(rows: ImportRow[]): number {
  const teams = listTeams();
  const people = listPeople();
  let n = 0;
  for (const r of rows) {
    let team = teams.find((t) => t.name.toLowerCase() === r.team.toLowerCase() || t.id === r.team.toLowerCase());
    if (!team && r.team) {
      const id = r.team.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      run("INSERT OR IGNORE INTO teams (id,name,headcount) VALUES (?,?,0)", id, r.team);
      team = { id, name: r.team, headcount: 0, self_done_base: 0, mgr_done_base: 0 };
      teams.push(team);
    }
    const manager = people.find((p) => p.email === r.manager_email) ?? get<{ id: string }>("SELECT id FROM people WHERE email = ?", r.manager_email);
    const id = r.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30) || `p${Date.now()}`;
    run(`INSERT INTO people (id,name,title,team_id,manager_id,role,email) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, team_id = excluded.team_id, manager_id = excluded.manager_id, role = excluded.role`,
      id, r.name, r.role === "manager" ? "Manager" : r.role === "hr" ? "HR" : "Team member", team?.id ?? "people", manager?.id ?? null, r.role, r.email);
    n++;
  }
  return n;
}

// Previews live in memory between the upload and the confirm click.
const g = globalThis as unknown as { __pmgImports?: Map<string, ImportPreview> };
g.__pmgImports ??= new Map();
export function storeImportPreview(p: ImportPreview): string {
  const token = Math.random().toString(36).slice(2, 10);
  g.__pmgImports!.set(token, p);
  return token;
}
export function getImportPreview(token: string): ImportPreview | null {
  return g.__pmgImports!.get(token) ?? null;
}
