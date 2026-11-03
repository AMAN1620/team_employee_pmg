"use server";
// Actions for the quarter goals board and its agent: AI milestone suggestions and replies, to-do reminders, and the
// things the agent does for you (raise a blocker, ask for a 1:1, send the weekly update) through PMG chat.
import { revalidatePath } from "next/cache";
import { requirePerson } from "@/lib/session";
import { getPerson } from "@/lib/repo";
import { agentReply, suggestMilestones } from "@/lib/ai";
import { sendChat } from "@/lib/chat";
import { raiseBlocker } from "@/lib/services/mutations";

const first = (name: string) => name.split(" ")[0];

export async function suggestMilestonesAction(goal: { title: string; why: string; start: string; end: string; existing: string[] }) {
  await requirePerson();
  return suggestMilestones(goal);
}

export async function agentReplyAction(r: { context: string; transcript: string; question: string }) {
  const me = await requirePerson();
  return agentReply(first(me.name), r.context.slice(0, 12000), r.transcript.slice(-4000), r.question.slice(0, 2000));
}

/** Sends a to-do reminder now, to the person themselves or a colleague, as a PMG chat message (mirrored to Slack when set up). */
export async function sendReminderAction(r: { toId: string; todo: string; task: string; goal: string }) {
  const me = await requirePerson();
  const to = getPerson(r.toId);
  if (!to) return { ok: false as const };
  const body = to.id === me.id
    ? `Reminder: ${r.todo} (for "${r.task}", ${r.goal})`
    : `${first(me.name)} asked me to remind you: ${r.todo} (for "${r.task}", ${r.goal})`;
  const id = sendChat(to.id, "reminder", body, { from: me.id, todo: r.todo });
  revalidatePath("/chat");
  return { ok: id > 0 };
}

/** A blocker the agent drafted: saved like any other, so the owner gets the request card in chat and it shows on Blockers. */
export async function raiseBlockerAction(r: { ownerId: string; title: string; needBy: string; tasks: string[]; goal: string }) {
  const me = await requirePerson();
  if (!getPerson(r.ownerId) || !r.title.trim()) return { ok: false as const };
  raiseBlocker(me.id, {
    title: r.title.trim(), ownerId: r.ownerId, goalId: null, needBy: r.needBy || null, origin: "agent",
    details: `Holding up ${r.tasks.map((t) => `"${t}"`).join(", ")} (${r.goal}).`,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function requestMeetingAction(r: { withId: string; when: string; agenda: string }) {
  const me = await requirePerson();
  const to = getPerson(r.withId);
  if (!to) return { ok: false as const };
  sendChat(to.id, "text", `${me.name} asked for a 15-minute 1:1 on ${r.when}. Agenda: ${r.agenda}`, { from: me.id, when: r.when });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function sendUpdateAction(r: { text: string }) {
  const me = await requirePerson();
  if (!me.manager_id) return { ok: false as const };
  sendChat(me.manager_id, "text", `Weekly update from ${me.name}:\n${r.text}`, { from: me.id });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
