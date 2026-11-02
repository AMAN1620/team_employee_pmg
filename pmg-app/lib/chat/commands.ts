// Chat-side handling shared by the built-in simulator and the Slack bridge.
import { run } from "@/lib/db";
import { checkinItems, getBlocker, getCheckin, getGoal, getPerson, listPeople, type Person } from "@/lib/repo";
import { confirmCheckin, decideGoal, giveKudos, raiseBlocker, resolveBlocker, respondToBlocker, submitCheckin } from "@/lib/services/mutations";
import { addDays, now, today } from "@/lib/time";
import { approveAddition } from "@/lib/services/work";
import { markHandled, sendChat } from "./index";

/** Finds a person from "@anshika", "@Anshika Goswami" or "anshika". */
export function resolveMention(token: string, people: Person[] = listPeople()): Person | undefined {
  const t = token.replace(/^@/, "").trim().toLowerCase();
  return people.find((p) => p.id === t || p.name.toLowerCase() === t || p.name.split(" ")[0].toLowerCase() === t);
}

export type ParsedCommand =
  | { type: "kudos"; to: string; message: string }
  | { type: "blocker"; owner: string; title: string }
  | { type: "help" }
  | { type: "text"; text: string };

/** `/kudos @name for …` and `/blocker @name what's stuck`. Anything else is plain text. */
export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();
  const kudos = trimmed.match(/^\/kudos\s+@?(\S+)\s+(.+)$/i);
  if (kudos) {
    const message = kudos[2].replace(/^for\s+/i, "");
    return { type: "kudos", to: kudos[1], message: message[0].toUpperCase() + message.slice(1) };
  }
  const blocker = trimmed.match(/^\/blocker\s+@?(\S+)\s+(.+)$/i);
  if (blocker) return { type: "blocker", owner: blocker[1], title: blocker[2][0].toUpperCase() + blocker[2].slice(1) };
  if (/^\/(help|pmg)\b/i.test(trimmed)) return { type: "help" };
  return { type: "text", text: trimmed };
}

/** Handles something a person typed in their DM with the PMG bot. */
export function handleTypedMessage(me: Person, text: string) {
  if (!text.trim()) return;
  run("INSERT INTO chat_messages (to_id,from_id,kind,body,data,at,handled) VALUES (?,?,?,?,?,?,?)", me.id, me.id, "text", text.trim(), "{}", now(), "sent");
  const cmd = parseCommand(text);
  if (cmd.type === "kudos") {
    const to = resolveMention(cmd.to);
    if (!to || to.id === me.id) return sendChat(me.id, "text", `I couldn't find “${cmd.to}”. Try /kudos @firstname for …`);
    giveKudos(me.id, to.id, cmd.message, "chat");
    return sendChat(me.id, "text", `Kudos sent to ${to.name}. It's in their wins journal.`, { tone: "violet" });
  }
  if (cmd.type === "blocker") {
    const owner = resolveMention(cmd.owner);
    if (!owner || owner.id === me.id) return sendChat(me.id, "text", `I couldn't find “${cmd.owner}”. Try /blocker @firstname what's stuck`);
    raiseBlocker(me.id, { title: cmd.title, ownerId: owner.id, goalId: null, needBy: addDays(today(), 5), details: null });
    return sendChat(me.id, "text", `Sent to ${owner.name} with Accept / Need info / Not me buttons. I'll tell you when they respond.`);
  }
  return sendChat(me.id, "text", "I can help with: your weekly check-in (answer the check-in card), /kudos @name for …, and /blocker @name what's stuck.");
}

/** Check-in answered in chat: sort it, then reply with what was found and a "Looks right" button. */
export async function handleCheckinReply(me: Person, reply: { moved: string; stuck: string; next: string; mood: number | null }) {
  const id = await submitCheckin(me.id, reply, "chat");
  const items = checkinItems(id);
  const lines = items.map((i) => {
    const label = { progress: "Progress", win: "Win", blocker: "Blocker", existing_blocker: "Still blocked", unplanned: "Unplanned", next: "Next" }[i.kind];
    const data = JSON.parse(i.data) as { ownerId?: string };
    const extra = i.kind === "blocker" && data.ownerId ? `, waiting on ${getPerson(data.ownerId)?.name}` : i.goal_id ? ` → ${getGoal(i.goal_id)?.title}` : "";
    return `${label}: ${i.text}${extra}`;
  });
  sendChat(me.id, "checkin_sorted", "Here's what I found", { checkinId: id, lines });
  return id;
}

/** A button press on a PMG message. Only the message's recipient can press its buttons. */
export function handleButton(me: Person, message: { id: number; to_id: string; kind: string; data: string }, op: string, note?: string) {
  if (message.to_id !== me.id) throw new Error("Not your message");
  const data = JSON.parse(message.data) as { blockerId?: number; goalId?: number; checkinId?: number; milestoneId?: number };
  if (message.kind === "blocker_request" && data.blockerId) {
    if (op === "resolve") resolveBlocker(data.blockerId, me.id);
    else respondToBlocker(data.blockerId, me.id, op as "accept" | "needs_info" | "not_me", note);
    markHandled(message.id, op);
    if (op === "accept") sendChat(me.id, "text", `Thanks. ${getPerson(getBlocker(data.blockerId)?.raised_by ?? "")?.name.split(" ")[0]} can see you're on it. Clearing this counts toward your helped-others record.`);
  } else if (message.kind === "approval_request" && data.goalId) {
    decideGoal(data.goalId, me.id, op === "approve" ? "approve" : "changes", note ?? "");
    markHandled(message.id, op);
  } else if (message.kind === "plan_change" && data.milestoneId && op === "approve") {
    approveAddition(data.milestoneId, me.id);
    markHandled(message.id, op);
  } else if (message.kind === "checkin_sorted" && data.checkinId) {
    const c = getCheckin(data.checkinId);
    if (c?.person_id === me.id && c.status === "pending") confirmCheckin(c.id);
    markHandled(message.id, "confirmed");
    sendChat(me.id, "text", "Confirmed. Your goals, wins and blockers are updated.");
  } else {
    markHandled(message.id, op);
  }
}
