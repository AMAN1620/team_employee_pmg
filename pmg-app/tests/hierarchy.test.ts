import { describe, expect, it } from "vitest";
import { chainAbove, directReports, getPerson, isInLine, orgBelow } from "@/lib/repo";
import { rollup } from "@/lib/services/views";

describe("org hierarchy from the chart", () => {
  it("derives roles from reporting lines: anyone with reports is a manager", () => {
    expect(getPerson("anand")?.role).toBe("manager"); // AVP - Tech, leads Shivakumar and Tharun
    expect(getPerson("anand")?.title).toBe("AVP - Tech");
    expect(getPerson("suchitra")?.role).toBe("manager");
    expect(getPerson("venkatesh")?.role).toBe("manager");
    expect(getPerson("aman")?.role).toBe("employee");
    expect(getPerson("priyadarshini")?.role).toBe("hr");
    expect(directReports("anand").map((p) => p.id).sort()).toEqual(["shivakumar", "tharun"]);
  });

  it("walks the line both ways: Aman → Venkatesh → Kanav → Suchitra → Muru → Neha", () => {
    expect(chainAbove("aman").map((p) => p.id)).toEqual(["venkatesh", "kanav", "suchitra", "muru", "neha"]);
    expect(isInLine("muru", "aman")).toBe(true);
    expect(isInLine("anand", "aman")).toBe(false);
    expect(orgBelow("suchitra").map((p) => p.id)).toEqual(expect.arrayContaining(["mohammed", "priya", "rupam", "subham", "kanav", "athiqur", "venkatesh", "aman"]));
    expect(orgBelow("suchitra")).toHaveLength(8);
  });

  it("rolls progress up: Muru's org includes everyone under Suchitra and Anand", () => {
    const org = rollup(orgBelow("muru"));
    const eng = rollup(orgBelow("suchitra"));
    expect(org.people).toBe(16);
    expect(org.goals.length).toBeGreaterThan(eng.goals.length);
    expect(eng.goals.some((g) => g.owner_id === "mohammed")).toBe(true);
    // Aman's month, quarter and features count; his drafted weeks wait for Venkatesh's approval.
    expect(eng.goals.filter((g) => g.owner_id === "aman").map((g) => g.horizon).sort()).toEqual(["feature", "month", "quarter"]);
    expect(org.on + org.risk + org.off).toBe(org.goals.length);
    expect(org.avgProgress).toBeGreaterThan(0);
  });
});
