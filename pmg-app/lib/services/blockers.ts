// Raising and handling blockers beyond the basics in mutations.ts: categories, several people or teams at once,
// a team's head passing a blocker on, 1:1 requests, and the prompts that invite a blocker (an overdue task, or a
// week goal that's behind). Anything PMG would send outside itself (Slack, Google Chat, email, calendar invites)
// is mocked: it's written to the outbox and shown on the blocker, never sent.
import { randomUUID } from "node:crypto";
import { all, get, run } from "@/lib/db";
import { getBlocker, getGoal, getPerson, goalsFor, listPeople, listTeams, milestonesFor, setting, type Goal, type Milestone, type Person } from "@/lib/repo";
import { BLOCKER_CATEGORIES, draftBlockerEmail, type BlockerCategory } from "@/lib/logic/blocked";
import { goalProgress } from "@/lib/logic/health";
import { planLabel } from "@/lib/planner";
import { raiseBlocker, setSetting } from "@/lib/services/mutations";
import { markHandledWhere, sendChat } from "@/lib/chat";
import { daysBetween, nextWorkday, now, today, weekStart } from "@/lib/time";

const first = (id: string) => getPerson(id)?.name.split(" ")[0] ?? id;

/** The organisation's messaging channel for PMG notifications (set by HR on Integrations). */
export const notifyChannel = () => setting("notify.channel") || "slack";

/** Records a message PMG would send outside itself. Mocked: nothing leaves PMG. */
export function mockSend(toId: string, channel: string, kind: string, body: string, subject: string | null = null, blockerId: number | null = null) {
  return run("INSERT INTO outbox (to_id,channel,kind,subject,body,blocker_id,at) VALUES (?,?,?,?,?,?,?)", toId, channel, kind, subject, body, blockerId, now());
}

/** A team's head: the member whose own manager is outside the team (the one with most people under them if there are several). */
export function teamHead(teamId: string): Person | undefined {
  const members = listPeople().filter((p) => p.team_id === teamId);
  const ids = new Set(members.map((p) => p.id));
  const tops = members.filter((p) => !p.manager_id || !ids.has(p.manager_id));
  const reach = (id: string): number => members.filter((p) => p.manager_id === id).reduce((n, p) => n + 1 + reach(p.id), 0);
  return tops.sort((a, b) => reach(b.id) - reach(a.id))[0];
}

export type RaiseInput = {
  title: string; category: string; people: string[]; teams: string[]; none: boolean;
  notify: "manager" | "person" | "none"; notifyPerson: string | null;
  goalId: number | null; milestoneId: number | null; needed: string; needBy: string | null; details: string; origin: string;
};

/**
 * Raises a blocker. For People and dependencies, one request goes to each person tagged and to the head of each
 * team tagged (who can pass it on); "None" just tracks it. For other kinds the employee chooses to tell their
 * manager, someone else, or nobody. Each request goes out in PMG chat, plus a mocked message on the org's channel
 * and an email PMG drafts from what they entered. Returns the ids, one per person.
 */
export function raiseBlockerFor(raisedBy: string, input: RaiseInput): number[] {
  const me = getPerson(raisedBy);
  if (!me) throw new Error("Unknown person");
  const title = input.title.trim();
  if (title.length < 3) throw new Error("Say what's stuck");
  if (!BLOCKER_CATEGORIES.some((c) => c.key === input.category)) throw new Error("Pick what kind of blocker it is");
  const goal = input.goalId ? goalsFor(raisedBy).find((g) => g.id === input.goalId) : undefined;
  if (input.goalId && !goal) throw new Error("Pick one of your goals");
  const milestone = goal && input.milestoneId ? milestonesFor(goal.id).find((m) => m.id === input.milestoneId) : undefined;
  if (input.needBy && !/^\d{4}-\d{2}-\d{2}$/.test(input.needBy)) throw new Error("Pick a date it's needed by");

  // Who gets it: [person, team they were reached through].
  let parties: [string, string | null][] = [];
  if ((input.category as BlockerCategory) === "people") {
    if (input.none) parties = [[raisedBy, null]];
    else {
      for (const id of input.people) if (id !== raisedBy && getPerson(id)) parties.push([id, null]);
      for (const t of input.teams) {
        const head = teamHead(t);
        if (head && head.id !== raisedBy) parties.push([head.id, t]);
      }
      parties = parties.filter(([id], i) => parties.findIndex(([x]) => x === id) === i);
      if (!parties.length) throw new Error("Pick who can unblock it, or None");
    }
  } else {
    const to = input.notify === "manager" ? me.manager_id : input.notify === "person" ? input.notifyPerson : null;
    if (input.notify === "person" && (!to || !getPerson(to) || to === raisedBy)) throw new Error("Pick who to tell");
    parties = [[to ?? raisedBy, null]];
  }

  const group = randomUUID();
  const channel = notifyChannel();
  return parties.map(([ownerId, teamId]) => {
    const id = raiseBlocker(raisedBy, {
      title, ownerId, goalId: goal?.id ?? null, needBy: input.needBy || null, details: input.details.trim() || null,
      category: input.category, needed: input.needed.trim() || null, milestoneId: milestone?.id ?? null, origin: input.origin || "page", groupKey: group, teamId,
    });
    if (ownerId !== raisedBy) {
      const email = draftBlockerEmail({ title, needed: input.needed, details: input.details, needBy: input.needBy, goal: goal?.title, milestone: milestone?.title }, me.name, getPerson(ownerId)!.name);
      mockSend(ownerId, "email", "blocker_email", email.body, email.subject, id);
      if (channel !== "email") mockSend(ownerId, channel, "blocker_request", `${me.name} is blocked: ${title}. Accept · Need info · Not me`, null, id);
    }
    return id;
  });
}

