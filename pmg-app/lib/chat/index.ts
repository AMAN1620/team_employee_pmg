// Everything PMG says in chat goes through here. The built-in simulator stores messages in `chat_messages`
// (shown on /chat); when Slack is configured the same messages are also posted to Slack (lib/chat/slack.ts).
import { get, run } from "@/lib/db";
import { now } from "@/lib/time";

export type ChatKind =
  | "checkin_prompt" | "checkin_sorted" | "blocker_request" | "blocker_update" | "blocker_nudge" | "escalation"
  | "kudos_notice" | "approval_request" | "approval_result" | "plan_change" | "feedback_request" | "feedback_notice" | "reminder" | "text";

type Listener = (msg: { id: number; toId: string; kind: ChatKind; body: string; data: Record<string, unknown> }) => void;
const g = globalThis as unknown as { __pmgChatListeners?: Listener[] };
g.__pmgChatListeners ??= [];

/** Lets the Slack bridge mirror messages; the simulator needs nothing extra. */
export function onChatMessage(fn: Listener) {
  g.__pmgChatListeners!.push(fn);
}

export function chatEnabled(feature: "checkin" | "blockers" | "kudos" | "feedback" | "reminders" | "approvals" | "reviews"): boolean {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = ?", `chat.feature.${feature}`)?.value !== "0";
}

const FEATURE_OF: Partial<Record<ChatKind, Parameters<typeof chatEnabled>[0]>> = {
  checkin_prompt: "checkin", blocker_request: "blockers", blocker_update: "blockers", blocker_nudge: "blockers", escalation: "blockers",
  kudos_notice: "kudos", feedback_request: "feedback", feedback_notice: "feedback", reminder: "reminders",
  approval_request: "approvals", approval_result: "approvals", plan_change: "approvals",
};

/** Posts a PMG bot message. Returns 0 when HR has switched that kind of message off on the Integrations page. */
export function sendChat(toId: string, kind: ChatKind, body: string, data: Record<string, unknown> = {}, fromId = "pmg"): number {
  const feature = FEATURE_OF[kind];
  if (fromId === "pmg" && feature && !chatEnabled(feature)) return 0;
  const id = run("INSERT INTO chat_messages (to_id,from_id,kind,body,data,at) VALUES (?,?,?,?,?,?)", toId, fromId, kind, body, JSON.stringify(data), now());
  for (const fn of g.__pmgChatListeners!) {
    try { fn({ id, toId, kind, body, data }); } catch (e) { console.warn("[pmg] chat listener failed:", (e as Error).message); }
  }
  return id;
}

export function markHandled(messageId: number, how: string) {
  run("UPDATE chat_messages SET handled = ? WHERE id = ?", how, messageId);
}

export function markHandledWhere(toId: string, kind: ChatKind, dataKey: string, dataValue: number | string, how: string) {
  run(`UPDATE chat_messages SET handled = ? WHERE to_id = ? AND kind = ? AND handled IS NULL AND json_extract(data, '$.${dataKey}') = ?`, how, toId, kind, dataValue);
}
