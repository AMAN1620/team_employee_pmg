// Write-side operations shared by server actions, the chat simulator and the Slack bridge.
import { all, get, run, tx } from "@/lib/db";
import {
  activeCycle, checkinItems, getBlocker, getCheckin, getGoal, getPerson, getReview, goalsInside, milestonesFor, pendingCheckin,
  type CheckinItem, type Goal, type ReviewPayload,
} from "@/lib/repo";
import { sendChat, markHandledWhere } from "@/lib/chat";
import { draftSelfAppraisal, sortCheckin } from "@/lib/ai";
import { blockerDays } from "@/lib/logic/blocked";
import { checkinContext, evidenceFor, goalViewsFor } from "@/lib/services/views";
import { addDays, now, today, weekStart } from "@/lib/time";
import { planLabel } from "@/lib/planner";
import { rollUpProgress } from "@/lib/services/rollup";

const first = (id: string) => getPerson(id)?.name.split(" ")[0] ?? id;
const nameOf = (id: string) => getPerson(id)?.name ?? id;

// ── Check-ins (3.1, 3.2) ──────────────────────────────────────────────────────

export async function submitCheckin(personId: string, input: { moved: string; stuck: string; next: string; mood: number | null }, source: "web" | "chat") {
  const person = getPerson(personId);
  if (!person) throw new Error("Unknown person");
  const items = await sortCheckin({ moved: input.moved, stuck: input.stuck, next: input.next }, checkinContext(person));
  return tx(() => {
    // A new reply replaces an unconfirmed one for the same week.
    const existing = pendingCheckin(personId);
    if (existing) {
      run("DELETE FROM checkin_items WHERE checkin_id = ?", existing.id);
      run("DELETE FROM checkins WHERE id = ?", existing.id);
    }
    const id = run("INSERT INTO checkins (person_id,week_of,moved,stuck,next,mood,source,status,submitted_at) VALUES (?,?,?,?,?,?,?,?,?)",
      personId, weekStart(today()), input.moved, input.stuck, input.next, input.mood, source, "pending", now());
    for (const it of items) {
      const data: Record<string, unknown> = {};
      if (it.kind === "blocker") { data.ownerId = it.ownerId; data.needBy = it.needBy; }
      if (it.kind === "existing_blocker") { data.blockerId = it.blockerId; data.action = "nudge"; }
      if (it.kind === "unplanned") data.tag = it.tag;
      if (it.kind === "win") data.visibility = person.default_visibility;
      run("INSERT INTO checkin_items (checkin_id,kind,text,goal_id,data) VALUES (?,?,?,?,?)", id, it.kind, it.text, it.goalId, JSON.stringify(data));
    }
    run("UPDATE chat_messages SET handled = 'answered' WHERE to_id = ? AND kind = 'checkin_prompt' AND handled IS NULL", personId);
    return id;
  });
}

export function updateCheckinItem(itemId: number, patch: { state?: CheckinItem["state"]; text?: string; goalId?: number | null; data?: Record<string, unknown> }) {
  const item = get<CheckinItem>("SELECT * FROM checkin_items WHERE id = ?", itemId);
  if (!item) throw new Error("Unknown item");
  const data = { ...JSON.parse(item.data), ...(patch.data ?? {}) };
  run("UPDATE checkin_items SET state = ?, text = ?, goal_id = ?, data = ? WHERE id = ?",
    patch.state ?? item.state, patch.text ?? item.text, patch.goalId === undefined ? item.goal_id : patch.goalId, JSON.stringify(data), itemId);
}

