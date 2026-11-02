import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPlan, periodOf, quarterOfWeek, themeName, weekName, weekNumber, weeksOfMonth } from "@/lib/planner";
import { fetchJiraWork } from "@/lib/connectors/jira";
import { addManualItem, approveAddition, assignWeekGoal, editPlannedGoal, markTaskDone, replan, requestApproval, setManualStatus } from "@/lib/services/work";
import { upsertWorkItems } from "@/lib/planner/store";
import { decideGoal, toggleMilestone } from "@/lib/services/mutations";
import { all, get, run } from "@/lib/db";
import { chatFor, getWorkItem, goalChanges, goalsFor, milestonesFor, pendingAdditions, plannedGoal, workItemsFor, type WorkItem } from "@/lib/repo";
import { goalViewsFor } from "@/lib/services/views";
import { addWorkdays } from "@/lib/time";
import words from "@/lib/db/jira/plan-words.json";

const TODAY = "2026-10-29"; // a Thursday
let n = 0;
const item = (o: Partial<WorkItem>): WorkItem => ({
  id: ++n, person_id: "x", source: "jira", external_key: `T-${n}`, url: null, title: `Ticket ${n}`, kind: "Sub-task", status: "in_progress",
  status_label: null, size: null, parent_key: "F-1", parent_title: "Across Chat Memory", epic_key: "E-4", epic_title: "Simkey Phase 4",
  created_at: "2026-10-05", started_at: "2026-10-05", done_at: null, due_date: null, synced_at: null, ...o,
});

