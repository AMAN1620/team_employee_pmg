import { describe, expect, it } from "vitest";
import { chatFor, getGoal, goalsFor, goalsInside, milestonesFor, personalGoalsFor, getPerson } from "@/lib/repo";
import { createOwnGoal, editOwnGoal, type OwnGoalInput } from "@/lib/services/goals";
import { decideGoal, submitGoal, toggleMilestone, updateGoalProgress } from "@/lib/services/mutations";
import { requestApproval } from "@/lib/services/work";
import { canSeeGoal } from "@/lib/services/comments";
import { goalViewsFor } from "@/lib/services/views";

// Demo date: Thursday 29 Oct 2026, so this week starts 26 Oct, the month is October and the quarter Q4 2026.
const goal = (o: Partial<OwnGoalInput> & Pick<OwnGoalInput, "horizon" | "start" | "title">): OwnGoalInput =>
  ({ kind: "work", steps: [], parentId: null, teamGoalId: null, childIds: [], send: false, ...o });
const requests = () => chatFor("venkatesh").filter((m) => m.kind === "approval_request");

describe("goals people set themselves", () => {
  it("a personal goal needs no approval and only its owner sees it", () => {
    const before = requests().length;
    const id = createOwnGoal("aman", goal({ kind: "personal", horizon: "quarter", start: "2026-10-01", title: "Get comfortable with system design interviews" }));
    expect(getGoal(id)).toMatchObject({ status: "approved", approved_by: null, kind: "personal", horizon: "quarter", start_date: "2026-10-01", due_date: "2026-12-31" });
    expect(requests()).toHaveLength(before);
    expect(personalGoalsFor("aman").map((g) => g.id)).toContain(id);
    expect(goalsFor("aman").map((g) => g.id)).not.toContain(id); // so check-ins, 1:1s, reviews and the team page never show it
    expect(goalViewsFor("aman").map((g) => g.id)).not.toContain(id);
    expect([canSeeGoal(getPerson("aman")!, getGoal(id)!), canSeeGoal(getPerson("venkatesh")!, getGoal(id)!)]).toEqual([true, false]);
    expect(() => submitGoal(id)).toThrow(/don't need approval/);
  });

  it("top-down: a quarter goal broken into a month and weeks goes to Venkatesh once, and approving it approves them all", () => {
    const q = createOwnGoal("aman", goal({ horizon: "quarter", start: "2026-10-01", title: "Make cross-chat memory dependable for every Simkey user" }));
    const m = createOwnGoal("aman", goal({ horizon: "month", start: "2026-11-01", title: "Memory recalls the right past chats in testing", parentId: q }));
    const w = createOwnGoal("aman", goal({ horizon: "week", start: "2026-11-02", title: "Write the memory gating design note", parentId: m }));
    expect([q, m, w].map((id) => getGoal(id)!.status)).toEqual(["draft", "draft", "draft"]);
    expect(goalsInside(q).map((g) => g.id)).toEqual([m]);

    const before = requests().length;
    requestApproval(q, "aman");
    expect([q, m, w].map((id) => getGoal(id)!.status)).toEqual(["pending", "pending", "pending"]);
    expect(requests()).toHaveLength(before + 1);
    expect(requests().at(-1)!.body).toBe("Aman Kumar proposed a goal for Q4 2026 (Oct–Dec): Make cross-chat memory dependable for every Simkey user (with 2 smaller goals inside)");

    decideGoal(q, "venkatesh", "approve", "");
    expect([q, m, w].map((id) => getGoal(id)!.status)).toEqual(["approved", "approved", "approved"]);
    expect(getGoal(w)!.approved_by).toBe("venkatesh");

    // A new week inside the approved month is covered by it.
    const w2 = createOwnGoal("aman", goal({ horizon: "week", start: "2026-11-09", title: "Load-test memory lookups", parentId: m }));
    expect(getGoal(w2)).toMatchObject({ status: "approved", approved_by: null });
    expect(requests()).toHaveLength(before + 1);

    // Rewording an approved work goal sends it back to Venkatesh.
    editOwnGoal(m, "aman", "Memory recalls the right past chats in staging tests");
    expect(getGoal(m)!.status).toBe("pending");
  });

  it("bottom-up: weeks gathered into a month go with it; asking for changes sends them back to drafts", () => {
    const a = createOwnGoal("aman", goal({ horizon: "week", start: "2026-11-16", title: "Pair with Tharun on the summaries job" }));
    const b = createOwnGoal("aman", goal({ horizon: "week", start: "2026-11-23", title: "Document how summaries are stored" }));
    const m = createOwnGoal("aman", goal({ horizon: "month", start: "2026-11-01", title: "Share what I know about chat summaries", childIds: [a, b], send: true }));
    expect(goalsInside(m).map((g) => g.id)).toEqual([a, b]);
    expect([m, a, b].map((id) => getGoal(id)!.status)).toEqual(["pending", "pending", "pending"]);
    decideGoal(m, "venkatesh", "changes", "Make it one clear outcome");
    expect([m, a, b].map((id) => getGoal(id)!.status)).toEqual(["changes_requested", "draft", "draft"]);
  });

  it("a month's progress rolls up from its weeks, and the quarter's from its months", () => {
    const q = createOwnGoal("aman", goal({ kind: "personal", horizon: "quarter", start: "2026-10-01", title: "Read two books on distributed systems" }));
    const m = createOwnGoal("aman", goal({ kind: "personal", horizon: "month", start: "2026-11-01", title: "Finish Designing Data-Intensive Applications", parentId: q }));
    const w1 = createOwnGoal("aman", goal({ kind: "personal", horizon: "week", start: "2026-11-02", title: "Read chapters 1 and 2", steps: ["Chapter 1", "Chapter 2", ""], parentId: m }));
    const w2 = createOwnGoal("aman", goal({ kind: "personal", horizon: "week", start: "2026-11-09", title: "Read chapter 3", parentId: m }));
    expect(milestonesFor(w1).map((x) => x.title)).toEqual(["Chapter 1", "Chapter 2"]);
    toggleMilestone(milestonesFor(w1)[0].id, "aman");
    expect(getGoal(m)!.manual_progress).toBe(25);
    updateGoalProgress(w2, "aman", 100);
    expect(getGoal(m)!.manual_progress).toBe(75);
    expect(getGoal(q)!.manual_progress).toBe(75);
    expect(chatFor("venkatesh").some((c) => c.body.includes("Chapter 1"))).toBe(false); // personal steps don't ping the manager
  });

  it("checks the period and what a goal can sit inside", () => {
    expect(() => createOwnGoal("aman", goal({ horizon: "week", start: "2026-10-19", title: "Last week's goal" }))).toThrow(/this week or a later one/);
    expect(() => createOwnGoal("aman", goal({ horizon: "month", start: "2026-10-15", title: "Not a month start" }))).toThrow();
    const nov = createOwnGoal("aman", goal({ horizon: "month", start: "2026-11-01", title: "A November goal" }));
    expect(() => createOwnGoal("aman", goal({ horizon: "week", start: "2026-11-30", title: "A December week", parentId: nov }))).toThrow(/can't hold/); // 30 Nov is December's week 1
    expect(() => createOwnGoal("aman", goal({ kind: "personal", horizon: "week", start: "2026-11-02", title: "Personal week", parentId: nov }))).toThrow(/can't hold/);
    expect(() => createOwnGoal("tharun", goal({ horizon: "week", start: "2026-11-02", title: "Someone else's month", parentId: nov }))).toThrow(/can't hold/);
    expect(() => createOwnGoal("aman", goal({ horizon: "week", start: "2026-11-02", title: "  " }))).toThrow(/3 to 200/);
  });
});