/** Turns confirmed items into goal activity, wins, blockers and nudges. Removed items are dropped. */
export function confirmCheckin(checkinId: number) {
  const checkin = getCheckin(checkinId);
  if (!checkin || checkin.status === "confirmed") return;
  const items = checkinItems(checkinId).filter((i) => i.state !== "removed");
  const created: string[] = [];
  tx(() => {
    for (const it of items) {
      const data = JSON.parse(it.data) as Record<string, string | number | null>;
      if (it.kind === "progress" && it.goal_id) {
        run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", it.goal_id, `Check-in: ${it.text}`, null, checkin.person_id, now());
      } else if (it.kind === "win") {
        run("INSERT INTO wins (person_id,kind,title,goal_id,visibility,evidence,source,at) VALUES (?,?,?,?,?,?,?,?)",
          checkin.person_id, "win", it.text, it.goal_id, String(data.visibility ?? "manager"), JSON.stringify(data.link ? [{ kind: "link", label: "Evidence", url: data.link }] : []), "checkin", now());
        created.push("win");
      } else if (it.kind === "unplanned") {
        run("INSERT INTO wins (person_id,kind,title,visibility,source,tag,at) VALUES (?,?,?,?,?,?,?)", checkin.person_id, "unplanned", it.text, "manager", "checkin", String(data.tag ?? "Unplanned"), now());
        created.push("unplanned");
      }
      run("UPDATE checkin_items SET state = 'confirmed' WHERE id = ?", it.id);
    }
    run("UPDATE checkins SET status = 'confirmed', confirmed_at = ? WHERE id = ?", now(), checkinId);
  });
  // Blockers and nudges send chat messages, so they run after the transaction.
  for (const it of items) {
    const data = JSON.parse(it.data) as Record<string, string | number | null>;
    if (it.kind === "blocker" && data.ownerId) {
      raiseBlocker(checkin.person_id, { title: it.text, ownerId: String(data.ownerId), goalId: it.goal_id, needBy: (data.needBy as string) ?? addDays(today(), 5), details: null, category: "people", origin: "checkin" });
    } else if (it.kind === "existing_blocker" && data.blockerId) {
      if (data.action === "resolved") resolveBlocker(Number(data.blockerId), checkin.person_id);
      else nudgeBlocker(Number(data.blockerId));
    }
  }
}

// ── Blockers (1.1–1.4, 9.2) ───────────────────────────────────────────────────

export type BlockerExtras = { category?: string | null; needed?: string | null; milestoneId?: number | null; origin?: string | null; groupKey?: string | null; teamId?: string | null };

/** Saves a blocker and, when someone else can unblock it, sends them the request card in PMG chat. */
export function raiseBlocker(raisedBy: string, b: { title: string; ownerId: string; goalId: number | null; needBy: string | null; details: string | null } & BlockerExtras) {
  const id = run(`INSERT INTO blockers (raised_by,owner_id,goal_id,title,details,opened_at,need_by,status,category,needed,milestone_id,origin,group_key,team_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    raisedBy, b.ownerId, b.goalId, b.title, b.details, now(), b.needBy, "waiting", b.category ?? null, b.needed ?? null, b.milestoneId ?? null,
    b.origin ?? null, b.groupKey ?? null, b.teamId ?? null);
  const goal = b.goalId ? getGoal(b.goalId) : undefined;
  if (b.ownerId !== raisedBy) {
    const team = b.teamId ? get<{ name: string }>("SELECT name FROM teams WHERE id = ?", b.teamId)?.name : undefined;
    sendChat(b.ownerId, "blocker_request", `${nameOf(raisedBy)} is blocked: ${b.title}${team ? ` (sent to you as head of ${team}; you can pass it on)` : ""}`, {
      blockerId: id, goal: goal?.title ?? null, needBy: b.needBy, details: b.details, needed: b.needed ?? null,
    });
  }
  return id;
}

export function respondToBlocker(blockerId: number, actorId: string, response: "accept" | "needs_info" | "not_me", note?: string, redirectTo?: string) {
  const b = getBlocker(blockerId);
  if (!b) throw new Error("Unknown blocker");
  if (response === "not_me" && redirectTo && getPerson(redirectTo)) {
    run("UPDATE blockers SET owner_id = ?, status = 'waiting', reply = ? WHERE id = ?", redirectTo, `${first(actorId)} redirected this to ${first(redirectTo)}`, blockerId);
    sendChat(redirectTo, "blocker_request", `${nameOf(b.raised_by)} is blocked: ${b.title}`, { blockerId, needBy: b.need_by, redirectedBy: actorId });
    sendChat(b.raised_by, "blocker_update", `${first(actorId)} passed your blocker “${b.title}” to ${nameOf(redirectTo)}.`, { blockerId });
  } else {
    const status = response === "accept" ? "accepted" : response === "needs_info" ? "needs_info" : "redirected";
    const reply = note || (response === "accept" ? "On it" : response === "needs_info" ? "Needs more information" : "Not the right person");
    run("UPDATE blockers SET status = ?, reply = ? WHERE id = ?", status, reply, blockerId);
    const verb = response === "accept" ? "accepted" : response === "needs_info" ? "needs more info on" : "says they're not the right person for";
    sendChat(b.raised_by, "blocker_update", `${nameOf(actorId)} ${verb} your blocker “${b.title}”.${note ? ` “${note}”` : ""}`, { blockerId });
  }
  markHandledWhere(actorId, "blocker_request", "blockerId", blockerId, response);
}

/** Resolving records days blocked on the goal and credits the resolver's journal when they helped someone else. */
export function resolveBlocker(blockerId: number, actorId: string) {
  const b = getBlocker(blockerId);
  if (!b || b.status === "resolved") return;
  const at = now();
  run("UPDATE blockers SET status = 'resolved', resolved_at = ? WHERE id = ?", at, blockerId);
  const days = blockerDays({ opened_at: b.opened_at, resolved_at: at }, today());
  if (b.owner_id !== b.raised_by) {
    run("INSERT INTO wins (person_id,kind,title,visibility,source,at) VALUES (?,?,?,?,?,?)", b.owner_id, "helped",
      `Cleared ${first(b.raised_by)}'s blocker “${b.title}” in ${days} day${days > 1 ? "s" : ""}`, "manager", "auto", at);
  }
  if (actorId !== b.raised_by) sendChat(b.raised_by, "blocker_update", `${nameOf(actorId)} resolved your blocker “${b.title}”. Blocked for ${days} day${days > 1 ? "s" : ""}; that's saved on your goal.`, { blockerId });
  markHandledWhere(b.owner_id, "blocker_request", "blockerId", blockerId, "resolved");
}