describe("calendar", () => {
  it("numbers weeks within the quarter their Thursday falls in, and counts working days", () => {
    expect(periodOf("month", TODAY)).toMatchObject({ start: "2026-10-01", end: "2026-10-31", label: "October 2026" });
    expect(quarterOfWeek("2026-09-28").label).toBe("Q4 2026 (Oct–Dec)"); // Thursday 1 Oct
    expect([weekNumber("2026-09-28"), weekNumber("2026-10-26"), weekNumber("2026-11-02"), weekNumber("2026-11-30")]).toEqual([1, 5, 1, 1]); // 30 Nov is December's week 1
    expect(weekName("2026-11-30")).toBe("Dec Week 1");
    expect(weeksOfMonth("2026-11-01")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(addWorkdays("2026-10-29", 3)).toBe("2026-11-02"); // Thu, Fri, Mon
    expect(themeName("[BE] Goal chat foundations — feature flag")).toBe("Goal chat foundations");
  });
});

describe("planning a feature", () => {
  it("without a Jira deadline: 5 tasks without points at 2 days each make a 2-week plan", () => {
    const tasks = [1, 2, 3, 4, 5].map(() => item({ status: "todo", started_at: null, created_at: "2026-11-02" }));
    const [f] = buildPlan(tasks, "2026-11-02").features;
    expect(f).toMatchObject({ start: "2026-11-02", deadline: "2026-11-13", deadlineFrom: "tasks", effortDays: 10 });
    const plan = buildPlan(tasks, "2026-11-02");
    expect(plan.weeks.map((w) => [w.period.start, w.entries.length])).toEqual([["2026-11-02", 2], ["2026-11-09", 3]]);
  });

  it("story points first: 1 point is 2 working days", () => {
    const [f] = buildPlan([item({ size: 1 }), item({ size: 0.5 }), item({ size: 2 })], "2026-10-06").features;
    expect(f).toMatchObject({ deadline: "2026-10-13", deadlineFrom: "points", points: 3.5, effortDays: 7 });
    expect(f.tasks.map((t) => t.planned)).toEqual(["2026-10-06", "2026-10-07", "2026-10-13"]);
  });

  it("a Jira due date on the feature is the deadline, and the plan fits inside it", () => {
    const feature = item({ external_key: "F-1", kind: "Feature", parent_key: null, due_date: "2026-10-09" });
    const [f] = buildPlan([feature, item({ size: 3 }), item({ size: 3 })], "2026-10-06").features;
    expect(f).toMatchObject({ key: "F-1", deadline: "2026-10-09", deadlineFrom: "jira" });
    expect(f.tasks.map((t) => t.planned)).toEqual(["2026-10-09", "2026-10-09"]);
  });

  it("re-plans slipped work from today, in review first, and shows the move in every week", () => {
    const feature = item({ external_key: "F-1", kind: "Feature", parent_key: null, started_at: "2026-10-05" });
    const done = item({ size: 1, done_at: "2026-10-06" });
    const slipped = item({ size: 1, started_at: "2026-10-07" }); // planned 8 Oct
    const review = item({ size: 2, started_at: "2026-10-07", status: "review" }); // planned 14 Oct
    const fixed = item({ size: 1, started_at: "2026-10-20", due_date: "2026-11-05" }); // its own Jira date stands
    const held = item({ status: "on_hold" });
    const plan = buildPlan([feature, done, slipped, review, fixed, held], TODAY);
    const [f] = plan.features;
    expect(f).toMatchObject({ deadline: "2026-11-05", deadlineFrom: "jira", expected: "2026-11-05" });
    expect(f.tasks.find((t) => t.item === review)!.due).toBe(TODAY); // one more day in review
    expect(f.tasks.find((t) => t.item === slipped)!.due).toBe("2026-11-02"); // then 2 days: Fri, Mon
    expect(f.tasks.some((t) => t.item === held)).toBe(false);

    const week = (ws: string) => plan.weeks.find((w) => w.period.start === ws)!;
    expect(week("2026-10-05").entries.map((e) => [e.task.item.id, e.doneAt, e.note])).toEqual([
      [done.id, "2026-10-06", null], [slipped.id, null, "Not done; now planned for Nov Week 1"]]);
    expect(week("2026-10-12").entries[0].note).toBe("Not done; now planned for Oct Week 5");
    expect(week("2026-10-26")).toMatchObject({ closed: false, future: false });
    expect(week("2026-10-26").entries.map((e) => [e.task.item.id, e.note])).toEqual([[review.id, "Moved from Oct Week 3"]]);
    expect(week("2026-11-02").entries.map((e) => e.task.item.id)).toEqual([slipped.id, fixed.id]);
    expect(week("2026-11-02").future).toBe(true);
    const october = plan.months.find((m) => m.period.start === "2026-10-01")!;
    expect(october.entries.map((e) => e.task.item.id).sort()).toEqual([done.id, slipped.id, review.id].sort());
  });
});

describe("Aman's plan from Jira (seed)", () => {
  it("plans weeks, months, quarters and features, worded by the LLM ahead of time", () => {
    const goals = goalsFor("aman");
    const feature = plannedGoal("aman", "feature:SP0-615")!;
    expect(feature).toMatchObject({ horizon: "feature", start_date: "2026-09-24", due_date: "2026-10-30", expected_date: "2026-11-11", status: "approved" });
    expect(feature.title).toBe((words.people.aman as Record<string, { title: string }>)["feature:SP0-615"].title);
    expect(feature.title).not.toMatch(/SP0-|tickets?:/);

    const weeks = goals.filter((g) => g.horizon === "week" && g.start_date >= "2026-10-26").map((g) => [g.start_date, g.status]);
    expect(weeks).toEqual([["2026-10-26", "draft"], ["2026-11-02", "draft"], ["2026-11-09", "draft"]]);
    const thisWeek = plannedGoal("aman", "week:2026-10-26")!;
    expect(milestonesFor(thisWeek.id).map((m) => getWorkItem(m.work_item_id!)?.external_key)).toEqual(["SP0-1392"]);
    expect(milestonesFor(thisWeek.id)[0].title).toBe(words.milestones.aman["SP0-1392"].text); // what the task achieves, not its ticket title
    expect(thisWeek.parent_id).toBe(plannedGoal("aman", "month:2026-10-01")!.id);
    expect(milestonesFor(plannedGoal("aman", "week:2026-11-09")!.id).map((m) => m.note)).toEqual(["Moved from Oct Week 4", "Moved from Oct Week 5"]);

    expect(goals.filter((g) => g.horizon === "week" && g.due_date < TODAY).every((g) => g.status === "approved")).toBe(true);
    expect(chatFor("venkatesh").some((m) => m.kind === "approval_request")).toBe(false); // nothing sent until Aman asks
    expect(goalViewsFor("aman").some((g) => g.start_date > TODAY && g.horizon === "week")).toBe(false);
  });

  it("Aman ticks a task off on his plan: it counts as done this week until he unticks it", async () => {
    const item = workItemsFor("aman").find((i) => i.external_key === "SP0-1367")!;
    const inWeek = (key: string) => milestonesFor(plannedGoal("aman", key)!.id).find((m) => m.work_item_id === item.id);
    expect(inWeek("week:2026-11-02")?.done_at).toBeNull();
    await expect(markTaskDone(item.id, "venkatesh", true)).rejects.toThrow();
    expect(await markTaskDone(item.id, "aman", true)).toEqual(["2026-10-12", "2026-10-26"]); // its missed week, and this week
    expect(inWeek("week:2026-10-26")?.done_at).toBe(TODAY);
    expect(inWeek("week:2026-11-02")).toBeUndefined();
    expect(getWorkItem(item.id)).toMatchObject({ status: "in_progress", marked_done_at: TODAY }); // Jira's status is untouched
    await markTaskDone(item.id, "aman", false);
    expect(inWeek("week:2026-11-02")?.done_at).toBeNull();
    const done = workItemsFor("aman").find((i) => i.status === "done" && i.source === "jira")!;
    await expect(markTaskDone(done.id, "aman", false)).rejects.toThrow(/Done in Jira/);
  });

  it("re-planning with the same tickets changes nothing", async () => {
    const before = all("SELECT id, title, status, due_date FROM goals WHERE owner_id = 'aman' ORDER BY id");
    expect(await replan("aman")).toEqual([]);
    expect(all("SELECT id, title, status, due_date FROM goals WHERE owner_id = 'aman' ORDER BY id")).toEqual(before);
  });

  it("Aman asks, Venkatesh approves the week; a ticket joining it later waits for Venkatesh", async () => {
    const week = plannedGoal("aman", "week:2026-10-26")!;
    expect(() => requestApproval(week.id, "venkatesh")).toThrow();
    requestApproval(week.id, "aman");
    expect(chatFor("venkatesh").find((m) => m.kind === "approval_request")?.body).toMatch(/^Aman asks you to approve their goal for Oct Week 5 · 26 Oct – 1 Nov, planned by PMG from Jira: /);
    expect(() => decideGoal(week.id, "kanav", "approve", "")).toThrow();
    decideGoal(week.id, "venkatesh", "approve", "");
    expect(goalViewsFor("aman").map((g) => g.id)).toContain(week.id);

    upsertWorkItems({ run, get, all }, "aman", [{
      source: "jira", external_key: "SP0-9999", url: null, title: "Hotfix memory gate timeout", kind: "Sub-task", status: "in_progress", status_label: "In Progress",
      size: 0.5, parent_key: "SP0-615", parent_title: "Across Chat Memory", epic_key: "SP0-1265", epic_title: "Simkey Phase 4",
      created_at: "2026-10-28", started_at: "2026-10-28", done_at: null, due_date: "2026-10-30",
    }], "2026-10-29T12:00");
    expect(await replan("aman")).toEqual([]);
    const added = milestonesFor(week.id).find((m) => getWorkItem(m.work_item_id!)?.external_key === "SP0-9999")!;
    expect(added.pending_since).toBeTruthy();
    expect(goalChanges(week.id).map((c) => c.summary)).toContain("Added SP0-9999");
    expect(chatFor("venkatesh").filter((m) => m.kind === "plan_change")).toHaveLength(1);
    expect(pendingAdditions("venkatesh").map((m) => m.id)).toEqual([added.id]);
    expect(() => approveAddition(added.id, "aman")).toThrow();
    approveAddition(added.id, "venkatesh");
    expect(milestonesFor(week.id).find((m) => m.id === added.id)?.pending_since).toBeNull();
    expect(chatFor("venkatesh").find((m) => m.kind === "plan_change")?.handled).toBe("approve");
    expect(() => toggleMilestone(added.id, "aman")).toThrow(/follows its ticket/);
  });

  it("Venkatesh can reword and approve a drafted week; PMG keeps his wording", async () => {
    const next = plannedGoal("aman", "week:2026-11-02")!;
    expect(() => editPlannedGoal(next.id, "kanav", { title: "x", doneWhen: "" }, true)).toThrow();
    editPlannedGoal(next.id, "venkatesh", { title: "Relevant-context PoC done and latency numbers shared", doneWhen: "Numbers posted in #simkey" }, true);
    expect(plannedGoal("aman", "week:2026-11-02")).toMatchObject({ status: "approved", approved_by: "venkatesh", title_locked: 1, measure: "Numbers posted in #simkey" });
    expect(chatFor("aman").some((m) => m.kind === "approval_result" && m.body.includes("Relevant-context PoC"))).toBe(true);
    await replan("aman");
    expect(plannedGoal("aman", "week:2026-11-02")!.title).toBe("Relevant-context PoC done and latency numbers shared");
  });

  it("Venkatesh can set a week goal himself, tied to Aman's tickets", async () => {
    const ticket = workItemsFor("aman").find((i) => i.external_key === "SP0-1368")!;
    expect(() => assignWeekGoal("kanav", "aman", { week: "2026-11-02", title: "x", doneWhen: "", itemIds: [] })).toThrow();
    expect(() => assignWeekGoal("venkatesh", "aman", { week: "2026-10-19", title: "x", doneWhen: "", itemIds: [] })).toThrow(/this week or a later one/);
    const id = assignWeekGoal("venkatesh", "aman", { week: "2026-11-04", title: "Share the latency findings with the team", doneWhen: "Demo at Friday sync", itemIds: [ticket.id] });
    const goal = goalsFor("aman").find((g) => g.id === id)!;
    expect(goal).toMatchObject({ horizon: "week", source: "manager", status: "approved", start_date: "2026-11-02", due_date: "2026-11-08", parent_id: plannedGoal("aman", "month:2026-11-01")!.id });
    expect(chatFor("aman").some((m) => m.body.includes("set a goal for your Nov Week 1"))).toBe(true);
    run("UPDATE work_items SET status = 'done', done_at = '2026-11-03' WHERE id = ?", ticket.id);
    await replan("aman");
    expect(milestonesFor(id)[0].done_at).toBe("2026-11-03");
  });
});

describe("manual work (no connector)", () => {
  it("plans a week goal from work typed in by hand, for the employee to send", async () => {
    expect(goalsFor("tharun").some((g) => g.horizon)).toBe(false);
    const drafted = await addManualItem("tharun", { title: "Write regression checklist for onboarding", size: "small", due: "2026-10-30", started: true });
    expect(drafted).toHaveLength(1);
    const week = goalsFor("tharun").find((g) => g.horizon === "week")!;
    expect(week).toMatchObject({ status: "draft", start_date: "2026-10-26", title: "Move Write regression checklist for onboarding forward" });
    expect(chatFor("tharun").some((m) => m.body.startsWith("PMG planned your goal for Oct Week 5"))).toBe(true);
    expect(chatFor("anand").some((m) => m.kind === "approval_request")).toBe(false);

    const [mine] = workItemsFor("tharun");
    await expect(setManualStatus(mine.id, "aman", "done")).rejects.toThrow();
    await setManualStatus(mine.id, "tharun", "done");
    expect(milestonesFor(week.id)[0].done_at).toBe(TODAY);
  });
});

describe("Jira connector", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps tickets: status, story points, start from the changelog, parent Feature and its epic", async () => {
    const issue = {
      key: "SP0-1369",
      fields: {
        summary: " Gate when to query summaries ", created: "2026-10-08T10:00:00.000+0530", resolutiondate: null, duedate: null, customfield_10028: 1.5,
        status: { name: "In QA", statusCategory: { key: "indeterminate" } }, issuetype: { name: "Sub-task", hierarchyLevel: -1 },
        parent: { key: "SP0-615", fields: { summary: "Across Chat Memory", issuetype: { name: "Feature", hierarchyLevel: 0 } } },
      },
      changelog: { histories: [
        { created: "2026-10-14T09:00:00.000+0530", items: [{ field: "status", toString: "In QA" }] },
        { created: "2026-10-12T09:00:00.000+0530", items: [{ field: "status", toString: "In Progress" }] },
      ] },
    };
    const parent = { key: "SP0-615", fields: { parent: { key: "SP0-1265", fields: { summary: "Simkey Phase 4", issuetype: { name: "Epic", hierarchyLevel: 1 } } } } };
    const fetchMock = vi.fn(async (url: string) => {
      const jql = new URL(url).searchParams.get("jql")!;
      return new Response(JSON.stringify({ issues: jql.startsWith("key in") ? [parent] : [issue], isLast: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const [w] = await fetchJiraWork({ site: "https://x.atlassian.net", email: "a@b.c", token: "t" }, "acc-1");
    expect(w).toMatchObject({
      external_key: "SP0-1369", title: "Gate when to query summaries", status: "review", status_label: "In QA", size: 1.5,
      parent_key: "SP0-615", parent_title: "Across Chat Memory", epic_key: "SP0-1265", epic_title: "Simkey Phase 4",
      created_at: "2026-10-08", started_at: "2026-10-12", done_at: null, url: "https://x.atlassian.net/browse/SP0-1369",
    });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("jql")).toContain('assignee = "acc-1" OR cf[10032] = "acc-1"');
  });
});
