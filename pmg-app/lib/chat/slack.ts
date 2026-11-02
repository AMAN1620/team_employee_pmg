// Slack bridge. Runs as its own process (`npm run slack`) next to the web app and shares the SQLite file.
// Outgoing: PMG bot messages written by the web app are polled from `chat_messages` and posted as Slack DMs.
// Incoming: button presses, the check-in modal and typed DMs go through the same handlers as the built-in chat.
import { App, type BlockAction, type ButtonAction } from "@slack/bolt";
import { all, get } from "@/lib/db";
import { getBlocker, getPerson, listPeople, type ChatMessage, type Person } from "@/lib/repo";
import { handleButton, handleCheckinReply, handleTypedMessage } from "./commands";

type Block = Record<string, unknown>;

/** PMG_SLACK_USERS="ananya:U012AB3CD,vikram:U045EF6GH" maps demo personas to real Slack users; otherwise match by email. */
function personaMap(): Map<string, string> {
  return new Map((process.env.PMG_SLACK_USERS ?? "").split(",").map((p) => p.trim().split(":")).filter((p) => p.length === 2) as [string, string][]);
}

const section = (text: string): Block => ({ type: "section", text: { type: "mrkdwn", text } });
const button = (text: string, actionId: string, value: string, style?: "primary" | "danger"): Block => ({
  type: "button", text: { type: "plain_text", text }, action_id: actionId, value, ...(style ? { style } : {}),
});

/** Block Kit for one PMG message, with the same buttons as the built-in chat. */
export function blocksFor(m: ChatMessage): Block[] {
  const data = JSON.parse(m.data) as Record<string, unknown>;
  const id = String(m.id);
  switch (m.kind) {
    case "checkin_prompt":
      return [section(m.body), { type: "actions", elements: [button("Answer check-in", "pmg_checkin_open", id, "primary")] }];
    case "checkin_sorted":
      return [section(`*${m.body}*\n${((data.lines as string[]) ?? []).map((l) => `• ${l}`).join("\n")}`),
        { type: "actions", elements: [button("Looks right", "pmg_confirm", id, "primary")] }];
    case "blocker_request": {
      const b = data.blockerId ? getBlocker(Number(data.blockerId)) : undefined;
      return [section(`*${m.body}*${b?.need_by ? `\nNeed by ${b.need_by}` : ""}${data.goal ? ` · Goal: ${data.goal}` : ""}`),
        { type: "actions", elements: [button("Accept", "pmg_accept", id, "primary"), button("Need info", "pmg_needs_info", id), button("Not me", "pmg_not_me", id, "danger")] }];
    }
    case "approval_request":
      return [section(`*${m.body}*`), { type: "actions", elements: [button("Approve", "pmg_approve", id, "primary"), button("Request changes", "pmg_changes", id)] }];
    case "plan_change":
      return [section(`*${m.body}*`), { type: "actions", elements: [button("Approve", "pmg_approve", id, "primary")] }];
    case "kudos_notice":
      return [section(`:purple_heart: ${m.body}`)];
    default:
      return [section(m.body)];
  }
}

export function startSlack() {
  const app = new App({ token: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN, socketMode: true });
  const map = personaMap();
  const slackIdCache = new Map<string, string>();

  async function slackUserFor(p: Person): Promise<string | null> {
    if (map.has(p.id)) return map.get(p.id)!;
    if (slackIdCache.has(p.id)) return slackIdCache.get(p.id)!;
    try {
      const res = await app.client.users.lookupByEmail({ email: p.email });
      if (res.user?.id) { slackIdCache.set(p.id, res.user.id); return res.user.id; }
    } catch { /* not in this workspace */ }
    return null;
  }

  async function personFor(slackUserId: string): Promise<Person | undefined> {
    for (const [persona, uid] of map) if (uid === slackUserId) return getPerson(persona);
    const info = await app.client.users.info({ user: slackUserId });
    const email = info.user?.profile?.email?.toLowerCase();
    return listPeople().find((p) => p.email === email);
  }

  // Outgoing: post new PMG messages. Start from the latest id so old history isn't replayed.
  let lastId = get<{ id: number }>("SELECT COALESCE(MAX(id), 0) AS id FROM chat_messages")?.id ?? 0;
  setInterval(async () => {
    const fresh = all<ChatMessage>("SELECT * FROM chat_messages WHERE id > ? AND from_id = 'pmg' ORDER BY id", lastId);
    for (const m of fresh) {
      lastId = m.id;
      const p = getPerson(m.to_id);
      const user = p && (await slackUserFor(p));
      if (!user) continue;
      try {
        const dm = await app.client.conversations.open({ users: user });
        await app.client.chat.postMessage({ channel: dm.channel!.id!, text: m.body, blocks: blocksFor(m) as never });
      } catch (e) {
        console.warn(`[pmg-slack] couldn't post message ${m.id}:`, (e as Error).message);
      }
    }
  }, 2000);

  // Incoming button presses.
  app.action<BlockAction<ButtonAction>>(/^pmg_(accept|needs_info|not_me|approve|changes|confirm)$/, async ({ ack, body, action, client }) => {
    await ack();
    const me = await personFor(body.user.id);
    const msg = get<ChatMessage>("SELECT * FROM chat_messages WHERE id = ?", Number(action.value));
    if (!me || !msg) return;
    const op = action.action_id.replace(/^pmg_/, "");
    try {
      handleButton(me, msg, op);
      if (body.channel?.id && body.message?.ts) {
        await client.chat.update({ channel: body.channel.id, ts: body.message.ts, text: msg.body, blocks: [section(`${msg.body}\n:white_check_mark: _${op.replace("_", " ")}_`)] as never });
      }
    } catch (e) {
      console.warn("[pmg-slack] action failed:", (e as Error).message);
    }
  });

  // Check-in: open a modal with the three questions.
  app.action<BlockAction<ButtonAction>>("pmg_checkin_open", async ({ ack, body, client }) => {
    await ack();
    const input = (id: string, label: string, optional = false): Block => ({
      type: "input", block_id: id, optional, label: { type: "plain_text", text: label },
      element: { type: "plain_text_input", action_id: "v", multiline: true },
    });
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal", callback_id: "pmg_checkin", title: { type: "plain_text", text: "Weekly check-in" }, submit: { type: "plain_text", text: "Send" },
        blocks: [input("moved", "What moved?"), input("stuck", "What's stuck?", true), input("next", "What's next?", true)] as never,
      },
    });
  });

  app.view("pmg_checkin", async ({ ack, body, view }) => {
    await ack();
    const me = await personFor(body.user.id);
    if (!me) return;
    const v = (k: string) => view.state.values[k]?.v?.value ?? "";
    await handleCheckinReply(me, { moved: v("moved"), stuck: v("stuck"), next: v("next"), mood: null });
  });

  // Typed DMs: /kudos and /blocker style commands.
  app.message(async ({ message }) => {
    if (message.subtype || !("user" in message) || !message.user || !("text" in message) || !message.text) return;
    const me = await personFor(message.user);
    if (me) handleTypedMessage(me, message.text);
  });

  return app.start().then(() => console.log("[pmg-slack] Connected to Slack in Socket Mode. Mirroring PMG chat messages."));
}
