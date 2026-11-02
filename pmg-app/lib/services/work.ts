// Work items from connectors (or typed in by hand) and the goals PMG plans from them.
// Jira owns ticket status; PMG owns the goals. A sync updates the items, then replan() re-plans: new weeks are
// drafted for the employee to send for approval, and tickets joining an approved week wait for the manager.
import { all, get, run, tx } from "@/lib/db";
import { allConnections, getGoal, getPerson, getWorkItem, plannedGoal, workItemsFor } from "@/lib/repo";
import { CONNECTORS } from "@/lib/connectors";
import { buildPlan, monthOfWeek, planLabel } from "@/lib/planner";
import { SOURCE_LABEL, applyPlan, approvalMessage, needsWords, planRows, tasksNeedingMilestones, upsertWorkItems, type Sql } from "@/lib/planner/store";
import { writeMilestones, writePlanGoals } from "@/lib/ai";
import { decideGoal, submitGoal } from "@/lib/services/mutations";
import { markHandledWhere, sendChat } from "@/lib/chat";
import { now, today, weekStart } from "@/lib/time";

const sql: Sql = { run, get, all };
const first = (id: string | null | undefined) => (id ? getPerson(id)?.name.split(" ")[0] ?? id : "");
const sourcesOf = (personId: string) => [...new Set(workItemsFor(personId).map((i) => SOURCE_LABEL[i.source] ?? i.source))].join(" and ");

/**
 * Re-plans the person's goals from their work items. Returns the ids of week goals it newly drafted. With
 * `reword: false` (a tick on the plan) it skips the LLM so the page answers at once; goals keep their wording.
 */
export async function replan(personId: string, { reword = true } = {}): Promise<number[]> {
  const person = getPerson(personId);
  if (!person) return [];
  // Milestones first, so the goals are written from what each task achieves rather than its ticket title.
  const unwritten = !reword ? [] : tasksNeedingMilestones(buildPlan(workItemsFor(personId), today()));
  const outcomes = await writeMilestones(unwritten.map(({ item, feature }) => ({ key: String(item.id), task: item.title, feature: feature.theme, epic: feature.epic })));
  for (const { item } of unwritten) {
    const text = outcomes.get(String(item.id));
    if (text) run("UPDATE work_items SET outcome = ?, outcome_of = ? WHERE id = ?", text, item.title, item.id);
  }
  const plan = buildPlan(workItemsFor(personId), today());
  const words = reword ? await writePlanGoals(planRows(plan).filter((r) => needsWords(sql, personId, r)).map((r) => r.spec)) : new Map();
  const { drafted, added } = tx(() => applyPlan(sql, personId, plan, words, now()));

  const fresh = drafted.map((id) => getGoal(id)!).filter((g) => g.start_date >= weekStart(today()));
  if (fresh.length) {
    sendChat(personId, "text", `PMG planned ${fresh.length === 1 ? `your goal for ${planLabel(fresh[0])}` : `${fresh.length} new week goals`} from ${sourcesOf(personId)}: `
      + `${fresh.map((g) => g.title).join("; ")}. Check ${fresh.length === 1 ? "it" : "them"} on Goals and ask ${first(person.manager_id) || "your manager"} to approve.`, { goalId: fresh[0].id });
  }
  for (const { goalId, milestoneId } of added) {
    const goal = getGoal(goalId)!;
    const m = get<{ title: string }>("SELECT title FROM milestones WHERE id = ?", milestoneId)!;
    if (person.manager_id) {
      sendChat(person.manager_id, "plan_change", `“${m.title}” joined ${first(personId)}'s approved goal for ${planLabel(goal)}: ${goal.title}. Approve adding it to the week?`,
        { goalId, milestoneId, personId });
    }
  }
  return drafted;
}

// ── Approvals: the employee asks, or the manager edits and approves directly ──

/** The employee sends a drafted goal to their manager: a week PMG planned, or a goal they set themselves. */
export function requestApproval(goalId: number, byId: string) {
  const goal = getGoal(goalId);
  if (!goal || goal.owner_id !== byId) throw new Error("Not your goal");
  if (goal.status === "approved" || goal.status === "pending") return;
  if (goal.source !== "ai") return submitGoal(goalId);
  const manager = getPerson(byId)?.manager_id;
  run("UPDATE goals SET status = 'pending', submitted_at = ? WHERE id = ?", now(), goalId);
  run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goalId, `Sent to ${first(manager) || "the manager"} for approval`, null, byId, now());
  if (manager) sendChat(manager, "approval_request", approvalMessage(getPerson(byId)!.name, goal, sourcesOf(byId)), { goalId });
}

