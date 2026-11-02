"use server";

import { blockersInGroup, delegateBlocker, requestBlockerMeeting } from "@/lib/services/blockers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePerson } from "@/lib/session";
import * as m from "@/lib/services/mutations";
import { activeCycle, getBlocker, getCheckin, getGoal, getOneOnOne, getPerson, type ReviewPayload } from "@/lib/repo";
import { get } from "@/lib/db";
import { today } from "@/lib/time";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => {
  const v = s(f, k);
  return v === "" || isNaN(Number(v)) ? null : Number(v);
};
const refresh = () => revalidatePath("/", "layout");
function back(f: FormData, fallback: string): never {
  const to = s(f, "back");
  redirect(to.startsWith("/") && !to.startsWith("//") ? to : fallback);
}

// ── Check-ins ──
export async function submitCheckinAction(f: FormData) {
  const me = await requirePerson();
  const mood = n(f, "mood");
  await m.submitCheckin(me.id, { moved: s(f, "moved"), stuck: s(f, "stuck"), next: s(f, "next"), mood }, "web");
  refresh();
  redirect("/checkins");
}

export async function updateCheckinItemAction(f: FormData) {
  const me = await requirePerson();
  const itemId = Number(s(f, "itemId"));
  const item = get<{ checkin_id: number }>("SELECT checkin_id FROM checkin_items WHERE id = ?", itemId);
  if (!item || getCheckin(item.checkin_id)?.person_id !== me.id) return;
  const data: Record<string, unknown> = {};
  for (const k of ["ownerId", "needBy", "visibility", "action", "tag", "link"]) if (f.has(k)) data[k] = s(f, k);
  m.updateCheckinItem(itemId, {
    state: (s(f, "state") || undefined) as "suggested" | "confirmed" | "removed" | undefined,
    text: f.has("text") ? s(f, "text") : undefined,
    goalId: f.has("goalId") ? n(f, "goalId") : undefined,
    data,
  });
  refresh();
}

export async function confirmCheckinAction(f: FormData) {
  const me = await requirePerson();
  const id = Number(s(f, "checkinId"));
  if (getCheckin(id)?.person_id !== me.id) return;
  m.confirmCheckin(id);
  refresh();
  redirect("/checkins?confirmed=1");
}

// ── Blockers ──
export async function blockerAction(f: FormData) {
  const me = await requirePerson();
  const id = Number(s(f, "blockerId"));
  const b = getBlocker(id);
  if (!b) return;
  const op = s(f, "op");
  if (op === "nudge" && b.raised_by === me.id) m.nudgeBlocker(id);
  if (op === "escalate" && b.raised_by === me.id) m.escalateBlocker(id, me.id);
  if (op === "resolve" && b.raised_by === me.id) for (const x of blockersInGroup(b)) m.resolveBlocker(x, me.id); // everyone tagged on it
  else if (op === "resolve" && (b.owner_id === me.id || b.escalated_to === me.id)) m.resolveBlocker(id, me.id);
  if (op === "delegate") delegateBlocker(id, me.id, s(f, "to"));
  if (op === "meeting") requestBlockerMeeting(id, me.id);
  if (["accept", "needs_info", "not_me"].includes(op) && b.owner_id === me.id)
    m.respondToBlocker(id, me.id, op as "accept" | "needs_info" | "not_me", s(f, "note") || undefined, s(f, "redirectTo") || undefined);
  if (op === "dismiss_escalation") get("SELECT 1"); // "Not yet" just closes the prompt
  refresh();
  if (s(f, "back")) back(f, "/blockers");
}

// ── Wins & kudos ──
export async function addWinAction(f: FormData) {
  const me = await requirePerson();
  if (!s(f, "title")) back(f, "/wins?add=1");
  m.addWin(me.id, { title: s(f, "title"), body: s(f, "body") || null, goalId: n(f, "goalId"), visibility: s(f, "visibility") || me.default_visibility, link: s(f, "link") || null, kind: s(f, "kind") === "unplanned" ? "unplanned" : "win", tag: s(f, "tag") || null });
  refresh();
  redirect("/wins?added=1");
}

export async function giveKudosAction(f: FormData) {
  const me = await requirePerson();
  try {
    m.giveKudos(me.id, s(f, "toId"), s(f, "message"), "web");
  } catch {
    back(f, "/wins?kudos=1&error=1");
  }
  refresh();
  back(f, "/wins?sent=1");
}

export async function winAction(f: FormData) {
  const me = await requirePerson();
  const id = Number(s(f, "winId"));
  if (s(f, "op") === "visibility") m.setWinVisibility(id, me.id, s(f, "visibility"));
  if (s(f, "op") === "reword") m.rewordWin(id, me.id, s(f, "title"));
  refresh();
}

