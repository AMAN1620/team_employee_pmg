// Turns a person's work items (Jira tickets or tasks typed in by hand) into a plan, feature by feature:
// - A feature is a parent ticket (a Jira Feature, Story or Task with sub-tasks) and the person's sub-tasks are its
//   tasks. A ticket without a parent is a feature of its own. On Hold work waits until it moves again.
// - Effort: 1 story point is 2 working days of work; a task without points is 2 days.
// - A feature starts when it goes In Progress (else when its first task starts). It's due on its Jira due date, or
//   when its tasks add up to, worked one after another from the start.
// - Every task is planned to finish in a week. Done tasks count in the week they were done. When open tasks slip
//   past their week, the rest of the feature is re-planned from today, which can push it past its deadline.
// - A week's goal is the tasks planned to finish that week, across features. Months and quarters roll weeks up.
// The LLM only words the goals (lib/ai); every date here comes from these rules, so the plan is the same each sync.
import type { WorkItem } from "@/lib/repo/types";
import { addDays, addWorkdays, daysBetween, nextWorkday, weekStart } from "@/lib/time";

export const DAYS_PER_POINT = 2;
export const DAYS_PER_TASK = 2;
/** A task already in review or QA is assumed to need one more working day. */
export const DAYS_IN_REVIEW = 1;

export type Horizon = "week" | "month" | "quarter";
export type Period = { horizon: Horizon; start: string; end: string; label: string };