/** The manager rewords a planned goal (PMG won't reword it again), and can approve it in the same step. */
export function editPlannedGoal(goalId: number, managerId: string, text: { title: string; doneWhen: string }, approve: boolean) {
  const goal = getGoal(goalId);
  if (!goal) throw new Error("Unknown goal");
  if (getPerson(goal.owner_id)?.manager_id !== managerId) throw new Error("Only the owner's manager can edit this goal");
  const title = text.title.trim(), doneWhen = text.doneWhen.trim();
  if (!title) throw new Error("The goal needs a title");
  const changed = [title !== goal.title && "title", doneWhen !== (goal.measure ?? "") && "what done looks like"].filter(Boolean);
  if (changed.length) {
    run("UPDATE goals SET title = ?, measure = ?, title_locked = 1 WHERE id = ?", title, doneWhen || null, goalId);
    run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goalId, `${first(managerId)} edited the ${changed.join(" and ")}`, goal.title !== title ? `Was: ${goal.title}` : null, managerId, now());
  }
  if (approve && goal.status !== "approved") decideGoal(goalId, managerId, changed.length ? "approve_edits" : "approve", "");
}

/** The manager accepts a ticket that joined an approved week. */
export function approveAddition(milestoneId: number, managerId: string) {
  const m = get<{ id: number; goal_id: number; title: string; pending_since: string | null }>("SELECT * FROM milestones WHERE id = ?", milestoneId);
  const goal = m && getGoal(m.goal_id);
  if (!m || !goal) throw new Error("Unknown milestone");
  if (getPerson(goal.owner_id)?.manager_id !== managerId) throw new Error("Only the owner's manager can approve this");
  if (m.pending_since) {
    run("UPDATE milestones SET pending_since = NULL WHERE id = ?", milestoneId);
    run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goal.id, `${first(managerId)} approved adding “${m.title}”`, null, managerId, now());
  }
  markHandledWhere(managerId, "plan_change", "milestoneId", milestoneId, "approve");
}

/** The manager sets a week goal for someone on their team, optionally tied to their tickets. It's approved as set. */
export function assignWeekGoal(managerId: string, personId: string, input: { week: string; title: string; doneWhen: string; itemIds: number[] }) {
  const person = getPerson(personId);
  if (!person || person.manager_id !== managerId) throw new Error("You can only set goals for your own team");
  const title = input.title.trim();
  if (!title) throw new Error("The goal needs a title");
  const ws = weekStart(input.week || today());
  if (ws < weekStart(today())) throw new Error("Pick this week or a later one");
  const at = now();
  const parent = plannedGoal(personId, `month:${monthOfWeek(ws).start}`);
  const id = run(`INSERT INTO goals (level,title,owner_id,team_id,parent_id,measure,progress_mode,start_date,due_date,status,approved_by,approved_at,created_at,horizon,source)
                  VALUES ('individual',?,?,?,?,?,'milestones',?,date(?, '+6 days'),'approved',?,?,?,'week','manager')`,
    title, personId, person.team_id, parent?.id ?? null, input.doneWhen.trim() || null, ws, ws, managerId, at, at);
  input.itemIds.map((i) => getWorkItem(i)).filter((i) => i?.person_id === personId).forEach((i, n) => {
    run("INSERT INTO milestones (goal_id,title,due_date,done_at,position,work_item_id) VALUES (?,?,?,?,?,?)",
      id, i!.external_key && i!.source !== "manual" ? `${i!.title} (${i!.external_key})` : i!.title, i!.due_date, i!.done_at, n, i!.id);
  });
  run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", id, `Set by ${first(managerId)}`, null, managerId, at);
  const goal = getGoal(id)!;
  sendChat(personId, "approval_result", `${getPerson(managerId)?.name} set a goal for your ${planLabel(goal)}: ${title}`, { goalId: id });
  return id;
}

export type SyncResult = { personId: string; kind: string; ok: boolean; items?: number; added?: number; drafted?: number; error?: string };

