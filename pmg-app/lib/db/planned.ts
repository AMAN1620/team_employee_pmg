import type { DatabaseSync } from "node:sqlite";
import type { WorkItemInput } from "@/lib/connectors/types";
import { SEEDED_JIRA } from "@/lib/connectors/seeded";
import { buildPlan } from "@/lib/planner";
import { applyPlan, planRows, upsertWorkItems, type Sql } from "@/lib/planner/store";
import type { GoalText } from "@/lib/ai/types";
import type { WorkItem } from "@/lib/repo/types";
import { today } from "@/lib/time";
import saved from "./jira/work-items.json";
import written from "./jira/plan-words.json";

/**
 * What the LLM wrote for the saved tickets (`npm run plan:write`): each task's milestone, kept while the ticket title
 * matches, and goal wording, kept while the goal's tasks match.
 */
export type SavedWords = {
  writtenOn: string;
  milestones: Record<string, Record<string, { of: string; text: string }>>;
  people: Record<string, Record<string, GoalText & { sig: string }>>;
};

/**
 * Connects the seeded people to Jira and plans their goals from the tickets saved by `npm run jira:pull`, worded
 * by the LLM ahead of time so a reset works offline: past weeks become approved history, this week and the weeks
 * ahead are drafts the employee sends to the manager for approval. The running app then keeps them in sync.
 */
export function seedPlanned(db: DatabaseSync): void {
  const sql: Sql = {
    run: (q, ...p) => Number(db.prepare(q).run(...p).lastInsertRowid),
    get: <T>(q: string, ...p: (string | number | null)[]) => db.prepare(q).get(...p) as T | undefined,
    all: <T>(q: string, ...p: (string | number | null)[]) => db.prepare(q).all(...p) as T[],
  };
  const at = `${today()}T09:00`;
  const people = saved.people as Record<string, { accountId: string; items: WorkItemInput[] }>;
  for (const [personId, { label }] of Object.entries(SEEDED_JIRA)) {
    sql.run("INSERT INTO connections (person_id,kind,external_id,label,last_synced_at) VALUES (?,?,?,?,?)",
      personId, "jira", SEEDED_JIRA[personId].accountId, label, `${saved.pulledOn}T09:00:00.000Z`);
    upsertWorkItems(sql, personId, people[personId]?.items ?? [], at);
    for (const [key, m] of Object.entries((written as unknown as SavedWords).milestones?.[personId] ?? {})) {
      sql.run("UPDATE work_items SET outcome = ?, outcome_of = ? WHERE source = 'jira' AND external_key = ? AND title = ?", m.text, m.of, key, m.of);
    }
    const plan = buildPlan(sql.all<WorkItem>("SELECT * FROM work_items WHERE person_id = ?", personId), today());
    const mine = (written as unknown as SavedWords).people[personId] ?? {};
    const words = new Map(planRows(plan).filter((r) => mine[r.key]?.sig === r.sig).map((r) => [r.key, mine[r.key]]));
    applyPlan(sql, personId, plan, words, at);
  }
}

/**
 * Aman's personal goals, set top-down: a quarter goal, two months inside it and October's last two weeks with
 * steps. Personal goals need no approval and only he sees them. Progress rolls up: weeks → October → the quarter.
 */
export function seedPersonalGoals(db: DatabaseSync): void {
  const at = `${today()}T09:00`;
  const team = (db.prepare("SELECT team_id FROM people WHERE id = 'aman'").get() as { team_id: string }).team_id;
  const add = (horizon: string, title: string, start: string, end: string, parent: number | null, progress: number | null, steps: [string, string | null][] = []) => {
    const id = Number(db.prepare(`INSERT INTO goals (level,title,owner_id,team_id,parent_id,progress_mode,manual_progress,start_date,due_date,status,approved_at,created_at,horizon,source,kind)
      VALUES ('individual',?,'aman',?,?,?,?,?,?,'approved',?,?,?,'manual','personal')`).run(title, team, parent, steps.length ? "milestones" : "manual", steps.length ? null : progress, start, end, at, at, horizon).lastInsertRowid);
    steps.forEach(([t, done], i) => db.prepare("INSERT INTO milestones (goal_id,title,due_date,done_at,position) VALUES (?,?,?,?,?)").run(id, t, end, done, i));
    return id;
  };
  const q = add("quarter", "Get comfortable with system design interviews", "2026-10-01", "2026-12-31", null, 37.5);
  const oct = add("month", "Finish the first half of Designing Data-Intensive Applications", "2026-10-01", "2026-10-31", q, 75);
  add("week", "Read chapters 1 and 2", "2026-10-19", "2026-10-25", oct, null, [["Chapter 1: reliable, scalable systems", "2026-10-21"], ["Chapter 2: data models", "2026-10-24"]]);
  add("week", "Read chapter 3 and write up my notes", "2026-10-26", "2026-11-01", oct, null, [["Chapter 3: storage and retrieval", "2026-10-28"], ["One page of notes on storage engines", null]]);
  add("month", "Do two mock design interviews with friends", "2026-11-01", "2026-11-30", q, 0);
}