export type TaskPlan = {
  item: WorkItem; effortDays: number;
  /** When the first plan expected it to finish. */
  planned: string;
  /** When it's expected to finish now (re-planned if it slipped), or when it was done. */
  due: string;
  doneAt: string | null;
};
export type FeaturePlan = {
  key: string; title: string; theme: string; epic: string | null; url: string | null; ticket: WorkItem | null;
  start: string; deadline: string; deadlineFrom: "jira" | "points" | "tasks"; expected: string; doneAt: string | null;
  points: number; effortDays: number; tasks: TaskPlan[];
};
export type PlanEntry = { task: TaskPlan; feature: FeaturePlan; doneAt: string | null; note: string | null };
export type PeriodPlan = {
  key: string; period: Period; entries: PlanEntry[]; features: FeaturePlan[]; closed: boolean; future: boolean; sig: string;
};
export type Plan = { asOf: string; features: FeaturePlan[]; weeks: PeriodPlan[]; months: PeriodPlan[]; quarters: PeriodPlan[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const fmtDay = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

export function periodOf(horizon: Horizon, date: string): Period {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
  if (horizon === "week") {
    const start = weekStart(date);
    return { horizon, start, end: addDays(start, 6), label: `Week of ${fmtDay(start)}` };
  }
  if (horizon === "month") {
    const start = `${date.slice(0, 7)}-01`;
    return { horizon, start, end: lastDay(y, m), label: `${MONTH_NAMES[m - 1]} ${y}` };
  }
  const q = Math.floor((m - 1) / 3);
  const start = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
  return { horizon, start, end: lastDay(y, q * 3 + 3), label: `Q${q + 1} ${y} (${MONTHS[q * 3]}–${MONTHS[q * 3 + 2]})` };
}

/** A week belongs to the month and quarter its Thursday falls in, so every week is in exactly one of each. */
export const monthOfWeek = (ws: string) => periodOf("month", addDays(ws, 3));
export const quarterOfWeek = (ws: string) => periodOf("quarter", addDays(ws, 3));

/** "Week 2" of its month: week 1 is the first week whose Thursday is in the month. */
export function weekNumber(ws: string): number {
  const first = weekStart(addDays(monthOfWeek(ws).start, 3));
  return Math.floor(daysBetween(first, ws) / 7) + 1;
}

/** "Oct Week 5": the week's number with its month, for places that show weeks from more than one month. */
export const weekName = (ws: string) => `${MONTHS[Number(monthOfWeek(ws).start.slice(5, 7)) - 1]} Week ${weekNumber(ws)}`;

/** The Mondays of the weeks that belong to a month (four or five). */
export function weeksOfMonth(monthStart: string): string[] {
  const out: string[] = [];
  for (let ws = weekStart(addDays(monthStart, 3)); monthOfWeek(ws).start === monthStart; ws = addDays(ws, 7)) out.push(ws);
  return out;
}

/** The start and end of a week, month or quarter goal that starts on `start`. */
export function goalRange(horizon: Horizon, start: string): { start: string; end: string } {
  if (horizon === "week") return { start, end: addDays(start, 6) };
  const p = periodOf(horizon, start);
  return { start: p.start, end: p.end };
}

/** True when a week, month or quarter (inner) falls inside a longer one (outer), by the Thursday rule for weeks. */
export function fitsInside(inner: { horizon: string | null; start_date: string }, outer: { horizon: string | null; start_date: string }): boolean {
  if (inner.horizon === "week") {
    return (outer.horizon === "month" && monthOfWeek(inner.start_date).start === outer.start_date)
      || (outer.horizon === "quarter" && quarterOfWeek(inner.start_date).start === outer.start_date);
  }
  return inner.horizon === "month" && outer.horizon === "quarter" && periodOf("quarter", inner.start_date).start === outer.start_date;
}

/** Periods someone can set a goal for: this week and the next eleven, this month and the next five, this quarter and the next. */
export function goalPeriods(asOf: string): Record<Horizon, string[]> {
  const cw = weekStart(asOf);
  const shift = (monthStart: string, n: number) => {
    const m = Number(monthStart.slice(5, 7)) - 1 + n;
    return `${Number(monthStart.slice(0, 4)) + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`;
  };
  const cm = monthOfWeek(cw).start, cq = quarterOfWeek(cw).start;
  return {
    week: Array.from({ length: 12 }, (_, i) => addDays(cw, 7 * i)),
    month: Array.from({ length: 6 }, (_, i) => shift(cm, i)),
    quarter: [cq, shift(cq, 3)],
  };
}

/** The first days of a quarter's three months. */
export const monthsOfQuarter = (q: string) => [0, 1, 2].map((n) => `${q.slice(0, 5)}${String(Number(q.slice(5, 7)) + n).padStart(2, "0")}-01`);

export const weekRange = (ws: string) => `${fmtDay(ws)} – ${fmtDay(addDays(ws, 6))}`;

/** Short theme name for a parent ticket or epic: "Add Web search — tool + trigger guidelines" → "Add Web search". */
export function themeName(t: string): string {
  const name = t.replace(/^\s*\[[^\]]+\]\s*/, "").split(/\s+[—–]\s+|:\s+|,\s+/)[0].trim().replace(/\s+/g, " ").replace(/\.$/, "");
  return name.length <= 48 ? name : `${name.slice(0, 46).replace(/\s+\S*$/, "")}…`;
}

/** Working days a task should take: 2 per story point, 2 without points. */
export const effortOf = (i: Pick<WorkItem, "size">) => (i.size && i.size > 0 ? Math.max(1, Math.round(i.size * DAYS_PER_POINT)) : DAYS_PER_TASK);

/** When work on an item began, as far as the plan is concerned. */
const begunOn = (i: WorkItem) => i.started_at ?? (i.done_at && i.done_at < i.created_at ? i.done_at : i.created_at);

/** Groups the person's items into features. Parent tickets with sub-tasks are features, not tasks. */
function featureGroups(all: WorkItem[]): { key: string; ticket: WorkItem | null; tasks: WorkItem[] }[] {
  const byKey = new Map(all.filter((i) => i.external_key).map((i) => [i.external_key!, i]));
  const parents = new Set(all.map((i) => i.parent_key).filter(Boolean) as string[]);
  const groups = new Map<string, { key: string; ticket: WorkItem | null; tasks: WorkItem[] }>();
  for (const i of all) {
    if (i.external_key && parents.has(i.external_key)) continue;
    const key = i.parent_key ?? i.external_key ?? `item-${i.id}`;
    const g = groups.get(key) ?? { key, ticket: i.parent_key ? byKey.get(i.parent_key) ?? null : i, tasks: [] };
    g.tasks.push(i);
    groups.set(key, g);
  }
  return [...groups.values()];
}

function planFeature(group: { key: string; ticket: WorkItem | null; tasks: WorkItem[] }, asOf: string): FeaturePlan | null {
  const held = group.ticket?.status === "on_hold" && group.ticket.external_key === group.key && group.tasks[0] !== group.ticket;
  const tasks = group.tasks.filter((t) => t.done_at || (t.status !== "on_hold" && !held))
    .sort((a, b) => begunOn(a).localeCompare(begunOn(b)) || (a.external_key ?? "").localeCompare(b.external_key ?? "", undefined, { numeric: true }));
  if (!tasks.length) return null;
  const first = tasks[0];
  const ticket = group.ticket;
  const start = [ticket?.started_at, ...tasks.map(begunOn)].filter(Boolean).sort()[0]!;
  const jiraDeadline = ticket?.due_date ?? tasks.map((t) => t.due_date).filter(Boolean).sort().pop() ?? null;

  // The first plan: tasks one after another from the start, none before it arrived.
  let cursor = start;
  const plans: TaskPlan[] = tasks.map((item) => {
    const effortDays = effortOf(item);
    const from = begunOn(item) > cursor ? begunOn(item) : cursor;
    let planned = item.due_date ?? addWorkdays(from, effortDays);
    if (!item.due_date && jiraDeadline && planned > jiraDeadline) planned = jiraDeadline;
    cursor = nextWorkday(planned);
    return { item, effortDays, planned, due: item.done_at ?? planned, doneAt: item.done_at };
  });
  const deadline = jiraDeadline ?? plans.map((p) => p.planned).sort().pop()!;

  // Open work that slipped past its week is re-planned from today, in review first.
  const open = plans.filter((p) => !p.doneAt);
  if (open.some((p) => p.planned < weekStart(asOf))) {
    const rank = (p: TaskPlan) => (p.item.status === "review" ? 0 : p.item.status === "in_progress" ? 1 : 2);
    let from = asOf;
    for (const p of [...open].sort((a, b) => rank(a) - rank(b))) {
      if (p.item.due_date && p.item.due_date >= asOf) continue; // its own Jira due date still stands
      p.due = addWorkdays(from, p.item.status === "review" ? DAYS_IN_REVIEW : p.effortDays);
      from = nextWorkday(p.due);
    }
  }
  const doneAt = open.length ? null : plans.map((p) => p.doneAt!).sort().pop()!;
  const title = ticket?.title ?? first.parent_title ?? first.title;
  return {
    key: group.key, title, theme: themeName(title), epic: first.epic_title ?? null, url: ticket?.url ?? (first.parent_key ? null : first.url), ticket,
    start, deadline, deadlineFrom: jiraDeadline ? "jira" : tasks.some((t) => t.size) ? "points" : "tasks",
    expected: doneAt ?? plans.map((p) => p.due).sort().pop()!, doneAt,
    points: tasks.reduce((n, t) => n + (t.size ?? 0), 0), effortDays: plans.reduce((n, p) => n + p.effortDays, 0), tasks: plans,
  };
}

const sigOf = (entries: PlanEntry[]) => entries.map((e) => e.task.item.external_key ?? `#${e.task.item.id}`).sort().join(",");
const byFinish = (a: PlanEntry, b: PlanEntry) =>
  (a.doneAt ?? a.task.due).localeCompare(b.doneAt ?? b.task.due) || (a.task.item.external_key ?? "").localeCompare(b.task.item.external_key ?? "", undefined, { numeric: true });

function featuresOf(entries: PlanEntry[]): FeaturePlan[] {
  return [...new Map(entries.map((e) => [e.feature.key, e.feature])).values()];
}

/** The person's whole plan as of `asOf`: features, then every week from their first item to the last planned one. */
export function buildPlan(items: WorkItem[], asOf: string): Plan {
  // A task the person ticked off counts as done from then, until Jira (or their list) says when it was really done.
  const all = items.map((i) => (i.status !== "done" && i.marked_done_at ? { ...i, status: "done" as const, done_at: i.marked_done_at } : i));
  const features = featureGroups(all).map((g) => planFeature(g, asOf)).filter((f): f is FeaturePlan => !!f)
    .sort((a, b) => a.start.localeCompare(b.start) || a.key.localeCompare(b.key));
  const tasks = features.flatMap((feature) => feature.tasks.map((task) => ({ task, feature })));
  const current = weekStart(asOf);
  const weeks: PeriodPlan[] = [];
  if (tasks.length) {
    const dates = tasks.flatMap(({ task }) => [task.planned, task.due]).sort();
    for (let ws = weekStart(dates[0]); ws <= weekStart(dates[dates.length - 1]); ws = addDays(ws, 7)) {
      const period = periodOf("week", ws);
      const closed = ws < current;
      const entries: PlanEntry[] = [];
      for (const { task, feature } of tasks) {
        const doneHere = task.doneAt && task.doneAt >= ws && task.doneAt <= period.end;
        const missedHere = closed && task.planned >= ws && task.planned <= period.end && (!task.doneAt || task.doneAt > period.end);
        const dueHere = !closed && !task.doneAt && task.due >= ws && task.due <= period.end;
        if (!doneHere && !missedHere && !dueHere) continue;
        const note = missedHere
          ? task.doneAt ? `Done later, on ${fmtDay(task.doneAt)}` : `Not done; now planned for ${weekName(weekStart(task.due))}`
          : dueHere && task.planned < ws ? `Moved from ${weekName(weekStart(task.planned))}` : null;
        entries.push({ task, feature, doneAt: doneHere ? task.doneAt : null, note });
      }
      if (!entries.length) continue;
      entries.sort(byFinish);
      weeks.push({ key: `week:${ws}`, period, entries, features: featuresOf(entries), closed, future: ws > current, sig: sigOf(entries) });
    }
  }
  const rollUp = (horizon: "month" | "quarter"): PeriodPlan[] => {
    const out = new Map<string, PeriodPlan>();
    for (const w of weeks) {
      const period = horizon === "month" ? monthOfWeek(w.period.start) : quarterOfWeek(w.period.start);
      const p = out.get(period.start) ?? { key: `${horizon}:${period.start}`, period, entries: [], features: [], closed: false, future: false, sig: "" };
      for (const e of w.entries) {
        const seen = p.entries.findIndex((x) => x.task === e.task);
        if (seen < 0) p.entries.push({ ...e, note: null });
        else if (e.doneAt) p.entries[seen] = { ...e, note: null };
      }
      out.set(period.start, p);
    }
    return [...out.values()].map((p) => {
      const lastWeek = weekStart(addDays(p.period.end, -3));
      const closed = lastWeek < current;
      const entries = p.entries.map((e) => ({ ...e, note: closed && !e.doneAt ? `Not done in ${p.period.label.split(" ")[0]}` : null })).sort(byFinish);
      return { ...p, entries, features: featuresOf(entries), closed, future: weekStart(addDays(p.period.start, 3)) > current, sig: sigOf(entries) };
    });
  };
  return { asOf, features, weeks, months: rollUp("month"), quarters: rollUp("quarter") };
}

/** The month a feature's goal sits under: the one its expected finish falls in. */
export const monthOfFeature = (f: FeaturePlan) => monthOfWeek(weekStart(f.expected));

/** Short label for a planned goal: "Oct Week 5 · 26 Oct – 1 Nov", "October 2026", "Feature · SP0-615". */
export function planLabel(g: { horizon: string | null; start_date: string; plan_key?: string | null }): string {
  if (g.horizon === "week") return `${weekName(g.start_date)} · ${weekRange(g.start_date)}`;
  if (g.horizon === "month" || g.horizon === "quarter") return periodOf(g.horizon, g.start_date).label;
  if (g.horizon === "feature") return `Feature${g.plan_key?.startsWith("feature:") && !g.plan_key.startsWith("feature:item-") ? ` · ${g.plan_key.slice(8)}` : ""}`;
  return "";
}

// ── Rule-written goals, used when the LLM is off or fails ──

const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, 2).join(", ")} and ${xs.length - 2} more`);
const short = (t: string) => themeName(t).replace(/^(BE|FE)\s*[-:]\s*/i, "");

export function ruleText(kind: "week" | "month" | "quarter" | "feature", p: { entries?: PlanEntry[]; feature?: FeaturePlan; label?: string }): { title: string; doneWhen: string } {
  if (kind === "feature") {
    const f = p.feature!;
    const n = f.tasks.length;
    const basis = f.deadlineFrom === "jira" ? "the Jira due date" : f.deadlineFrom === "points" ? `${f.points} story points × ${DAYS_PER_POINT} days` : `${n} task${n === 1 ? "" : "s"} × ${DAYS_PER_TASK} days`;
    return { title: `Deliver ${f.theme}`, doneWhen: `All ${n} task${n === 1 ? "" : "s"} done in Jira by ${fmtDay(f.deadline)} (${basis}).` };
  }
  const entries = p.entries ?? [];
  const themes = featuresOf(entries).map((f) => f.theme);
  if (kind === "week") {
    return {
      title: `Move ${list(themes)} forward`,
      doneWhen: `Done in Jira: ${list(entries.map((e) => short(e.task.item.title)))}.`,
    };
  }
  const finished = featuresOf(entries).filter((f) => f.tasks.every((t) => entries.some((e) => e.task === t)) || f.doneAt);
  return {
    title: kind === "quarter" ? `${p.label?.split(" (")[0]}: deliver ${list(themes)}` : `Deliver ${list((finished.length ? finished : featuresOf(entries)).map((f) => f.theme))}`,
    doneWhen: `${entries.length} planned task${entries.length === 1 ? "" : "s"} done across ${themes.length} feature${themes.length === 1 ? "" : "s"}.`,
  };
}