/** Pulls fresh items from every connection (or one person's), then replans those people. */
export async function syncConnections(personId?: string): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const c of allConnections().filter((x) => !personId || x.person_id === personId)) {
    const connector = CONNECTORS[c.kind];
    if (!connector?.configured()) {
      run("UPDATE connections SET last_error = ? WHERE id = ?", `${connector?.label ?? c.kind} isn't set up on this server`, c.id);
      results.push({ personId: c.person_id, kind: c.kind, ok: false, error: "not configured" });
      continue;
    }
    try {
      const items = await connector.fetch(c.external_id);
      const added = tx(() => upsertWorkItems(sql, c.person_id, items, now()));
      run("UPDATE connections SET last_synced_at = ?, last_error = NULL WHERE id = ?", new Date().toISOString(), c.id);
      const drafted = await replan(c.person_id);
      results.push({ personId: c.person_id, kind: c.kind, ok: true, items: items.length, added, drafted: drafted.length });
    } catch (e) {
      run("UPDATE connections SET last_error = ? WHERE id = ?", (e as Error).message.slice(0, 300), c.id);
      results.push({ personId: c.person_id, kind: c.kind, ok: false, error: (e as Error).message });
    }
  }
  return results;
}

// ── Manual work, for people whose company has no connector or who don't keep one up to date ──

const SIZES: Record<string, number> = { small: 0.5, medium: 1, large: 3 };

export async function addManualItem(personId: string, input: { title: string; size: string; due: string | null; started: boolean }) {
  const title = input.title.trim();
  if (!title) throw new Error("Give the work a name");
  tx(() => upsertWorkItems(sql, personId, [{
    source: "manual", external_key: `M-${Date.now().toString(36)}`, url: null, title, kind: "Task",
    status: input.started ? "in_progress" : "todo", status_label: input.started ? "In progress" : "To do", size: SIZES[input.size] ?? 1,
    parent_key: null, parent_title: null, epic_key: null, epic_title: null,
    created_at: today(), started_at: input.started ? today() : null, done_at: null, due_date: input.due || null,
  }], now()));
  return replan(personId);
}

export async function setManualStatus(itemId: number, personId: string, status: "todo" | "in_progress" | "done") {
  const item = getWorkItem(itemId);
  if (!item || item.person_id !== personId) throw new Error("Not your work item");
  if (item.source !== "manual") throw new Error(`This comes from ${SOURCE_LABEL[item.source] ?? item.source}; update it there`);
  const label = { todo: "To do", in_progress: "In progress", done: "Done" }[status];
  run("UPDATE work_items SET status = ?, status_label = ?, started_at = ?, done_at = ? WHERE id = ?",
    status, label, status === "todo" ? null : item.started_at ?? today(), status === "done" ? today() : null, itemId);
  return replan(personId);
}

/**
 * The person ticks a task's milestone on their plan (or unticks it). Their own tasks change status; a Jira task is
 * marked done in PMG from today, without writing to Jira, until a sync brings Jira's own done date.
 */
export async function markTaskDone(itemId: number, personId: string, done: boolean) {
  const item = getWorkItem(itemId);
  if (!item || item.person_id !== personId) throw new Error("Not your task");
  if (item.source === "manual") {
    run("UPDATE work_items SET status = ?, status_label = ?, started_at = ?, done_at = ? WHERE id = ?",
      done ? "done" : "in_progress", done ? "Done" : "In progress", item.started_at ?? today(), done ? today() : null, itemId);
  } else {
    if (!done && item.status === "done") throw new Error(`Done in ${SOURCE_LABEL[item.source] ?? item.source}; reopen it there`);
    run("UPDATE work_items SET marked_done_at = ? WHERE id = ?", done ? today() : null, itemId);
  }
  await replan(personId, { reword: false });
  // The weeks the task now shows in: a past week it was planned in, plus this week once done (or wherever it's planned again).
  return all<{ start_date: string }>(`SELECT g.start_date FROM goals g JOIN milestones m ON m.goal_id = g.id
    WHERE g.owner_id = ? AND g.horizon = 'week' AND m.work_item_id = ? ORDER BY g.start_date`, personId, itemId).map((w) => w.start_date);
}

// ── Background sync while the server runs ──

const g = globalThis as unknown as { __pmgSyncTimer?: NodeJS.Timeout };

/** Syncs every connection now and then every 15 minutes. PMG_SYNC=off turns it off. */
export function startSyncLoop(minutes = 15) {
  if (g.__pmgSyncTimer || process.env.PMG_SYNC === "off") return;
  const tick = () => syncConnections().then((r) => {
    const bad = r.filter((x) => !x.ok);
    if (bad.length) console.warn("[pmg] sync:", bad.map((b) => `${b.personId}/${b.kind}: ${b.error}`).join("; "));
  }).catch((e) => console.warn("[pmg] sync failed:", (e as Error).message));
  g.__pmgSyncTimer = setInterval(tick, minutes * 60_000);
  void tick();
}
