import { describe, expect, it } from "vitest";
import { goalHealth, goalProgress } from "@/lib/logic/health";
import { blockerDays, daysBlocked, displayStatus, shouldSuggestEscalation } from "@/lib/logic/blocked";
import { canSeeRawCheckin, canSeeSubmittedReview, canSeeWin } from "@/lib/logic/permissions";
import { sortCheckinRules, draftAppraisalRules, checkGoalQualityRules } from "@/lib/ai/fallback";
import { agendaFor, checkinContext, evidenceFor, goalViewsFor } from "@/lib/services/views";
import { blockersForGoal, blockersRaisedBy, getPerson, goalsFor, milestonesFor } from "@/lib/repo";

const TODAY = "2026-10-29";

const SAMPLE_REPLY = {
  moved: "The Dream Sports B2B instance is live with all 3 domains and CleverTap events now carry company_id, which improved B2B tracking. Also helped Venkatesh pull cohort data for user calling.",
  stuck: "Still waiting on Kanav for the B2B dashboard data pipeline. I also need the support-ticket export from Customer Success to plan the next Simkey release.",
  next: "Start the B2B pilot dashboard once the pipeline is ready.",
};

describe("goal health (8.1)", () => {
  it("reads the Phase 3 goals: Mohammed on track, Suchitra at risk behind 27 held issues, Shivakumar off track", () => {
    expect(goalViewsFor("mohammed")[0].h.health).toBe("On track");
    const suchitra = goalViewsFor("suchitra")[0].h;
    expect(suchitra.health).toBe("At risk");
    expect(suchitra.reason).toBe("At risk: 57% done, with 31% of the quarter gone. 27 blockers open for 126 days.");
    expect(goalViewsFor("shivakumar")[0].h.health).toBe("Off track");
  });

  it("computes progress for count, milestone and metric goals", () => {
    const g = goalsFor("mohammed")[0];
    expect(goalProgress(g, milestonesFor(g.id))).toBeCloseTo(29 / 30, 3);
    expect(goalProgress({ ...g, progress_mode: "count", count_done: 149, count_total: 221 })).toBeCloseTo(0.674, 3);
    expect(goalProgress({ ...g, progress_mode: "metric", baseline: 38, target: 25, current: 34.1 })).toBeCloseTo(0.3, 2);
    expect(goalProgress({ ...g, progress_mode: "metric", baseline: 7, target: 12, current: 9.5 })).toBeCloseTo(0.5, 2);
  });

  it("is Off track when far behind pace", () => {
    const g = goalsFor("mohammed")[0];
    const none = milestonesFor(g.id).map((m) => ({ ...m, done_at: null }));
    expect(goalHealth(g, none, [], TODAY).health).toBe("Off track");
  });
});

describe("days blocked (1.3)", () => {
  it("counts calendar days with a blocker open, so parallel blockers count once", () => {
    expect(daysBlocked(blockersRaisedBy("aman"), TODAY)).toBe(4);
    expect(daysBlocked(blockersForGoal(goalsFor("suchitra")[0].id), TODAY)).toBe(126); // On Hold since 25 Jun
    expect(daysBlocked([
      { opened_at: "2026-10-01T10:00", resolved_at: "2026-10-05T10:00" },
      { opened_at: "2026-10-03T10:00", resolved_at: "2026-10-08T10:00" },
      { opened_at: "2026-10-22T10:00", resolved_at: null },
    ], TODAY)).toBe(7 + 7);
  });

  it("marks unresolved blockers past need-by as overdue and suggests escalation", () => {
    const held = blockersRaisedBy("kanav")[0];
    expect(displayStatus(held, TODAY)).toBe("waiting");
    const late = { ...held, need_by: "2026-10-20" };
    expect(displayStatus(late, TODAY)).toBe("overdue");
    expect(shouldSuggestEscalation(late, TODAY)).toBe(true);
    expect(blockerDays({ opened_at: "2026-11-19T09:00", resolved_at: "2026-11-19T10:00" }, TODAY)).toBe(1);
  });
});

