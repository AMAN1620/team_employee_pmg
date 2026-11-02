import { describe, expect, it } from "vitest";
import {
  blockersOwnedBy, blockersRaisedBy, childGoals, directReports, goalsFor, milestonesFor, parseEvidence, pendingApprovals, pendingCheckin, winsFor,
} from "@/lib/repo";
import { get } from "@/lib/db";
import { JIRA_PEOPLE, JIRA_PRODUCT_OWNERS, PHASE3_PEOPLE, phase3Plan } from "@/lib/db/phase3";
import snapshot from "@/lib/db/jira/sp0-112.json";

describe("demo seed", () => {
  it("creates the demo company", () => {
    expect(get<{ n: number }>("SELECT SUM(headcount) AS n FROM teams")?.n).toBe(312);
    expect(directReports("muru").map((p) => p.id).sort()).toEqual(["anand", "anshika", "salman", "suchitra", "utkarsh"]);
  });

  it("has no pending approvals or check-ins before the demo starts", () => {
    expect(pendingApprovals("muru")).toHaveLength(0);
    expect(pendingCheckin("anshika")).toBeUndefined();
  });
});

describe("Jira epic SP0-112 (Simkey Phase 3)", () => {
  it("matches every Jira person to the org chart, except the shared product account and people not on it", () => {
    const names = new Set(snapshot.issues.flatMap((i) => [i.assignee, i.developer]).filter(Boolean) as string[]);
    expect([...names].filter((n) => !JIRA_PEOPLE[n]).sort()).toEqual(["Poornisha C", "Product Simkey"]);
    const owners = new Set(snapshot.issues.map((i) => i.productOwner).filter(Boolean) as string[]);
    expect([...owners].filter((n) => !JIRA_PRODUCT_OWNERS[n])).toEqual(["Tech"]);
    expect(phase3Plan().unowned).toHaveLength(6);
  });

  it("is Engineering's team goal, counting Done issues out of all 221", () => {
    const team = get<{ id: number; title: string; owner_id: string; count_done: number; count_total: number }>("SELECT * FROM goals WHERE level = 'team' AND team_id = 'engineering'")!;
    expect(team).toMatchObject({ title: "Ship Simkey Phase 3", owner_id: "suchitra", count_done: 149, count_total: 221 });
    const children = childGoals(team.id);
    expect(children.map((g) => g.owner_id).sort()).toEqual(
      ["anshika", "athiqur", "kanav", "kumari", "mohammed", "priya", "rupam", "salman", "shivakumar", "subham", "suchitra", "utkarsh", "venkatesh"]);
  });

  it("replaces the seeded goals of everyone in it: committed issues become milestones, Backlog stays out", () => {
    // Aman's goals are planned from his live Jira tickets instead (tests/planner.test.ts).
    for (const p of PHASE3_PEOPLE.filter((x) => x !== "aman")) expect(goalsFor(p).every((g) => g.title.includes("Simkey Phase 3"))).toBe(true);
    expect(goalsFor("aman").every((g) => g.horizon && g.source === "ai")).toBe(true);
    expect(goalsFor("anand")).toHaveLength(0); // only a Backlog issue
    const [mohammed] = goalsFor("mohammed");
    const ms = milestonesFor(mohammed.id);
    expect(ms).toHaveLength(30);
    expect(ms.filter((m) => m.done_at)).toHaveLength(29);
    expect(ms.find((m) => !m.done_at)?.title).toBe("App Deeplinking (SP0-775)");
    expect(milestonesFor(goalsFor("anshika")[0].id)).toHaveLength(26);
  });

  it("turns On Hold and With Product issues into blockers waiting on the product owner", () => {
    const open = blockersRaisedBy("suchitra").filter((b) => b.status !== "resolved");
    expect(open).toHaveLength(27);
    expect(blockersOwnedBy("anshika").map((b) => b.title).sort()).toEqual(["B2B Pilot Dashboard (basic)", "Deep linking of prompts from social to Simkey", "Policy Document RAG"]);
    const kanav = blockersRaisedBy("kanav")[0];
    expect(kanav).toMatchObject({ owner_id: "utkarsh", title: "Improve goal nudge question", opened_at: "2026-09-17T10:00", status: "waiting" });
  });

  it("turns an 'is blocked by' link into a resolved blocker and credits the person who cleared it", () => {
    const [b] = blockersRaisedBy("aman");
    expect(b).toMatchObject({ owner_id: "priya", status: "resolved", opened_at: "2026-09-11T10:00", resolved_at: "2026-09-15T17:00" });
    expect(winsFor("priya").find((w) => w.kind === "helped")?.title).toBe("Cleared Aman's blocker “Retain Goal Intent Chip after payment” in 4 days");
  });

  it("logs shipped work as wins with the Jira issue as evidence", () => {
    const ios = winsFor("suchitra").find((w) => w.title === "Shipped iOS APP")!;
    expect(parseEvidence(ios)).toEqual([{ kind: "jira", label: "SP0-780", url: "https://jobsforher.atlassian.net/browse/SP0-780" }]);
    expect(ios.at).toBe("2026-09-17T18:00");
    expect(winsFor("kumari").some((w) => w.title === "Released iOS APP")).toBe(true);
    expect(winsFor("anshika").every((w) => w.source === "jira")).toBe(true);
  });
});
