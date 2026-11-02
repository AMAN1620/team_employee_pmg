// Read-side helpers that combine repo rows with core logic for the screens.
import {
  activeCycle, getReview, isClosedPlan, isFuturePlan, lastConfirmedCheckin,
  actionItemsBetween, agendaTopics, blockersForGoal, blockersRaisedBy, checkinsFor, feedbackTo, getPerson, goalsFor,
  listPeople, listTeams, milestonesFor, oneOnOnesFor, peopleById, winsFor, type Blocker, type Goal, type Milestone, type Person,
} from "@/lib/repo";
import { goalHealth, progressLabel, type HealthResult } from "@/lib/logic/health";
import { blockerDays, daysBlocked } from "@/lib/logic/blocked";
import { buildAgenda } from "@/lib/logic/agenda";
import { today, weekStart } from "@/lib/time";
import type { CheckinContext, EvidenceItem } from "@/lib/ai";

export type GoalView = Goal & { milestones: Milestone[]; blockers: Blocker[]; h: HealthResult; progressText: string; daysBlocked: number };

export function goalView(g: Goal): GoalView {
  const milestones = milestonesFor(g.id);
  const blockers = blockersForGoal(g.id);
  return {
    ...g, milestones, blockers, h: goalHealth(g, milestones, blockers, today()), progressText: progressLabel(g, milestones),
    daysBlocked: daysBlocked(blockers, today()),
  };
}

/** A person's current goals: approved (or also pending), leaving out planned goals that are history or weeks ahead. */
export function goalViewsFor(personId: string, includePending = false): GoalView[] {
  return goalsFor(personId).filter((g) => (includePending || g.status === "approved") && !isClosedPlan(g) && !isFuturePlan(g)).map(goalView);
}

export function checkinContext(person: Person): CheckinContext {
  const teams = new Map(listTeams().map((t) => [t.id, t.name]));
  return {
    today: today(),
    goals: goalsFor(person.id).filter((g) => g.status === "approved" && !isClosedPlan(g) && !isFuturePlan(g)).map((g) => ({
      id: g.id, title: g.title, measure: g.measure, milestones: milestonesFor(g.id).map((m) => m.title),
    })),
    openBlockers: blockersRaisedBy(person.id).filter((b) => b.status !== "resolved").map((b) => ({ id: b.id, title: b.title, ownerId: b.owner_id, goalId: b.goal_id })),
    people: listPeople().filter((p) => p.id !== person.id).map((p) => ({
      id: p.id, name: p.name, title: p.title, teamName: teams.get(p.team_id) ?? "", isLead: p.role === "manager", managerId: p.manager_id,
    })),
  };
}

/** Numbered evidence for a person's self-appraisal and manager review: wins, blockers, feedback, check-ins. */
export function evidenceFor(personId: string): EvidenceItem[] {
  const people = peopleById();
  const name = (id: string | null) => (id ? people.get(id)?.name ?? id : "");
  const goals = new Set(goalsFor(personId).map((g) => g.id));
  const items: Omit<EvidenceItem, "n">[] = [];

  for (const w of winsFor(personId)) {
    const kind = w.kind;
    const detail = kind === "kudos" ? `${name(w.from_id)} gave kudos: “${w.title}”` : w.title;
    items.push({ kind, refId: w.id, goalId: w.goal_id, date: w.at, label: w.title, detail });
  }
  for (const b of blockersRaisedBy(personId).filter((b) => b.goal_id && goals.has(b.goal_id))) {
    const days = blockerDays(b, today());
    const detail = b.status === "resolved"
      ? `I was blocked ${days} day${days > 1 ? "s" : ""} on “${b.title.toLowerCase()}” until ${name(b.owner_id)} resolved it`
      : `Progress slowed while I waited ${days} days (so far) on ${name(b.owner_id)} for “${b.title.toLowerCase()}”`;
    items.push({ kind: "blocker", refId: b.id, goalId: b.goal_id, date: b.opened_at, label: b.title, detail });
  }
  for (const f of feedbackTo(personId)) {
    items.push({ kind: "feedback", refId: f.id, goalId: f.goal_id, date: f.at, label: `Feedback from ${name(f.from_id)} on ${f.about}`, detail: `${name(f.from_id)} noted: “${f.keep ?? f.improve ?? ""}”` });
  }
  for (const c of checkinsFor(personId).filter((c) => c.status === "confirmed" && c.moved)) {
    items.push({ kind: "checkin", refId: c.id, goalId: null, date: c.submitted_at, label: c.moved!, detail: c.moved! });
  }
  return items.map((it, i) => ({ ...it, n: i + 1 }));
}

export function agendaFor(employeeId: string, managerId: string) {
  const employee = getPerson(employeeId)!;
  const manager = getPerson(managerId)!;
  const people = peopleById();
  const upcoming = oneOnOnesFor(employeeId).filter((o) => o.manager_id === managerId).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const next = upcoming.find((o) => o.scheduled_at.slice(0, 10) >= today()) ?? upcoming[upcoming.length - 1];
  const goals = goalViewsFor(employeeId);
  const actions = actionItemsBetween(employeeId, managerId);
  const items = buildAgenda({
    today: today(), employeeName: employee.name, managerName: manager.name,
    openBlockers: blockersRaisedBy(employeeId).filter((b) => b.status !== "resolved").map((b) => ({ ...b, ownerName: people.get(b.owner_id)?.name ?? b.owner_id })),
    atRiskGoals: goals.filter((g) => g.h.health !== "On track").map((g) => ({ id: g.id, title: g.title, reason: g.h.reason })),
    recentWins: winsFor(employeeId).filter((w) => w.kind === "win" || w.kind === "kudos"),
    actions,
    topics: next ? agendaTopics(next.id) : [],
  });
  return { oneOnOne: next, history: upcoming.filter((o) => o !== next).reverse(), items, actions, employee, manager };
}

export type Rollup = {
  people: number; goals: GoalView[]; on: number; risk: number; off: number; avgProgress: number;
  openBlockers: number; checkedIn: number; selfDone: number;
};

/** Progress across a set of people: goal health, average progress, blockers, check-ins this week, self-reviews in. */
export function rollup(people: Person[]): Rollup {
  const goals = people.flatMap((p) => goalViewsFor(p.id));
  const cycle = activeCycle();
  const week = weekStart(today());
  return {
    people: people.length, goals,
    on: goals.filter((g) => g.h.health === "On track").length,
    risk: goals.filter((g) => g.h.health === "At risk").length,
    off: goals.filter((g) => g.h.health === "Off track").length,
    avgProgress: goals.length ? goals.reduce((n, g) => n + g.h.progress, 0) / goals.length : 0,
    openBlockers: people.reduce((n, p) => n + blockersRaisedBy(p.id).filter((b) => b.status !== "resolved").length, 0),
    checkedIn: people.filter((p) => (lastConfirmedCheckin(p.id)?.week_of ?? "") >= week).length,
    selfDone: cycle ? people.filter((p) => getReview(cycle.id, p.id, "self")?.status === "submitted").length : 0,
  };
}