describe("check-in sorting fallback (3.2)", () => {
  it("sorts the demo reply into the 5 expected items", () => {
    const anshika = getPerson("anshika")!;
    const ctx = checkinContext(anshika);
    const items = sortCheckinRules(SAMPLE_REPLY, ctx);
    expect(items.map((i) => i.kind)).toEqual(["progress", "win", "unplanned", "blocker", "blocker"]);
    const goal = goalsFor("anshika")[0].id;
    expect(items[0].goalId).toBe(goal);
    expect(items[1].goalId).toBe(goal);
    const [kanav, poonam] = items.slice(3) as Extract<(typeof items)[number], { kind: "blocker" }>[];
    expect(kanav.ownerId).toBe("kanav");
    expect(poonam.ownerId).toBe("poonam");
    expect(poonam.goalId).toBe(goal);
    expect(poonam.needBy).toBe("2026-11-03");
  });

  it("ignores 'nothing' as a blocker", () => {
    const ctx = checkinContext(getPerson("anshika")!);
    expect(sortCheckinRules({ moved: "", stuck: "Nothing this week.", next: "" }, ctx)).toEqual([]);
  });
});

describe("self-appraisal draft (5.1)", () => {
  it("cites only real evidence numbers for every goal", () => {
    for (const person of ["anshika", "priya"]) {
      const goals = goalViewsFor(person).map((g) => ({ id: g.id, title: g.title, health: g.h.health, progressText: g.progressText }));
      const evidence = evidenceFor(person);
      const draft = draftAppraisalRules(goals, evidence);
      const valid = new Set(evidence.map((e) => e.n));
      for (const g of goals) expect(draft.goals[String(g.id)]).toBeTruthy();
      const cited = [...Object.values(draft.goals).join(" ").concat(draft.beyond).matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
      expect(cited.length).toBeGreaterThan(2);
      expect(cited.every((n) => valid.has(n))).toBe(true);
      if (person === "priya") expect(draft.beyond).toMatch(/I cleared Aman's blocker/);
    }
  });
});

describe("goal quality check (4.2)", () => {
  it("flags vague goals and identical rubric levels", () => {
    const vague = checkGoalQualityRules({ title: "Improve the onboarding experience" });
    expect(vague.ok).toBe(false);
    expect(vague.suggestion).toBe("Reduce onboarding drop-off from 38% to 25% by 31 Dec");
    const same = checkGoalQualityRules({ title: "Increase activation email click rate to 12%", dueDate: "2026-12-31", meets: "12%", exceeds: "12%" });
    expect(same.issues.join(" ")).toMatch(/Exceeds/);
  });
});

describe("1:1 agenda (7.1)", () => {
  it("builds from blockers, at-risk goals, overdue actions and topics", () => {
    const { items, oneOnOne } = agendaFor("anshika", "muru");
    expect(oneOnOne?.scheduled_at).toBe("2026-10-29T16:00");
    expect(items.map((i) => i.source)).toContain("action");
    expect(items.filter((i) => i.source === "topic").map((i) => i.text)).toEqual(["Path to Senior Product Manager", "Input for Q4 planning"]);
    const suchitra = agendaFor("suchitra", "muru").items.map((i) => i.source);
    expect(suchitra).toContain("blocker");
    expect(suchitra).toContain("at_risk");
  });
});

describe("permissions (S.2)", () => {
  const anshika = getPerson("anshika")!, muru = getPerson("muru")!, priyadarshini = getPerson("priyadarshini")!, salman = getPerson("salman")!;
  it("follows the owner's visibility choice", () => {
    expect(canSeeWin(muru, anshika, { visibility: "manager" })).toBe(true);
    expect(canSeeWin(salman, anshika, { visibility: "manager" })).toBe(false);
    expect(canSeeWin(salman, anshika, { visibility: "team" })).toBe(true);
    expect(canSeeWin(muru, anshika, { visibility: "private" })).toBe(false);
    expect(canSeeWin(priyadarshini, anshika, { visibility: "team" })).toBe(false);
  });
  it("keeps raw check-ins private and gives HR submitted reviews only", () => {
    expect(canSeeRawCheckin(muru, "anshika")).toBe(false);
    expect(canSeeRawCheckin(anshika, "anshika")).toBe(true);
    expect(canSeeSubmittedReview(priyadarshini, anshika, "draft")).toBe(false);
    expect(canSeeSubmittedReview(priyadarshini, anshika, "submitted")).toBe(true);
  });
});