/** A team's head passes a blocker that reached them through the team to someone in it. */
export function delegateBlocker(blockerId: number, actorId: string, toId: string) {
  const b = getBlocker(blockerId);
  const to = getPerson(toId);
  if (!b || b.status === "resolved") throw new Error("Unknown blocker");
  if (!b.team_id || b.owner_id !== actorId) throw new Error("Only the team head it was sent to can pass it on");
  if (!to || to.team_id !== b.team_id || toId === actorId || toId === b.raised_by) throw new Error("Pick someone in the team");
  run("UPDATE blockers SET owner_id = ?, delegated_by = ?, status = 'waiting', reply = ? WHERE id = ?", toId, actorId, `${first(actorId)} passed this to ${first(toId)}`, blockerId);
  markHandledWhere(actorId, "blocker_request", "blockerId", blockerId, "delegated");
  sendChat(toId, "blocker_request", `${getPerson(b.raised_by)?.name} is blocked: ${b.title} (passed to you by ${first(actorId)})`, { blockerId, needBy: b.need_by, details: b.details, needed: b.needed });
  sendChat(b.raised_by, "blocker_update", `${first(actorId)} passed your blocker “${b.title}” to ${to.name}.`, { blockerId });
  mockSend(toId, notifyChannel(), "blocker_request", `${getPerson(b.raised_by)?.name} is blocked: ${b.title} (passed on by ${first(actorId)})`, null, blockerId);
}

/**
 * Asks for a quick 1:1 about a blocker with the other person on it (whoever can unblock it, or the employee who
 * raised it). It's added to their next 1:1 when one is already booked between them; the calendar invite is mocked.
 */
export function requestBlockerMeeting(blockerId: number, actorId: string): string {
  const b = getBlocker(blockerId);
  if (!b || b.status === "resolved") throw new Error("Unknown blocker");
  if (actorId !== b.raised_by && actorId !== b.owner_id) throw new Error("Only people on the blocker can ask");
  const other = actorId === b.raised_by ? (b.owner_id !== b.raised_by ? b.owner_id : getPerson(actorId)?.manager_id) : b.raised_by;
  if (!other) throw new Error("There's no one to meet");
  const when = `${nextWorkday(today())}T11:00`;
  run("UPDATE blockers SET meeting_requested_at = ? WHERE id = ?", now(), blockerId);
  const booked = get<{ id: number }>(`SELECT id FROM one_on_ones WHERE scheduled_at >= ? AND ((employee_id = ? AND manager_id = ?) OR (employee_id = ? AND manager_id = ?)) ORDER BY scheduled_at LIMIT 1`,
    today(), actorId, other, other, actorId);
  if (booked) run("INSERT INTO agenda_topics (one_on_one_id,author_id,text,at) VALUES (?,?,?,?)", booked.id, actorId, `Blocker: ${b.title}`, now());
  sendChat(other, "text", `${getPerson(actorId)?.name} asked for a quick 1:1 to clear the blocker “${b.title}”.${booked ? " It's on the agenda of your next 1:1." : ` Suggested: ${nextWorkday(today())} at 11:00, 15 minutes.`}`,
    { blockerId, href: "/blockers" });
  mockSend(other, "calendar", "meeting_invite", `15 minutes with ${getPerson(actorId)?.name} on ${when.replace("T", " at ")} to clear “${b.title}”`, `Unblock: ${b.title}`, blockerId);
  return other;
}