export function nudgeBlocker(blockerId: number) {
  const b = getBlocker(blockerId);
  if (!b || b.status === "resolved") return;
  run("UPDATE blockers SET nudged_at = ? WHERE id = ?", now(), blockerId);
  sendChat(b.owner_id, "blocker_nudge", `Friendly nudge from ${first(b.raised_by)}: “${b.title}” is still blocking their work${b.need_by ? ` (needed by ${b.need_by})` : ""}.`, { blockerId });
}

export function escalateBlocker(blockerId: number, actorId: string) {
  const b = getBlocker(blockerId);
  if (!b || b.status === "resolved") return;
  const manager = getPerson(b.raised_by)?.manager_id;
  if (!manager) return;
  run("UPDATE blockers SET escalated_to = ?, escalated_at = ? WHERE id = ?", manager, now(), blockerId);
  sendChat(manager, "escalation", `${nameOf(actorId)} escalated a blocker: “${b.title}” has been waiting on ${nameOf(b.owner_id)} since ${b.opened_at.slice(0, 10)}.`, { blockerId });
}

// ── Wins and kudos (2.1, 9.1, 9.3) ────────────────────────────────────────────

export function addWin(personId: string, w: { title: string; body?: string | null; goalId?: number | null; visibility: string; link?: string | null; kind?: "win" | "unplanned"; tag?: string | null }) {
  const evidence = w.link ? [{ kind: /jira|atlassian/i.test(w.link) ? "jira" : "link", label: w.link.replace(/^https?:\/\//, "").slice(0, 28), url: w.link }] : [];
  return run("INSERT INTO wins (person_id,kind,title,body,goal_id,visibility,evidence,source,tag,at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    personId, w.kind ?? "win", w.title, w.body ?? null, w.goalId ?? null, w.visibility, JSON.stringify(evidence), "web", w.tag ?? null, now());
}

const PREF_TO_VISIBILITY: Record<string, string> = { private: "manager", team: "team", company: "company" };

export function giveKudos(fromId: string, toId: string, message: string, source: "web" | "chat") {
  const to = getPerson(toId);
  if (!to || toId === fromId) throw new Error("Pick someone else to thank");
  const id = run("INSERT INTO wins (person_id,kind,title,from_id,visibility,source,at) VALUES (?,?,?,?,?,?,?)",
    toId, "kudos", message, fromId, PREF_TO_VISIBILITY[to.recognition_pref] ?? "team", source, now());
  sendChat(toId, "kudos_notice", `${nameOf(fromId)} gave you kudos: ${message}. Added to your wins journal.`, { winId: id });
  return id;
}

export function setWinVisibility(winId: number, personId: string, visibility: string) {
  run("UPDATE wins SET visibility = ? WHERE id = ? AND person_id = ?", visibility, winId, personId);
}

export function rewordWin(winId: number, personId: string, title: string) {
  run("UPDATE wins SET title = ? WHERE id = ? AND person_id = ?", title, winId, personId);
}

export function setPreferences(personId: string, prefs: { recognition?: string; visibility?: string }) {
  if (prefs.recognition) run("UPDATE people SET recognition_pref = ? WHERE id = ?", prefs.recognition, personId);
  if (prefs.visibility) run("UPDATE people SET default_visibility = ? WHERE id = ?", prefs.visibility, personId);
}

// ── Goals (4.1–4.3, 8.2) ──────────────────────────────────────────────────────

export type GoalInput = {
  title: string; parentId: number | null; measure: string | null; baseline: number | null; target: number | null; unit: string | null;
  dueDate: string; rubric: { partial: string; meets: string; exceeds: string }; dependencies: string | null; milestones: { title: string; due: string | null }[];
};

export function createGoal(ownerId: string, g: GoalInput, submit: boolean) {
  const owner = getPerson(ownerId)!;
  const metric = g.baseline != null && g.target != null;
  const mode = metric ? "metric" : g.milestones.length ? "milestones" : "manual";
  const id = run(`INSERT INTO goals (level,title,owner_id,team_id,parent_id,measure,baseline,target,current,unit,progress_mode,manual_progress,due_date,
      rubric,dependencies,status,submitted_at,created_at,start_date) VALUES ('individual',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    g.title, ownerId, owner.team_id, g.parentId, g.measure, g.baseline, g.target, metric ? g.baseline : null, g.unit, mode, mode === "manual" ? 0 : null,
    g.dueDate, JSON.stringify(g.rubric), g.dependencies, submit ? "pending" : "draft", submit ? now() : null, now(), today());
  g.milestones.forEach((m, i) => run("INSERT INTO milestones (goal_id,title,due_date,position) VALUES (?,?,?,?)", id, m.title, m.due, i));
  if (submit) submitGoal(id);
  return id;
}

/** Goals someone set inside this one, and inside those, that haven't been approved yet. */
const waitingInside = (goalId: number): Goal[] => goalsInside(goalId).flatMap((g) => [...(g.status !== "approved" ? [g] : []), ...waitingInside(g.id)]);

/** Sends a work goal to the owner's manager, with the goals set inside it that are still drafts. */
export function submitGoal(goalId: number) {
  const goal = getGoal(goalId)!;
  if (goal.kind === "personal") throw new Error("Personal goals don't need approval");
  const inside = waitingInside(goalId);
  run("UPDATE goals SET status = 'pending', submitted_at = ? WHERE id = ?", now(), goalId);
  run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goalId, "Goal submitted for approval", null, goal.owner_id, now());
  for (const g of inside) {
    run("UPDATE goals SET status = 'pending', submitted_at = ? WHERE id = ?", now(), g.id);
    run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", g.id, `Sent for approval with the goal for ${planLabel(goal)}`, null, goal.owner_id, now());
  }
  const manager = getPerson(goal.owner_id)?.manager_id;
  const what = goal.horizon ? ` for ${planLabel(goal)}` : "";
  const with_ = inside.length ? ` (with ${inside.length} smaller goal${inside.length === 1 ? "" : "s"} inside)` : "";
  if (manager) sendChat(manager, "approval_request", `${nameOf(goal.owner_id)} proposed a goal${what}: ${goal.title}${with_}`, { goalId });
}

export function decideGoal(goalId: number, managerId: string, decision: "approve" | "approve_edits" | "changes", message: string) {
  const goal = getGoal(goalId);
  if (!goal) throw new Error("Unknown goal");
  if (getPerson(goal.owner_id)?.manager_id !== managerId) throw new Error("Only the owner's manager can decide");
  if (goal.kind === "personal") throw new Error("Personal goals don't need approval");
  const approved = decision !== "changes";
  run("UPDATE goals SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?", approved ? "approved" : "changes_requested", approved ? managerId : null, approved ? now() : null, goalId);
  // The goals set inside it go with it: approved together, or back to drafts while the owner reworks the plan.
  for (const g of waitingInside(goalId)) {
    run("UPDATE goals SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?", approved ? "approved" : "draft", approved ? managerId : null, approved ? now() : null, g.id);
    run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", g.id,
      approved ? `Approved with the goal for ${planLabel(goal)}` : `Back to draft: changes asked on the goal for ${planLabel(goal)}`, null, managerId, now());
    markHandledWhere(managerId, "approval_request", "goalId", g.id, decision);
  }
  run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goalId,
    decision === "approve" ? "Goal approved" : decision === "approve_edits" ? "Goal approved with edits" : "Changes requested", message || null, managerId, now());
  sendChat(goal.owner_id, "approval_result", `${nameOf(managerId)} ${approved ? "approved" : "asked for changes to"} your goal “${goal.title}”.${message ? ` “${message}”` : ""}`, { goalId, decision });
  markHandledWhere(managerId, "approval_request", "goalId", goalId, decision);
}

export function editGoal(goalId: number, byId: string, patch: { target?: number | null; rubric?: { partial: string; meets: string; exceeds: string } }, reason: string) {
  const goal = getGoal(goalId)!;
  const changes: string[] = [];
  if (patch.target !== undefined && patch.target !== goal.target) {
    run("UPDATE goals SET target = ? WHERE id = ?", patch.target, goalId);
    changes.push(`Target changed from ${goal.target}${goal.unit ?? ""} to ${patch.target}${goal.unit ?? ""}`);
  }
  if (patch.rubric) {
    run("UPDATE goals SET rubric = ? WHERE id = ?", JSON.stringify(patch.rubric), goalId);
    changes.push("Rubric updated");
  }
  for (const c of changes) run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goalId, c, reason || null, byId, now());
  if (changes.length && goal.status === "changes_requested") submitGoal(goalId);
}

export function addGoalComment(goalId: number, authorId: string, field: string | null, body: string) {
  run("INSERT INTO goal_comments (goal_id,field,author_id,body,at) VALUES (?,?,?,?,?)", goalId, field, authorId, body, now());
}

export function updateGoalProgress(goalId: number, byId: string, value: number) {
  const goal = getGoal(goalId)!;
  if (goal.owner_id !== byId) throw new Error("Only the owner updates progress");
  if (goal.progress_mode === "metric") run("UPDATE goals SET current = ? WHERE id = ?", value, goalId);
  else if (goal.progress_mode === "count") run("UPDATE goals SET count_done = ? WHERE id = ?", Math.round(value), goalId);
  else run("UPDATE goals SET manual_progress = ? WHERE id = ?", value, goalId);
  rollUpProgress(goal.parent_id);
  run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", goalId, `Progress updated to ${value}${goal.progress_mode === "metric" ? goal.unit ?? "" : goal.progress_mode === "count" ? ` of ${goal.count_total}` : "%"}`, null, byId, now());
}

export function toggleMilestone(milestoneId: number, byId: string) {
  const m = get<{ id: number; goal_id: number; done_at: string | null; title: string; work_item_id: number | null }>("SELECT * FROM milestones WHERE id = ?", milestoneId);
  if (!m) return;
  if (m.work_item_id) throw new Error("This milestone follows its ticket; update it in Jira or on My work");
  const goal = getGoal(m.goal_id)!;
  if (goal.owner_id !== byId) throw new Error("Only the owner updates milestones");
  run("UPDATE milestones SET done_at = ? WHERE id = ?", m.done_at ? null : now(), milestoneId);
  rollUpProgress(goal.parent_id);
  if (!m.done_at && goal.kind === "work") {
    run("INSERT INTO goal_changes (goal_id,summary,reason,by_id,at) VALUES (?,?,?,?,?)", m.goal_id, `Milestone done: ${m.title}`, null, byId, now());
    const manager = getPerson(goal.owner_id)?.manager_id;
    if (manager) sendChat(manager, "feedback_request", `${nameOf(goal.owner_id)} finished the milestone “${m.title}”. Give quick feedback?`, { goalId: goal.id, personId: goal.owner_id, milestone: m.title });
  }
  return milestonesFor(m.goal_id);
}

export function createCompanyGoal(ownerId: string, title: string, dueDate: string) {
  return run("INSERT INTO goals (level,title,owner_id,team_id,progress_mode,manual_progress,due_date,status,created_at) VALUES ('company',?,?,'people','manual',0,?,'approved',?)", title, ownerId, dueDate, now());
}

export function createTeamGoal(ownerId: string, parentId: number, title: string, dueDate: string) {
  const owner = getPerson(ownerId)!;
  return run("INSERT INTO goals (level,title,owner_id,team_id,parent_id,progress_mode,manual_progress,due_date,status,created_at) VALUES ('team',?,?,?,?,'manual',0,?,'approved',?)", title, ownerId, owner.team_id, parentId, dueDate, now());
}

export function setContribution(goalId: number, byId: string, text: string) {
  run("UPDATE goals SET contribution = ? WHERE id = ? AND owner_id = ?", text, goalId, byId);
}

// ── 1:1s (7.1–7.3) ────────────────────────────────────────────────────────────

export function addAgendaTopic(oneOnOneId: number, authorId: string, text: string) {
  run("INSERT INTO agenda_topics (one_on_one_id,author_id,text,at) VALUES (?,?,?,?)", oneOnOneId, authorId, text, now());
}

export function addActionItem(a: { employeeId: string; managerId: string; oneOnOneId: number | null; ownerId: string; text: string; due: string | null; goalId: number | null }) {
  const id = run("INSERT INTO action_items (employee_id,manager_id,one_on_one_id,owner_id,text,due,goal_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
    a.employeeId, a.managerId, a.oneOnOneId, a.ownerId, a.text, a.due, a.goalId, now());
  const other = a.ownerId === a.employeeId ? a.managerId : a.employeeId;
  sendChat(a.ownerId, "reminder", `New 1:1 action for you: “${a.text}”${a.due ? ` due ${a.due}` : ""}. ${first(other)} can see it too.`, { actionId: id, href: "/one-on-ones" });
  return id;
}

export function toggleAction(actionId: number) {
  const a = get<{ done_at: string | null }>("SELECT done_at FROM action_items WHERE id = ?", actionId);
  if (a) run("UPDATE action_items SET done_at = ? WHERE id = ?", a.done_at ? null : now(), actionId);
}

export function saveNotes(oneOnOneId: number, notes: string) {
  run("UPDATE one_on_ones SET notes = ? WHERE id = ?", notes, oneOnOneId);
}

/** Lines in notes that look like actions: "Action: …", "TODO …", "- [ ] …", "<Name> to …". */
export function findActionsInNotes(notes: string, employee: { id: string; name: string }, manager: { id: string; name: string }) {
  const out: { text: string; ownerId: string }[] = [];
  for (const raw of notes.split(/\n+/)) {
    const line = raw.trim().replace(/^[-*•]\s*(\[ \]\s*)?/, "");
    const m = line.match(/^(?:action|todo|ai)[:\-\s]+(.*)$/i);
    const named = line.match(new RegExp(`^(${employee.name.split(" ")[0]}|${manager.name.split(" ")[0]})\\s+(?:to|will)\\s+(.*)$`, "i"));
    if (named) out.push({ text: capitalizeFirst(named[2]), ownerId: named[1].toLowerCase() === manager.name.split(" ")[0].toLowerCase() ? manager.id : employee.id });
    else if (m) out.push({ text: capitalizeFirst(m[1]), ownerId: employee.id });
  }
  return out;
}

const capitalizeFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ── Feedback (6.1, 6.2) ───────────────────────────────────────────────────────

export function requestFeedback(requesterId: string, reviewerId: string, about: string, goalId: number | null, due: string | null, kind: string) {
  const id = run("INSERT INTO feedback_requests (requester_id,reviewer_id,goal_id,about,due,kind,status,at) VALUES (?,?,?,?,?,?,?,?)", requesterId, reviewerId, goalId, about, due, kind, "open", now());
  sendChat(reviewerId, "feedback_request", `${nameOf(requesterId)} asked for your feedback: “${about}”${due ? ` by ${due}` : ""}.`, { requestId: id, personId: requesterId, goalId });
  return id;
}

export function giveFeedback(fromId: string, toId: string, f: { about: string; goalId: number | null; keep: string; improve: string; nextAction: string; requestId: number | null }) {
  const id = run("INSERT INTO feedback (from_id,to_id,goal_id,about,keep,improve,next_action,request_id,at) VALUES (?,?,?,?,?,?,?,?,?)",
    fromId, toId, f.goalId, f.about, f.keep || null, f.improve || null, f.nextAction || null, f.requestId, now());
  if (f.requestId) {
    run("UPDATE feedback_requests SET status = 'answered' WHERE id = ?", f.requestId);
    markHandledWhere(fromId, "feedback_request", "requestId", f.requestId, "answered");
  }
  sendChat(toId, "feedback_notice", `${nameOf(fromId)} left feedback on “${f.about}”.`, { feedbackId: id, href: "/feedback" });
  return id;
}

// ── Reviews (5.1, S.6–S.9) ────────────────────────────────────────────────────

function upsertReview(cycleId: number, personId: string, reviewerId: string, kind: "self" | "manager", payload: ReviewPayload) {
  const existing = getReview(cycleId, personId, kind);
  if (existing) run("UPDATE reviews SET payload = ? WHERE id = ?", JSON.stringify(payload), existing.id);
  else run("INSERT INTO reviews (cycle_id,person_id,reviewer_id,kind,status,payload) VALUES (?,?,?,?,?,?)", cycleId, personId, reviewerId, kind, "draft", JSON.stringify(payload));
}

export async function draftSelfReview(personId: string) {
  const cycle = activeCycle();
  if (!cycle) throw new Error("No active review cycle");
  const goals = goalViewsFor(personId).map((g) => ({ id: g.id, title: g.title, health: g.h.health, progressText: g.progressText }));
  const draft = await draftSelfAppraisal(goals, evidenceFor(personId));
  const payload: ReviewPayload = {
    goals: Object.fromEntries(goals.map((g) => [String(g.id), { text: draft.goals[String(g.id)] ?? "", reviewed: false }])),
    beyond: draft.beyond, beyondReviewed: false,
  };
  upsertReview(cycle.id, personId, personId, "self", payload);
  return draft.source;
}

export function saveReview(personId: string, reviewerId: string, kind: "self" | "manager", payload: ReviewPayload) {
  const cycle = activeCycle()!;
  const existing = getReview(cycle.id, personId, kind);
  if (existing?.status === "submitted") throw new Error("Already submitted");
  upsertReview(cycle.id, personId, reviewerId, kind, payload);
}

export function submitReview(personId: string, reviewerId: string, kind: "self" | "manager") {
  const cycle = activeCycle()!;
  const review = getReview(cycle.id, personId, kind);
  if (!review) throw new Error("Nothing to submit");
  run("UPDATE reviews SET status = 'submitted', submitted_at = ? WHERE id = ?", now(), review.id);
  if (kind === "self") {
    const manager = getPerson(personId)?.manager_id;
    if (manager) sendChat(manager, "reminder", `${nameOf(personId)} submitted their self-appraisal. Your review is due ${cycle.manager_due}.`, { href: `/reviews/manager/${personId}` });
  } else {
    sendChat(personId, "reminder", `${nameOf(reviewerId)} submitted your manager review for ${cycle.name}.`, { href: "/reviews/self" });
  }
}

/** Chat reminders to people in the modelled org who haven't submitted yet. Returns how many were sent. */
export function sendReviewReminders(teamId?: string) {
  const cycle = activeCycle();
  if (!cycle) return 0;
  const people = teamId
    ? all<{ id: string }>("SELECT id FROM people WHERE team_id = ? AND role != 'hr' AND id != 'aditi'", teamId)
    : all<{ id: string }>("SELECT id FROM people WHERE role != 'hr' AND id != 'aditi'");
  let sent = 0;
  for (const p of people) {
    const self = getReview(cycle.id, p.id, "self");
    if (self?.status === "submitted") continue;
    sendChat(p.id, "reminder", `Reminder: your self-appraisal for ${cycle.name} is due ${cycle.self_due}. PMG can draft it from your wins in one click.`, { href: "/reviews/self" });
    sent++;
  }
  return sent;
}

// ── HR settings (S.3, S.6, S.7) ───────────────────────────────────────────────

export function setSetting(key: string, value: string) {
  run("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}

export function updateRatingLevel(cycleId: number, level: number, label: string, description: string) {
  run("UPDATE rating_levels SET label = ?, description = ? WHERE cycle_id = ? AND level = ?", label, description, cycleId, level);
}

export function setCycleFlags(cycleId: number, flags: { show_rubric?: boolean; require_comment?: boolean; forced_distribution?: boolean; peer_enabled?: boolean }) {
  for (const [k, v] of Object.entries(flags)) if (v !== undefined) run(`UPDATE review_cycles SET ${k} = ? WHERE id = ?`, v ? 1 : 0, cycleId);
}

export function sendCheckinPrompts() {
  const people = all<{ id: string; name: string }>("SELECT id, name FROM people WHERE role != 'hr' AND id != 'aditi' AND chat_connected = 1");
  for (const p of people) {
    if (!get("SELECT 1 FROM chat_messages WHERE to_id = ? AND kind = 'checkin_prompt' AND handled IS NULL", p.id))
      sendChat(p.id, "checkin_prompt", `Hi ${p.name.split(" ")[0]}, time for your weekly check-in. What moved? What's stuck? What's next?`);
  }
  return people.length;
}
