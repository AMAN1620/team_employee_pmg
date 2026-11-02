import { describe, expect, it } from "vitest";
import { all } from "@/lib/db";
import { parsePersona, homeFor } from "@/lib/session";
import { DEMO_ACCOUNTS, SESSION_DAYS, hashPassword, signSession, verifyPassword, verifySession } from "@/lib/auth";

describe("sign-in", () => {
  it("person ids are seed slugs only", () => {
    expect(parsePersona("anshika")).toBe("anshika");
    expect(parsePersona("")).toBeNull();
    expect(parsePersona(undefined)).toBeNull();
    expect(parsePersona("../etc")).toBeNull();
    expect(parsePersona("Robert'); DROP TABLE people;--")).toBeNull();
  });

  it("a session cookie is signed: edited or expired cookies are ignored", () => {
    const now = Date.parse("2026-10-29T10:00:00Z");
    const cookie = signSession("aman", now);
    expect(verifySession(cookie, now)).toBe("aman");
    expect(verifySession(cookie.replace(/^aman\./, "venkatesh."), now)).toBeNull();
    expect(verifySession(cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A"), now)).toBeNull();
    expect(verifySession(cookie, now + (SESSION_DAYS + 1) * 86_400_000)).toBeNull();
    expect(verifySession("aman", now)).toBeNull(); // the old plain persona cookie no longer works
    expect(verifySession(undefined, now)).toBeNull();
  });

  it("passwords are stored hashed and checked", () => {
    const h = hashPassword("Aman@2026");
    expect(h).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(hashPassword("Aman@2026")).not.toBe(h); // salted
    expect([verifyPassword("Aman@2026", h), verifyPassword("aman@2026", h), verifyPassword("", h)]).toEqual([true, false, false]);
  });

  it("the demo people have accounts; no password is stored in plain text", () => {
    const rows = all<{ person_id: string; email: string; password_hash: string }>("SELECT person_id, email, password_hash FROM accounts ORDER BY person_id");
    expect(rows.map((r) => [r.person_id, r.email])).toEqual([
      ["aman", "aman@acmelabs.in"], ["kanika", "kanika@acmelabs.in"], ["priya", "priya@acmelabs.in"], ["rupam", "rupam@acmelabs.in"], ["venkatesh", "venkatesh@acmelabs.in"],
    ]);
    for (const a of DEMO_ACCOUNTS) {
      const row = rows.find((r) => r.person_id === a.personId)!;
      expect(row.password_hash).not.toContain(a.password);
      expect(verifyPassword(a.password, row.password_hash)).toBe(true);
    }
  });

  it("sends each role to its home screen", () => {
    expect(homeFor({ role: "employee" })).toBe("/home");
    expect(homeFor({ role: "manager" })).toBe("/team");
    expect(homeFor({ role: "hr" })).toBe("/hr");
  });
});
