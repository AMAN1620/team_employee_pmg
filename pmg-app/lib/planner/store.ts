// Writes work items and planned goals. Takes the SQL helpers as a parameter so the demo seed (its own
// connection) and live syncs (the app's connection) share one implementation.
import type { WorkItemInput } from "@/lib/connectors/types";
import type { GoalText, PlanGoalSpec } from "@/lib/ai/types";
import type { Goal } from "@/lib/repo/types";
import { weekStart } from "@/lib/time";
import { fmtDay, monthOfFeature, monthOfWeek, periodOf, planLabel, ruleText, weekName, type FeaturePlan, type Plan, type PlanEntry } from "./index";

type Param = string | number | null;
export type Sql = {
  run(sql: string, ...p: Param[]): number;
  get<T>(sql: string, ...p: Param[]): T | undefined;
  all<T>(sql: string, ...p: Param[]): T[];
};

export const SOURCE_LABEL: Record<string, string> = { jira: "Jira", manual: "your own task list" };

/** Inserts or updates one source's items for a person. Returns how many were new. */
export function upsertWorkItems(sql: Sql, personId: string, items: WorkItemInput[], at: string): number {
  let added = 0;
  for (const i of items) {
    const existing = sql.get<{ id: number }>("SELECT id FROM work_items WHERE source = ? AND external_key = ?", i.source, i.external_key);
    const values: Param[] = [i.url, i.title, i.kind, i.status, i.status_label, i.size, i.parent_key, i.parent_title, i.epic_key, i.epic_title,
      i.created_at, i.started_at, i.done_at, i.due_date, at];
    if (existing) {
      sql.run(`UPDATE work_items SET person_id = ?, url = ?, title = ?, kind = ?, status = ?, status_label = ?, size = ?, parent_key = ?, parent_title = ?,
               epic_key = ?, epic_title = ?, created_at = ?, started_at = ?, done_at = ?, due_date = ?, synced_at = ? WHERE id = ?`, personId, ...values, existing.id);
    } else {
      sql.run(`INSERT INTO work_items (person_id,source,external_key,url,title,kind,status,status_label,size,parent_key,parent_title,epic_key,epic_title,
               created_at,started_at,done_at,due_date,synced_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, personId, i.source, i.external_key, ...values);
      added++;
    }
  }
  return added;
}

/** One goal the plan calls for, parents (quarters, months) before children (features, weeks). */
export type PlanGoalRow = {
  key: string; kind: PlanGoalSpec["kind"]; sig: string; closed: boolean; start: string; end: string; expected: string | null;
  entries: PlanEntry[]; parentKey: string | null; spec: PlanGoalSpec;
};

const taskEntries = (f: FeaturePlan): PlanEntry[] => f.tasks.map((task) => ({ task, feature: f, doneAt: task.doneAt, note: null }));

export function planRows(plan: Plan): PlanGoalRow[] {
  const spec = (key: string, kind: PlanGoalRow["kind"], label: string, entries: PlanEntry[], fallback: GoalText): PlanGoalSpec => ({
    key, kind, label, fallback,
    features: [...new Map(entries.map((e) => [e.feature.key, e.feature])).values()].map((f) => ({
      name: f.title, epic: f.epic, deadline: f.deadline, expected: f.expected, done: !!f.doneAt,
    })),
    tasks: entries.map((e) => ({
      title: e.task.item.title, milestone: e.task.item.outcome ?? null, feature: e.feature.theme, points: e.task.item.size, status: e.doneAt ? "done" : e.task.item.status_label ?? e.task.item.status,
      finish: e.doneAt ?? e.task.due, done: !!e.doneAt,
    })),
  });
  const rows: PlanGoalRow[] = [];
  for (const q of plan.quarters) {
    rows.push({ key: q.key, kind: "quarter", sig: q.sig, closed: q.closed, start: q.period.start, end: q.period.end, expected: null, entries: q.entries, parentKey: null,
      spec: spec(q.key, "quarter", q.period.label, q.entries, ruleText("quarter", { entries: q.entries, label: q.period.label })) });
  }
  for (const m of plan.months) {
    rows.push({ key: m.key, kind: "month", sig: m.sig, closed: m.closed, start: m.period.start, end: m.period.end, expected: null, entries: m.entries,
      parentKey: `quarter:${periodOf("quarter", m.period.start).start}`, spec: spec(m.key, "month", m.period.label, m.entries, ruleText("month", { entries: m.entries })) });
  }
  for (const f of plan.features) {
    const entries = taskEntries(f);
    const sig = `${entries.map((e) => e.task.item.external_key ?? `#${e.task.item.id}`).sort().join(",")}@${f.deadline}`;
    rows.push({ key: `feature:${f.key}`, kind: "feature", sig, closed: !!f.doneAt && f.doneAt < weekStart(plan.asOf), start: f.start, end: f.deadline, expected: f.expected,
      entries, parentKey: `month:${monthOfFeature(f).start}`,
      spec: spec(`feature:${f.key}`, "feature", `${f.title}${f.ticket?.external_key ? ` (${f.ticket.external_key})` : ""}`, entries, ruleText("feature", { feature: f })) });
  }
  for (const w of plan.weeks) {
    rows.push({ key: w.key, kind: "week", sig: w.sig, closed: w.closed, start: w.period.start, end: w.period.end, expected: null, entries: w.entries,
      parentKey: `month:${monthOfWeek(w.period.start).start}`,
      spec: spec(w.key, "week", `${weekName(w.period.start)} (${w.period.label})`, w.entries, ruleText("week", { entries: w.entries })) });
  }
  return rows;
}

const findPlanned = (sql: Sql, ownerId: string, key: string) =>
  sql.get<Goal>("SELECT * FROM goals WHERE owner_id = ? AND plan_key = ? AND source = 'ai'", ownerId, key);

/** True when PMG may (re)word the goal: new, or never approved by a person, not edited by hand, and its tasks changed. */
export function needsWords(sql: Sql, personId: string, row: PlanGoalRow): boolean {
  const g = findPlanned(sql, personId, row.key);
  return !g || (!g.approved_by && !g.title_locked && g.plan_sig !== row.sig && !row.closed);
}

export type ApplyResult = { drafted: number[]; added: { goalId: number; milestoneId: number }[] };

/**
 * Brings a person's planned goals in line with the plan. Past weeks become approved history; current and future
 * weeks are drafts until the employee asks for approval (or the manager approves them). Months, quarters and
 * features follow the weeks and need no approval. A ticket joining a week the manager already approved waits for
 * the manager to approve the addition. Titles come from `words` (the LLM or rules) and never change after a person
 * approves or edits the goal.
 */
export function applyPlan(sql: Sql, personId: string, plan: Plan, words: Map<string, GoalText>, at: string): ApplyResult {
  const person = sql.get<{ team_id: string }>("SELECT team_id FROM people WHERE id = ?", personId);
  if (!person) return { drafted: [], added: [] };
  const sources = sql.all<{ source: string }>("SELECT DISTINCT source FROM work_items WHERE person_id = ? ORDER BY source", personId)
    .map((s) => SOURCE_LABEL[s.source] ?? s.source).join(" and ");
  const log = (goalId: number, summary: string, reason: string | null = null) =>
    sql.run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goalId, summary, reason, null, at);
  const result: ApplyResult = { drafted: [], added: [] };
  const rows = planRows(plan);

  for (const row of rows) {
    const text = words.get(row.key) ?? row.spec.fallback;
    const parent = row.parentKey ? findPlanned(sql, personId, row.parentKey) : undefined;
    const existing = findPlanned(sql, personId, row.key);
    if (existing) {
      if (!existing.approved_by && !existing.title_locked && existing.plan_sig !== row.sig && !row.closed && words.has(row.key)) {
        sql.run("UPDATE goals SET title = ?, measure = ? WHERE id = ?", text.title, text.doneWhen, existing.id);
      }
      if (row.kind === "feature") {
        if (existing.due_date !== row.end) log(existing.id, `Deadline moved from ${fmtDay(existing.due_date)} to ${fmtDay(row.end)}`, "Tasks were added or their Jira due date changed");
        if (row.expected! > row.end && (existing.expected_date ?? "") <= row.end) log(existing.id, `Running late: now expected ${fmtDay(row.expected!)}`, "Tasks slipped past their weeks, so PMG re-planned the rest from today");
      }
      sql.run("UPDATE goals SET plan_sig = ?, parent_id = ?, start_date = ?, due_date = ?, expected_date = ? WHERE id = ?",
        row.sig, parent?.id ?? existing.parent_id, row.start, row.end, row.expected, existing.id);
      syncMilestones(sql, existing, row, at, log, result);
      continue;
    }
    const draft = row.kind === "week" && !row.closed;
    const id = sql.run(
      `INSERT INTO goals (level,title,owner_id,team_id,parent_id,measure,progress_mode,start_date,due_date,contribution,status,created_at,horizon,source,plan_key,plan_sig,expected_date)
       VALUES ('individual',?,?,?,?,?,'milestones',?,?,?,?,?,?,'ai',?,?,?)`,
      text.title, personId, person.team_id, parent?.id ?? null, text.doneWhen, row.start, row.end, `Planned by PMG from ${sources}.`,
      draft ? "draft" : "approved", at, row.kind, row.key, row.sig, row.expected,
    );
    syncMilestones(sql, { id, approved_by: null } as Goal, row, at, log, result);
    if (row.closed) log(id, `Rebuilt by PMG from ${sources} history`);
    else if (draft) {
      log(id, `Drafted by PMG from ${sources}`);
      result.drafted.push(id);
    } else log(id, `Planned by PMG from ${sources}`);
  }

  // Draft weeks whose tasks all moved elsewhere go away; approved ones stay, with the move logged.
  const keys = new Set(rows.map((r) => r.key));
  for (const g of sql.all<Goal>("SELECT * FROM goals WHERE owner_id = ? AND source = 'ai' AND horizon = 'week' AND status IN ('draft','changes_requested')", personId)) {
    if (keys.has(g.plan_key ?? "")) continue;
    sql.run("DELETE FROM milestones WHERE goal_id = ?", g.id);
    sql.run("DELETE FROM goal_changes WHERE goal_id = ?", g.id);
    sql.run("DELETE FROM goals WHERE id = ?", g.id);
  }
  // Goals the manager set follow their tickets too.
  sql.run(`UPDATE milestones SET done_at = (SELECT w.done_at FROM work_items w WHERE w.id = milestones.work_item_id)
           WHERE work_item_id IS NOT NULL AND goal_id IN (SELECT id FROM goals WHERE owner_id = ? AND source = 'manager')`, personId);
  return result;
}

const keyOf = (i: PlanEntry["task"]["item"]) => (i.external_key && i.source !== "manual" ? i.external_key : i.title);
/** A task shows as its milestone (what's achieved once it's done); the ticket title until one is written. */
const milestoneTitle = (i: PlanEntry["task"]["item"]) => i.outcome ?? i.title;

/** The plan's tasks that have no milestone yet, or whose ticket was renamed since it was written. */
export const tasksNeedingMilestones = (plan: Plan) =>
  plan.features.flatMap((f) => f.tasks.map((t) => ({ item: t.item, feature: f }))).filter(({ item }) => item.outcome_of !== item.title);

function syncMilestones(sql: Sql, goal: Pick<Goal, "id" | "approved_by">, row: PlanGoalRow, at: string, log: (goalId: number, summary: string, reason?: string | null) => void, result: ApplyResult) {
  const current = sql.all<{ id: number; work_item_id: number | null }>("SELECT id, work_item_id FROM milestones WHERE goal_id = ?", goal.id);
  const byItem = new Map(current.filter((m) => m.work_item_id).map((m) => [m.work_item_id!, m.id]));
  const watched = !!goal.approved_by && !row.closed;
  const keep = new Set<number>();
  row.entries.forEach(({ task, doneAt, note }, position) => {
    const id = byItem.get(task.item.id);
    if (id) {
      sql.run("UPDATE milestones SET title = ?, due_date = ?, done_at = ?, note = ?, position = ? WHERE id = ?", milestoneTitle(task.item), task.due, doneAt, note, position, id);
      keep.add(id);
      return;
    }
    const added = sql.run("INSERT INTO milestones (goal_id,title,due_date,done_at,position,work_item_id,note,pending_since) VALUES (?,?,?,?,?,?,?,?)",
      goal.id, milestoneTitle(task.item), task.due, doneAt, position, task.item.id, note, watched && row.kind === "week" ? at : null);
    keep.add(added);
    if (watched) {
      log(goal.id, `Added ${keyOf(task.item)}`, "New work arrived during the week");
      if (row.kind === "week") result.added.push({ goalId: goal.id, milestoneId: added });
    }
  });
  for (const m of current.filter((x) => x.work_item_id && !keep.has(x.id))) {
    sql.run("DELETE FROM milestones WHERE id = ?", m.id);
    if (watched) {
      const item = sql.get<{ title: string; external_key: string | null; source: string }>("SELECT title, external_key, source FROM work_items WHERE id = ?", m.work_item_id);
      log(goal.id, `Removed ${item ? keyOf(item as PlanEntry["task"]["item"]) : "a ticket"}`, "Re-planned to another week, reassigned or put on hold");
    }
  }
}

/** The chat card the manager gets when the employee asks for a week to be approved. */
export function approvalMessage(personName: string, goal: Pick<Goal, "horizon" | "start_date" | "title" | "plan_key">, sources: string): string {
  return `${personName.split(" ")[0]} asks you to approve their goal for ${planLabel(goal)}, planned by PMG from ${sources}: ${goal.title}`;
}