/** The employee who raised a group of blockers marks it resolved: every request in it closes. */
export const blockersInGroup = (b: { id: number; group_key: string | null }) =>
  b.group_key ? all<{ id: number }>("SELECT id FROM blockers WHERE group_key = ? AND status != 'resolved'", b.group_key).map((x) => x.id) : [b.id];

export const outboxFor = (blockerIds: number[]) =>
  blockerIds.length ? all<{ id: number; to_id: string; channel: string; kind: string; subject: string | null; body: string; blocker_id: number; at: string }>(
    `SELECT * FROM outbox WHERE blocker_id IN (${blockerIds.map(() => "?").join(",")}) ORDER BY id`, ...blockerIds) : [];

// ── Prompts that invite a blocker ──

export type OverdueTask = { milestone: Milestone; goal: Goal; due: string; daysLate: number };

/**
 * Tasks past their date and still open on the person's work goals. A ticket PMG moved to a later week is due in
 * that week, so only its latest plan counts.
 */
export function overdueTasks(personId: string): OverdueTask[] {
  const t = today();
  const latest = new Map<string, OverdueTask>();
  for (const g of goalsFor(personId)) {
    if (g.horizon === "month" || g.horizon === "quarter" || g.horizon === "feature") continue;
    for (const m of milestonesFor(g.id)) {
      if (!m.due_date) continue;
      const key = m.work_item_id ? `item:${m.work_item_id}` : `m:${m.id}`;
      const seen = latest.get(key);
      if (!seen || m.due_date > seen.due) latest.set(key, { milestone: m, goal: g, due: m.due_date, daysLate: daysBetween(m.due_date, t) });
    }
  }
  const items = new Map(all<{ id: number; status: string; marked_done_at: string | null }>("SELECT id, status, marked_done_at FROM work_items WHERE person_id = ?", personId).map((i) => [i.id, i]));
  const open = new Set(all<{ milestone_id: number }>("SELECT milestone_id FROM blockers WHERE raised_by = ? AND status != 'resolved' AND milestone_id IS NOT NULL", personId).map((x) => x.milestone_id));
  return [...latest.values()].filter(({ milestone: m, due, goal }) => {
    const item = m.work_item_id ? items.get(m.work_item_id) : undefined;
    return due < t && !m.done_at && !(item && (item.status === "done" || item.marked_done_at || item.status === "on_hold")) && !open.has(m.id) && goal.status === "approved";
  }).sort((a, b) => a.due.localeCompare(b.due));
}

export type BehindGoal = { goal: Goal; progress: number; day: number };

/**
 * PMG's nudge: from Wednesday, a goal for this week that's under halfway (and has no open blocker) gets a
 * "Is something in the way?" prompt, until the employee says it's fine.
 */
export function behindGoals(personId: string): BehindGoal[] {
  const t = today(), cw = weekStart(t);
  const day = daysBetween(cw, t) + 1; // Monday is day 1
  if (day < 3) return [];
  const blocked = new Set(all<{ goal_id: number }>("SELECT goal_id FROM blockers WHERE raised_by = ? AND status != 'resolved' AND goal_id IS NOT NULL", personId).map((x) => x.goal_id));
  return goalsFor(personId)
    .filter((g) => g.horizon === "week" && g.start_date === cw && !blocked.has(g.id) && setting(`nudge.off.${personId}.${g.id}`) !== cw)
    .map((goal) => ({ goal, progress: goalProgress(goal, milestonesFor(goal.id)), day }))
    .filter((x) => x.progress < 0.5);
}

/** "Not blocked": hides the nudge for that goal for the rest of the week. */
export function dismissNudge(personId: string, goalId: number) {
  const g = getGoal(goalId);
  if (g?.owner_id === personId) setSetting(`nudge.off.${personId}.${goalId}`, weekStart(today()));
}

export const describeNudge = (b: BehindGoal) =>
  `It's ${["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][b.day]} and your goal for ${planLabel(b.goal)} is at ${Math.round(b.progress * 100)}%.`;

export const teamsWithHeads = () => listTeams().map((t) => ({ id: t.id, name: t.name, head: teamHead(t.id) })).filter((t) => t.head);
