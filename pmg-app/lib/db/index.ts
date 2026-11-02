import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCHEMA, SCHEMA_VERSION } from "./schema";
import { seed } from "./seed";

type Row = Record<string, unknown>;
type Param = string | number | null | bigint;

const g = globalThis as unknown as { __pmgDb?: DatabaseSync };

function dbPath(): string {
  return process.env.PMG_DB_PATH ?? path.join(process.cwd(), "data", "pmg.db");
}

function open(): DatabaseSync {
  const file = dbPath();
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  const seeded = (db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'people'").get() as { n: number }).n > 0
    && (db.prepare("SELECT COUNT(*) AS n FROM people").get() as { n: number }).n > 0;
  if (!seeded || user_version < SCHEMA_VERSION) {
    // Demo data from an older version: keep a copy, then start over with the current schema.
    if (seeded && file !== ":memory:") {
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      fs.copyFileSync(file, `${file}.v${user_version}.bak`);
      console.warn(`[pmg] Demo database was from an older version; saved a copy as ${file}.v${user_version}.bak and re-seeded.`);
    }
    reseed(db);
  }
  return db;
}

/** Where files attached to goal comments are kept: next to the database (a temp folder for in-memory tests). */
export function uploadsDir(): string {
  if (process.env.PMG_UPLOADS_DIR) return process.env.PMG_UPLOADS_DIR;
  const file = dbPath();
  return file === ":memory:" ? path.join(os.tmpdir(), "pmg-test-uploads") : path.join(path.dirname(file), "uploads");
}

function reseed(d: DatabaseSync): void {
  const tables = (d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
  d.exec("PRAGMA foreign_keys = OFF;");
  for (const t of tables) d.exec(`DROP TABLE IF EXISTS ${t};`);
  d.exec("PRAGMA foreign_keys = ON;");
  d.exec(SCHEMA);
  if (dbPath() !== ":memory:") fs.rmSync(uploadsDir(), { recursive: true, force: true }); // their comments are gone too
  seed(d);
  d.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export function db(): DatabaseSync {
  if (!g.__pmgDb) g.__pmgDb = open();
  return g.__pmgDb;
}

/** Drop all data and re-seed the demo company. */
export function resetDb(): void {
  reseed(db());
}

export function all<T = Row>(sql: string, ...params: Param[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function get<T = Row>(sql: string, ...params: Param[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: Param[]): number {
  const r = db().prepare(sql).run(...params);
  return Number(r.lastInsertRowid);
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
