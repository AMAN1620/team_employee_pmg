import { describe, expect, it } from "vitest";
import { buildPreview, importRows, parseCsv } from "@/lib/services/people";
import { getPerson } from "@/lib/repo";

describe("people CSV import (S.1)", () => {
  it("parses quoted fields", () => {
    expect(parseCsv('name,email\n"Rao, Anshika",a@x.in\n')).toEqual([{ name: "Rao, Anshika", email: "a@x.in" }]);
  });
  it("previews, flags bad rows, and imports good ones", () => {
    const p = buildPreview("org.csv", "name,email,team,manager_email,role\nIsha Verma,isha@acmelabs.in,Product,muru@acmelabs.in,employee\nTara Singh,tara@acmelabs.in,Sales,,employee\n");
    expect(p.ready).toHaveLength(1);
    expect(p.issues[0]).toMatch(/missing manager/);
    expect(importRows(p.ready)).toBe(1);
    expect(getPerson("isha")?.manager_id).toBe("muru");
  });
});