export async function preferencesAction(f: FormData) {
  const me = await requirePerson();
  m.setPreferences(me.id, { recognition: s(f, "recognition") || undefined, visibility: s(f, "visibility") || undefined });
  refresh();
}

// ── Goals ──
export async function decideGoalAction(f: FormData) {
  const me = await requirePerson();
  const goalId = Number(s(f, "goalId"));
  const decision = s(f, "decision") as "approve" | "approve_edits" | "changes";
  m.decideGoal(goalId, me.id, decision, s(f, "message"));
  refresh();
  if (s(f, "back")) back(f, "/approvals");
  redirect(`/approvals?done=${decision}`);
}

export async function goalCommentAction(f: FormData) {
  const me = await requirePerson();
  m.addGoalComment(Number(s(f, "goalId")), me.id, s(f, "field") || null, s(f, "body"));
  refresh();
}

export async function editGoalAction(f: FormData) {
  const me = await requirePerson();
  const goalId = Number(s(f, "goalId"));
  const goal = getGoal(goalId);
  if (!goal || (goal.owner_id !== me.id && getPerson(goal.owner_id)?.manager_id !== me.id)) return;
  m.editGoal(goalId, me.id, {
    target: f.has("target") ? n(f, "target") : undefined,
    rubric: f.has("meets") ? { partial: s(f, "partial"), meets: s(f, "meets"), exceeds: s(f, "exceeds") } : undefined,
  }, s(f, "reason"));
  refresh();
}

export async function goalProgressAction(f: FormData) {
  const me = await requirePerson();
  const v = n(f, "value");
  if (v != null) m.updateGoalProgress(Number(s(f, "goalId")), me.id, v);
  refresh();
}

export async function toggleMilestoneAction(f: FormData) {
  const me = await requirePerson();
  m.toggleMilestone(Number(s(f, "milestoneId")), me.id);
  refresh();
}

export async function contributionAction(f: FormData) {
  const me = await requirePerson();
  m.setContribution(Number(s(f, "goalId")), me.id, s(f, "text"));
  refresh();
}

export async function addAiActionAction(f: FormData) {
  const me = await requirePerson();
  if (!me.manager_id) return;
  const one = get<{ id: number }>("SELECT id FROM one_on_ones WHERE employee_id = ? AND scheduled_at >= ? ORDER BY scheduled_at LIMIT 1", me.id, today());
  m.addActionItem({ employeeId: me.id, managerId: me.manager_id, oneOnOneId: one?.id ?? null, ownerId: me.id, text: s(f, "text"), due: null, goalId: n(f, "goalId") });
  refresh();
}

// ── 1:1s ──
async function oneOnOneFor(f: FormData) {
  const me = await requirePerson();
  const one = getOneOnOne(Number(s(f, "oneOnOneId")));
  if (!one || (one.employee_id !== me.id && one.manager_id !== me.id)) throw new Error("Not your 1:1");
  return { me, one };
}

export async function addTopicAction(f: FormData) {
  const { me, one } = await oneOnOneFor(f);
  if (s(f, "text")) m.addAgendaTopic(one.id, me.id, s(f, "text"));
  refresh();
}

export async function addActionItemAction(f: FormData) {
  const { one } = await oneOnOneFor(f);
  if (!s(f, "text")) return;
  m.addActionItem({ employeeId: one.employee_id, managerId: one.manager_id, oneOnOneId: one.id, ownerId: s(f, "ownerId") || one.employee_id, text: s(f, "text"), due: s(f, "due") || null, goalId: n(f, "goalId") });
  refresh();
}

export async function toggleActionAction(f: FormData) {
  await requirePerson();
  m.toggleAction(Number(s(f, "actionId")));
  refresh();
}

export async function saveNotesAction(f: FormData) {
  const { one } = await oneOnOneFor(f);
  m.saveNotes(one.id, s(f, "notes"));
  if (s(f, "op") === "extract") {
    const employee = getPerson(one.employee_id)!, manager = getPerson(one.manager_id)!;
    for (const a of m.findActionsInNotes(s(f, "notes"), employee, manager)) {
      m.addActionItem({ employeeId: one.employee_id, managerId: one.manager_id, oneOnOneId: one.id, ownerId: a.ownerId, text: a.text, due: null, goalId: null });
    }
  }
  refresh();
}

// ── Feedback ──
export async function requestFeedbackAction(f: FormData) {
  const me = await requirePerson();
  const reviewers = f.getAll("reviewerId").map(String).filter((id) => getPerson(id));
  for (const r of reviewers) m.requestFeedback(me.id, r, s(f, "about"), n(f, "goalId"), s(f, "due") || null, s(f, "kind") || "quick");
  refresh();
  redirect("/feedback?tab=requested&sent=1");
}

