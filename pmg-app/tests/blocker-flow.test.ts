import { describe, expect, it } from "vitest";
import { all, run } from "@/lib/db";
import { chatFor, getBlocker, milestonesFor, plannedGoal } from "@/lib/repo";
import { behindGoals, blockersInGroup, delegateBlocker, dismissNudge, outboxFor, overdueTasks, raiseBlockerFor, requestBlockerMeeting, teamHead, type RaiseInput } from "@/lib/services/blockers";
import { resolveBlocker } from "@/lib/services/mutations";
import { createOwnGoal } from "@/lib/services/goals";
import { blockerReminders, draftBlockerEmail } from "@/lib/logic/blocked";

// Demo date: Thursday 29 Oct 2026.
const input = (o: Partial<RaiseInput>): RaiseInput => ({
  title: "Can't load-test memory lookups", category: "people", people: [], teams: [], none: false, notify: "manager", notifyPerson: null,
  goalId: null, milestoneId: null, needed: "Read access to the staging database", needBy: "2026-11-02", details: "", origin: "page", ...o,
});

describe("raising and handling blockers", () => {
  it("a team goes to its head", () => {
    expect(teamHead("cs")?.id).toBe("gayathri");
    expect(teamHead("engineering")?.id).toBe("suchitra"); // more people under her than under Anand
  });

  it("People and dependencies: one request per person and team head, each with a drafted email and a mocked channel message", () => {
    const ids = raiseBlockerFor("aman", input({ people: ["kanav"], teams: ["cs"], origin: "nudge" }));
    expect(ids).toHaveLength(2);
    const [k, cs] = ids.map((id) => getBlocker(id)!);
    expect([k.owner_id, cs.owner_id, cs.team_id, k.category, k.origin]).toEqual(["kanav", "gayathri", "cs", "people", "nudge"]);
    expect(k.group_key).toBe(cs.group_key);
    expect(chatFor("gayathri").at(-1)!.body).toMatch(/Aman Kumar is blocked: Can't load-test memory lookups \(sent to you as head of Customer Success; you can pass it on\)/);
    const sent = outboxFor(ids);
    expect(sent.map((m) => [m.to_id, m.channel])).toEqual([["kanav", "email"], ["kanav", "slack"], ["gayathri", "email"], ["gayathri", "slack"]]);
    expect(sent[0].subject).toBe("Blocked: Can't load-test memory lookups (needed by 2 Nov)");
    expect(sent[0].body).toContain("Hi Kanav,");
    expect(sent[0].body).toContain("What I need: Read access to the staging database");

    // The head passes it to someone in the team; only they can, and only to their team.
    expect(() => delegateBlocker(cs.id, "kanav", "poonam")).toThrow(/team head/);
    expect(() => delegateBlocker(cs.id, "gayathri", "kanav")).toThrow(/someone in the team/);
    delegateBlocker(cs.id, "gayathri", "poonam");
    expect(getBlocker(cs.id)).toMatchObject({ owner_id: "poonam", delegated_by: "gayathri", status: "waiting" });
    expect(chatFor("aman").at(-1)!.body).toBe("Gayathri passed your blocker “Can't load-test memory lookups” to Poonam Ramesh.");

    // A 1:1 request goes to the other person; the calendar invite is mocked.
    expect(requestBlockerMeeting(k.id, "aman")).toBe("kanav");
    expect(chatFor("kanav").at(-1)!.body).toMatch(/^Aman Kumar asked for a quick 1:1 to clear the blocker/);
    expect(outboxFor([k.id]).at(-1)).toMatchObject({ channel: "calendar", kind: "meeting_invite", to_id: "kanav" });

    // Aman marks it resolved: every request in the group closes.
    for (const id of blockersInGroup(k)) resolveBlocker(id, "aman");
    expect(ids.map((id) => getBlocker(id)!.status)).toEqual(["resolved", "resolved"]);
  });

  it("other kinds tell the manager, someone else, or nobody", () => {
    const [m] = raiseBlockerFor("aman", input({ category: "tools", notify: "manager", details: "VPN drops every few minutes" }));
    expect(getBlocker(m)).toMatchObject({ owner_id: "venkatesh", category: "tools", details: "VPN drops every few minutes" });
    const [o] = raiseBlockerFor("aman", input({ category: "clarity", notify: "person", notifyPerson: "suchitra" }));
    expect(getBlocker(o)!.owner_id).toBe("suchitra");
    const before = chatFor("venkatesh").length;
    const [n] = raiseBlockerFor("aman", input({ category: "personal", notify: "none", title: "Out sick Monday" }));
    expect(getBlocker(n)!.owner_id).toBe("aman"); // just tracked: no request, nothing mocked
    expect(chatFor("venkatesh")).toHaveLength(before);
    expect(outboxFor([n])).toEqual([]);
    expect(requestBlockerMeeting(n, "aman")).toBe("venkatesh"); // a tracked blocker's 1:1 is with the manager
    const [none] = raiseBlockerFor("aman", input({ none: true }));
    expect(getBlocker(none)!.owner_id).toBe("aman");
  });

  it("checks what's entered", () => {
    expect(() => raiseBlockerFor("aman", input({}))).toThrow(/who can unblock it, or None/);
    expect(() => raiseBlockerFor("aman", input({ category: "gossip", people: ["kanav"] }))).toThrow(/what kind/);
    expect(() => raiseBlockerFor("aman", input({ people: ["kanav"], goalId: plannedGoal("aman", "week:2026-10-26")!.id + 100000 }))).toThrow(/your goals/);
    expect(() => raiseBlockerFor("aman", input({ category: "tools", notify: "person", notifyPerson: null }))).toThrow(/who to tell/);
    expect(() => raiseBlockerFor("aman", input({ title: " ", people: ["kanav"] }))).toThrow(/what's stuck/);
  });

  it("reminders: the unblocker a day before, the employee on the day, then a prompt before any escalation", () => {
    const b = { need_by: "2026-10-30", status: "waiting" as const, resolved_at: null, opened_at: "2026-10-26T10:00", owner_id: "kanav", raised_by: "aman" };
    expect(blockerReminders(b, "2026-10-29").map((r) => [r.kind, r.on, r.to, r.state])).toEqual([
      ["day_before", "2026-10-29", "owner", "sent"], ["due_day", "2026-10-30", "raiser", "scheduled"], ["escalation_prompt", "2026-10-31", "raiser", "scheduled"],
    ]);
    expect(blockerReminders({ ...b, status: "resolved", resolved_at: "2026-10-29T12:00" }, "2026-11-02").map((r) => r.state)).toEqual(["sent", "skipped", "skipped"]);
    expect(draftBlockerEmail({ title: "Need the export", goal: "Ship memory", milestone: "Backfill done" }, "Aman Kumar", "Poonam Ramesh").body)
      .toContain("I'm blocked on “Backfill done” on my goal “Ship memory”: Need the export.");
  });

  it("PMG's prompts: a week goal under halfway by Thursday, and tasks past their date", () => {
    const week = plannedGoal("aman", "week:2026-10-26")!;
    expect(behindGoals("aman").map((x) => [x.goal.id, x.day])).toEqual([[week.id, 4]]);
    dismissNudge("aman", week.id);
    expect(behindGoals("aman")).toEqual([]);

    const own = createOwnGoal("aman", { kind: "work", horizon: "week", start: "2026-10-26", title: "Write the memory gating note", steps: ["First draft"], parentId: null, teamGoalId: null, childIds: [], send: false });
    run("UPDATE goals SET status = 'approved' WHERE id = ?", own);
    run("UPDATE milestones SET due_date = '2026-10-27' WHERE goal_id = ?", own);
    const step = milestonesFor(own)[0];
    expect(overdueTasks("aman").find((o) => o.milestone.id === step.id)).toMatchObject({ due: "2026-10-27", daysLate: 2 });
    raiseBlockerFor("aman", input({ people: ["kanav"], goalId: own, milestoneId: step.id, origin: "overdue_task" }));
    expect(overdueTasks("aman").some((o) => o.milestone.id === step.id)).toBe(false); // it's blocked now, not just late
    expect(all("SELECT origin FROM blockers WHERE milestone_id = ?", step.id)).toEqual([{ origin: "overdue_task" }]);
  });
});
