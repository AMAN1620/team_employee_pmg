// Sign-in: accounts with scrypt-hashed passwords, and a signed session cookie ("person.expiry.signature") so a
// cookie can't be edited to become someone else. The signing key comes from PMG_SESSION_SECRET, or is created
// once in data/.session-secret (tests use a key made for the run).
import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pmg_session";
export const SESSION_DAYS = 7;

let key: Buffer | undefined;
function sessionKey(): Buffer {
  if (key) return key;
  if (process.env.PMG_SESSION_SECRET) return (key = Buffer.from(process.env.PMG_SESSION_SECRET));
  if (process.env.PMG_DB_PATH === ":memory:") return (key = randomBytes(32));
  const file = path.join(process.cwd(), "data", ".session-secret");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  }
  return (key = Buffer.from(fs.readFileSync(file, "utf8").trim()));
}

const sign = (payload: string) => createHmac("sha256", sessionKey()).update(payload).digest("base64url");

/** The cookie value for a signed-in person, valid for a week from `at` (ms). */
export function signSession(personId: string, at = Date.now()): string {
  const payload = `${personId}.${at + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${sign(payload)}`;
}

/** The person a cookie belongs to, or null when it's missing, edited or expired. */
export function verifySession(value: string | undefined | null, at = Date.now()): string | null {
  const m = value?.match(/^([a-z][a-z0-9_-]{0,31})\.(\d{10,16})\.([A-Za-z0-9_-]{43})$/);
  if (!m) return null;
  const expected = Buffer.from(sign(`${m[1]}.${m[2]}`)), given = Buffer.from(m[3]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return Number(m[2]) > at ? m[1] : null;
}

/** "scrypt$salt$hash", both hex. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 32), expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Checked against when the email is unknown, so a wrong email takes as long as a wrong password. */
export const DECOY_HASH = "scrypt$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

/** The demo accounts. Dummy passwords for the prototype; real ones would come from company sign-in. */
export const DEMO_ACCOUNTS = [
  { personId: "aman", email: "aman@acmelabs.in", password: "Aman@2026" },
  { personId: "venkatesh", email: "venkatesh@acmelabs.in", password: "Venkatesh@2026" },
  { personId: "kanika", email: "kanika@acmelabs.in", password: "Kanika@2026" },
  { personId: "priya", email: "priya@acmelabs.in", password: "Priya@2026" },
  { personId: "rupam", email: "rupam@acmelabs.in", password: "Rupam@2026" },
] as const;