export async function giveFeedbackAction(f: FormData) {
  const me = await requirePerson();
  const toId = s(f, "toId");
  if (!getPerson(toId)) return;
  m.giveFeedback(me.id, toId, { about: s(f, "about"), goalId: n(f, "goalId"), keep: s(f, "keep"), improve: s(f, "improve"), nextAction: s(f, "nextAction"), requestId: n(f, "requestId") });
  refresh();
  back(f, "/feedback?tab=given&sent=1");
}

// ── Reviews ──
export async function draftSelfReviewAction() {
  const me = await requirePerson();
  await m.draftSelfReview(me.id);
  refresh();
  redirect("/reviews/self?drafted=1");
}

function payloadFrom(f: FormData): ReviewPayload {
  const goals: NonNullable<ReviewPayload["goals"]> = {};
  for (const id of f.getAll("goalIds").map(String)) {
    goals[id] = {
      rating: n(f, `rating_${id}`) ?? undefined,
      text: f.has(`text_${id}`) ? s(f, `text_${id}`) : undefined,
      comment: f.has(`comment_${id}`) ? s(f, `comment_${id}`) : undefined,
      reviewed: f.get(`reviewed_${id}`) === "on",
    };
  }
  return { goals, beyond: s(f, "beyond"), beyondReviewed: f.get("beyondReviewed") === "on", overall: s(f, "overall") };
}

export async function saveSelfReviewAction(f: FormData) {
  const me = await requirePerson();
  m.saveReview(me.id, me.id, "self", payloadFrom(f));
  if (s(f, "op") === "submit") {
    m.submitReview(me.id, me.id, "self");
    refresh();
    redirect("/reviews/self?submitted=1");
  }
  refresh();
  redirect(`/reviews/self?saved=1${s(f, "cite") ? `&cite=${encodeURIComponent(s(f, "cite"))}` : ""}`);
}

export async function saveManagerReviewAction(f: FormData) {
  const me = await requirePerson();
  const personId = s(f, "personId");
  if (getPerson(personId)?.manager_id !== me.id) return;
  m.saveReview(personId, me.id, "manager", payloadFrom(f));
  if (s(f, "op") === "submit") {
    m.submitReview(personId, me.id, "manager");
    refresh();
    redirect(`/reviews?submitted=${personId}`);
  }
  refresh();
  redirect(`/reviews/manager/${personId}?saved=1&goal=${s(f, "goal")}&tab=${s(f, "tab")}`);
}

// ── HR ──
export async function sendRemindersAction(f: FormData) {
  await requirePerson();
  const sent = m.sendReviewReminders(s(f, "teamId") || undefined);
  refresh();
  redirect(`/hr?reminded=${sent}`);
}

export async function createCompanyGoalAction(f: FormData) {
  const me = await requirePerson();
  if (me.role !== "hr") return;
  if (s(f, "parentId")) m.createTeamGoal(s(f, "ownerId") || me.id, Number(s(f, "parentId")), s(f, "title"), s(f, "dueDate") || "2026-12-31");
  else m.createCompanyGoal("neha", s(f, "title"), s(f, "dueDate") || "2027-03-31");
  refresh();
  redirect("/hr/goals?created=1");
}

export async function cycleAction(f: FormData) {
  const me = await requirePerson();
  if (me.role !== "hr") return;
  const cycle = activeCycle()!;
  for (const level of [1, 2, 3, 4, 5]) {
    if (f.has(`label_${level}`)) m.updateRatingLevel(cycle.id, level, s(f, `label_${level}`), s(f, `desc_${level}`));
  }
  // Only the toggles shown on the submitted step are updated; unchecked boxes aren't sent at all.
  const shown = new Set(s(f, "flags").split(",").filter(Boolean));
  const flag = (k: string) => (shown.has(k) ? f.get(k) === "on" : undefined);
  m.setCycleFlags(cycle.id, {
    show_rubric: flag("show_rubric"), require_comment: flag("require_comment"),
    forced_distribution: flag("forced_distribution"), peer_enabled: flag("peer_enabled"),
  });
  refresh();
  redirect(`/hr/cycles?step=${s(f, "nextStep") || "4"}&saved=1`);
}

export async function chatSettingsAction(f: FormData) {
  const me = await requirePerson();
  if (me.role !== "hr") return;
  for (const k of ["checkin", "blockers", "kudos", "feedback", "reminders", "approvals", "reviews"]) m.setSetting(`chat.feature.${k}`, f.get(k) === "on" ? "1" : "0");
  if (s(f, "schedule")) m.setSetting("chat.checkin_schedule", s(f, "schedule"));
  if (["slack", "google_chat", "email"].includes(s(f, "channel"))) m.setSetting("notify.channel", s(f, "channel"));
  refresh();
  redirect("/hr/integrations?saved=1");
}

export async function sendCheckinPromptsAction() {
  const me = await requirePerson();
  if (me.role !== "hr") return;
  m.sendCheckinPrompts();
  refresh();
  redirect("/hr/integrations?prompted=1");
}
