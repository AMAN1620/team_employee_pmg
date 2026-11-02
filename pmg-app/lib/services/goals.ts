// Goals people set themselves, for a week, a month or a quarter, for work or for themselves.
// Top-down, a quarter goal is broken into months and a month into weeks; bottom-up, existing weeks are gathered
// into a month and months into a quarter. A goal with goals inside it takes their progress (rollup.ts).
// Work goals go to the person's manager for approval: a week inside an approved month or quarter is covered by
// it, and approving a goal approves the goals inside it that were waiting. Personal goals need no approval, and
// only their owner sees them.
import { run, tx } from "@/lib/db";
import { getPerson, goalsInside, ownPlanGoals, teamGoals, type Goal } from "@/lib/repo";
import { fitsInside, goalPeriods, goalRange, planLabel, type Horizon } from "@/lib/planner";
import { submitGoal } from "@/lib/services/mutations";
import { rollUpProgress } from "@/lib/services/rollup";
import { now, today } from "@/lib/time";

export type OwnHorizon = Horizon;
export type OwnGoalInput = {
  kind: "work" | "personal"; horizon: OwnHorizon; start: string; title: string; steps: string[];
  parentId: number | null; teamGoalId: number | null; childIds: number[]; send: boolean;
};

/** Which goals can hold a goal of each length, and which can be gathered into one. */
export const HOLDS: Record<OwnHorizon, OwnHorizon[]> = { week: ["month", "quarter"], month: ["quarter"], quarter: [] };
export const GATHERS: Record<OwnHorizon, OwnHorizon | null> = { week: null, month: "week", quarter: "month" };

const isOwn = (g: Goal) => g.source === "manual" && (g.horizon === "week" || g.horizon === "month" || g.horizon === "quarter");

export function createOwnGoal(ownerId: string, input: OwnGoalInput): number {
  const owner = getPerson(ownerId);
  if (!owner) throw new Error("Unknown person");
  const { kind, horizon } = input;
  if ((kind !== "work" && kind !== "personal") || !(horizon in HOLDS)) throw new Error("Pick work or personal, and a week, month or quarter");
  if (!goalPeriods(today())[horizon].includes(input.start)) throw new Error(`Pick this ${horizon} or a later one`);
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < 3 || title.length > 200) throw new Error("Write the goal in 3 to 200 characters");
  const steps = horizon === "week" ? input.steps.map((t) => t.trim().slice(0, 200)).filter(Boolean).slice(0, 12) : [];
  const { start, end } = goalRange(horizon, input.start);
  const here = { horizon, start_date: start };

  const mine = ownPlanGoals(ownerId);
  const parent = input.parentId ? mine.find((g) => g.id === input.parentId) : undefined;
  if (input.parentId && (!parent || parent.kind !== kind || !HOLDS[horizon].includes(parent.horizon as OwnHorizon) || !fitsInside(here, parent))) {
    throw new Error("That goal can't hold this one");
  }
  const team = !parent && kind === "work" && horizon === "quarter" && input.teamGoalId ? teamGoals().find((t) => t.id === input.teamGoalId) : undefined;
  const children = [...new Set(input.childIds)].map((id) => mine.find((g) => g.id === id));
  if (children.some((c) => !c || c.kind !== kind || c.horizon !== GATHERS[horizon] || c.parent_id || !fitsInside(c, here))) {
    throw new Error("Some of those goals can't go inside this one");
  }

  // Personal goals are set as they are. A work week inside an approved goal is covered by it; inside one that's
  // waiting, it waits with it. Anything else is a draft until it's sent.
  const [status, note]: [Goal["status"], string | null] =
    kind === "personal" ? ["approved", "Personal goal: no approval needed"]
    : parent?.status === "approved" ? ["approved", `Covered by the approved goal for ${planLabel(parent)}`]
    : parent?.status === "pending" ? ["pending", `Waiting for approval with the goal for ${planLabel(parent)}`]
    : ["draft", null];
  const at = now();
  const id = tx(() => {
    const gid = run(`INSERT INTO goals (level,title,owner_id,team_id,parent_id,progress_mode,manual_progress,start_date,due_date,status,approved_at,submitted_at,
        created_at,horizon,source,kind) VALUES ('individual',?,?,?,?,?,?,?,?,?,?,?,?,?,'manual',?)`,
      title, ownerId, owner.team_id, parent?.id ?? team?.id ?? null, steps.length ? "milestones" : "manual", steps.length ? null : 0, start, end,
      status, status === "approved" ? at : null, status === "pending" ? at : null, at, horizon, kind);
    steps.forEach((t, i) => run("INSERT INTO milestones (goal_id,title,due_date,position) VALUES (?,?,?,?)", gid, t, end, i));
    for (const c of children) run("UPDATE goals SET parent_id = ? WHERE id = ?", gid, c!.id);
    run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", gid,
      children.length ? `Goal created from ${children.length} ${GATHERS[horizon]}ly goal${children.length === 1 ? "" : "s"}` : "Goal created", note, ownerId, at);
    return gid;
  });
  rollUpProgress(children.length ? id : parent?.id ?? null);
  if (kind === "work" && status === "draft" && input.send) submitGoal(id);
  return id;
}

/** The owner rewords a goal they set. A work goal that was approved goes back to their manager. */
export function editOwnGoal(goalId: number, byId: string, title: string) {
  const g = ownPlanGoals(byId).find((x) => x.id === goalId);
  if (!g || !isOwn(g)) throw new Error("Not your goal");
  const text = title.trim().replace(/\s+/g, " ");
  if (text.length < 3 || text.length > 200) throw new Error("Write the goal in 3 to 200 characters");
  if (text === g.title) return;
  run("UPDATE goals SET title = ? WHERE id = ?", text, goalId);
  run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goalId, `Reworded from “${g.title}”`, null, byId, now());
  if (g.kind === "work" && g.status === "approved" && g.approved_by) submitGoal(goalId);
}

/** Goals inside this one, and inside those (a quarter's months and their weeks). */
export function goalsBelow(goalId: number): Goal[] {
  const out: Goal[] = [];
  for (const g of goalsInside(goalId)) out.push(g, ...goalsBelow(g.id));
  return out;
}
