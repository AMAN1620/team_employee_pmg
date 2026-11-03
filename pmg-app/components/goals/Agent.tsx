"use client";
// The goal agent, docked on the right of the goals page. It opens with what needs attention and asks about it ("is
// something blocking it?"), then walks through the next step with a card: raise a blocker on one or more tasks, set
// up a 1:1, mark a task done, draft the weekly update, or plan a goal's milestones. Cards change the goals in the
// middle (and ticks or adds to-dos on the to-do list); blockers, 1:1 requests and updates also go out through PMG
// chat. Anything else it can't route goes to Claude with the person's goals and to-dos as context.
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar, Icon, cx, fmtDate } from "@/components/ui";
import { addDays, daysBetween } from "@/lib/time";
import { milestoneStatus, newId, quarterOf, taskProgress, tasksDone, type Goal, type Milestone, type Task, type Todo } from "@/lib/demo/quarter-goals";
import type { SuggestedMilestone } from "@/lib/ai/types";
import { agentReplyAction, raiseBlockerAction, requestMeetingAction, sendUpdateAction, suggestMilestonesAction } from "@/app/actions/quarter-goals";
import { fmtWhen, pct, range, type PersonOpt } from "./bits";
import type { Mutate } from "./GoalList";

type Subject = { goalId: string; milestoneId?: string; taskId?: string };
type Card =
  | { kind: "blocker"; goalId: string; milestoneId: string; taskIds: string[]; title: string; ownerId: string; needBy: string; state: "draft" | "sent" | "dropped" }
  | { kind: "meeting"; withId: string; slots: string[]; picked: string; agenda: string; state: "draft" | "sent" }
  | { kind: "update"; text: string; state: "draft" | "sent" }
  | { kind: "done"; goalId?: string; milestoneId?: string; taskId?: string; todoId?: string; state: "draft" | "done" | "dropped" }
  | { kind: "suggest"; goalId: string; items: SuggestedMilestone[]; state: "draft" | "added" }
  | { kind: "todo"; text: string; goalId: string; milestoneId: string; remindAt: string; state: "draft" | "added" | "dropped" };
type Stage = "what" | "who" | "who_1on1" | "done_which" | "plan" | "todo_text";
export type Msg = { id: string; from: "agent" | "me"; at: string; text: string; chips?: string[]; card?: Card; applied?: string; subject?: Subject; stage?: Stage };

const QUICK = ["Add a to-do", "What's due this week?", "Draft my weekly update", "Plan milestones for a goal", "Set up a 1:1"];
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Pulls "tomorrow at 4pm", "on friday", "next week" off the end of a to-do and turns it into a reminder time. */
function parseWhen(text: string, today: string): { text: string; at?: string } {
  const m = text.match(/\s+(?:(today|tomorrow|next week|(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)))?(?:\s*at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\s*$/i);
  if (!m || (!m[1] && !m[2])) return { text };
  let day = today;
  const w = m[1]?.toLowerCase().replace(/^on\s+/, "");
  if (w === "tomorrow") day = addDays(today, 1);
  else if (w === "next week") { day = addDays(today, 1); while (new Date(`${day}T00:00:00Z`).getUTCDay() !== 1) day = addDays(day, 1); }
  else if (w && w !== "today") { day = addDays(today, 1); while (DAYS[new Date(`${day}T00:00:00Z`).getUTCDay()] !== w) day = addDays(day, 1); }
  let h = m[2] ? Number(m[2]) : 10;
  if (m[4]?.toLowerCase() === "pm" && h < 12) h += 12;
  if (m[4]?.toLowerCase() === "am" && h === 12) h = 0;
  return { text: text.slice(0, m.index).trim(), at: `${day}T${String(Math.min(h, 23)).padStart(2, "0")}:${m[3] ?? "00"}` };
}
const clock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const firstName = (n: string) => n.split(" ")[0];
const isWorkday = (d: string) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return w > 0 && w < 6; };
const nextWorkday = (d: string) => { let x = addDays(d, 1); while (!isWorkday(x)) x = addDays(x, 1); return x; };

/** The demo conversation the agent opens with. Aman's is scripted around his real cross-chat memory work. */
export function seedThread(personId: string, name: string, goals: Goal[], today: string): Msg[] {
  if (personId === "aman") {
    return [
      { id: "s1", from: "agent", at: "09:30", text: "Morning Aman. Two tasks need you today, both for **Memory recall gated and fast on staging** (ends 20 Nov):\n• PoC to find relevant context: 50%\n• Measure vector query latency: 25%\nYou also have 4 open to-dos for this milestone." },
      { id: "s2", from: "me", at: "09:41", text: "finished scoring the summaries by relevance" },
      { id: "s3", from: "agent", at: "09:41", text: "Ticked “Score summaries by relevance” on your to-do list. Next on it for this milestone: pick the top 3 summaries under the token budget.", applied: "Updated your to-dos" },
      { id: "s4", from: "agent", at: "15:12", text: "**Measure vector query latency** hasn't moved in 4 days, and the gating work can't start without its numbers. Is something blocking it?",
        chips: ["Yes, I'm blocked", "No, just busy", "Move it to next week"], subject: { goalId: "a1", milestoneId: "a1m2", taskId: "a1t4" } },
    ];
  }
  const live = goals.flatMap((g) => g.milestones.filter((m) => milestoneStatus(m, today) === "in_progress").map((m) => ({ g, m })))[0];
  return [{
    id: "s1", from: "agent", at: "09:30",
    text: live ? `Hi ${firstName(name)}. **${live.m.title}** is ${tasksDone(live.m)} of ${live.m.tasks.length} tasks done and ends ${fmtDate(live.m.end)}. What would you like to work on?` : `Hi ${firstName(name)}. I can help you plan goals, track progress, raise blockers and set up 1:1s.`,
    chips: ["What's due this week?", "Set up a 1:1"], subject: live ? { goalId: live.g.id, milestoneId: live.m.id } : undefined,
  }];
}

export function AgentPanel({ goals, todos, setTodos, thread, setThread, mutate, today, me, manager, people, focus, prompt, onPromptTaken, onClose, onReset }: {
  goals: Goal[]; todos: Todo[]; setTodos: (fn: (t: Todo[]) => Todo[]) => void; thread: Msg[]; setThread: (fn: (t: Msg[]) => Msg[]) => void; mutate: Mutate; today: string;
  me: { id: string; name: string }; manager: PersonOpt | null; people: PersonOpt[]; focus?: Subject; prompt: { text: string } | null;
  onPromptTaken: () => void; onClose: () => void; onReset: () => void;
}) {
  const [text, setText] = useState("");
  const [thinking, startThinking] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [thread.length, thinking]);

  const goal = (id?: string) => goals.find((g) => g.id === id);
  const milestone = (s?: Subject) => goal(s?.goalId)?.milestones.find((m) => m.id === s?.milestoneId);
  const person = (id: string) => people.find((p) => p.id === id);
  const helper = me.id === "aman" ? person("kanav") : undefined;
  const subject = (): Subject | undefined => [...thread].reverse().find((m) => m.subject)?.subject ?? focus;
  const lastStage = [...thread].reverse().find((m) => m.from === "agent")?.stage;
  const say = (m: Omit<Msg, "id" | "from" | "at">) => setThread((t) => [...t, { id: newId("a"), from: "agent", at: clock(), ...m }]);
  const patchCard = (id: string, patch: Partial<Card>) => setThread((t) => t.map((m) => (m.id === id && m.card ? { ...m, card: { ...m.card, ...patch } as Card } : m)));

  const findPerson = (q: string) => {
    const l = q.toLowerCase();
    return people.find((p) => l.includes(p.name.toLowerCase())) ?? people.find((p) => new RegExp(`\\b${firstName(p.name).toLowerCase()}\\b`).test(l));
  };
  const quarterMilestones = () => goals.flatMap((g) => g.milestones.map((m) => ({ g, m })));
  /** The open task or open to-do that shares the most words with what was said (needs at least two). */
  const findTask = (q: string): { g?: Goal; m?: Milestone; t?: Task; todo?: Todo } | undefined => {
    const stems = (x: string) => x.toLowerCase().split(/\W+/).filter((w) => w.length > 3).map((w) => w.replace(/(ing|ed|es|s)$/, ""));
    const words = new Set(stems(q));
    const overlap = (x: string) => stems(x).filter((w) => words.has(w)).length;
    let best: { g?: Goal; m?: Milestone; t?: Task; todo?: Todo; score: number } | undefined;
    for (const { g, m } of quarterMilestones()) for (const t of m.tasks) {
      const score = overlap(t.title);
      if (taskProgress(t) < 1 && score > (best?.score ?? 1.5)) best = { g, m, t, score };
    }
    for (const d of todos.filter((x) => !x.done && goals.some((g) => g.quarter === x.quarter))) {
      const score = overlap(d.text) + 0.5;
      if (score > (best?.score ?? 1.5)) { const g = goal(d.goalId); best = { g, m: g?.milestones.find((x) => x.id === d.milestoneId), todo: d, score }; }
    }
    return best;
  };
  const byTitle = (q: string) => {
    const quoted = q.match(/“(.+?)”|"(.+?)"/)?.slice(1).find(Boolean)?.toLowerCase();
    if (!quoted) return undefined;
    const g = goals.find((x) => x.title.toLowerCase() === quoted);
    if (g) return { g };
    const hit = quarterMilestones().find(({ m }) => m.title.toLowerCase() === quoted);
    return hit;
  };

  // --- what the agent can do ---
  const askWhat = (s?: Subject) => say({ text: "What's in the way?", chips: ["Waiting on someone", "Requirements aren't clear", "A technical problem"], stage: "what", subject: s });
  const askWho = (s?: Subject, why = "Who can unblock it?") => say({ text: why, chips: [...(helper ? [helper.name] : []), ...(manager ? [manager.name] : []), "Someone else"], stage: "who", subject: s });
  const blockerCard = (ownerId: string, typed?: string) => {
    const s = subject();
    const m = milestone(s) ?? quarterMilestones().find(({ m }) => milestoneStatus(m, today) === "in_progress")?.m;
    const g = goals.find((x) => x.milestones.some((y) => y.id === m?.id));
    if (!m || !g) return say({ text: "Which goal is it holding up? Open it in the middle and press “Raise blocker” on the milestone." });
    const task = m.tasks.find((t) => t.id === s?.taskId) ?? m.tasks.find((t) => taskProgress(t) < 1);
    const owner = person(ownerId)!;
    const title = typed && typed.length > 20 && !/^i'm blocked on “/i.test(typed) ? typed[0].toUpperCase() + typed.slice(1)
      : me.id === "aman" && ownerId === "kanav" && task?.id === "a1t4" ? "Need read access to the staging DB to load-test vector queries"
      : `Waiting on ${firstName(owner.name)} for “${task?.title ?? m.title}”`;
    say({ text: `Here's the blocker for ${firstName(owner.name)}. Tick every task it holds up in **${m.title}**.`, subject: { goalId: g.id, milestoneId: m.id, taskId: task?.id },
      card: { kind: "blocker", goalId: g.id, milestoneId: m.id, taskIds: task ? [task.id] : [], title, ownerId, needBy: nextWorkday(nextWorkday(today)), state: "draft" } });
  };
  const meetingCard = (withId: string) => {
    const p = person(withId)!;
    const s = subject(); const m = milestone(s);
    const blockerTitle = [...thread].reverse().find((x) => x.card?.kind === "blocker" && x.card.state === "sent")?.card as Extract<Card, { kind: "blocker" }> | undefined;
    const d1 = nextWorkday(today), d2 = nextWorkday(d1);
    say({ text: `Here are three free 15-minute slots for you and ${firstName(p.name)}.`,
      card: { kind: "meeting", withId, slots: [`${d1}T11:00`, `${d1}T15:30`, `${d2}T10:00`], picked: `${d1}T11:00`,
        agenda: blockerTitle && blockerTitle.ownerId === withId ? blockerTitle.title : m ? `Talk through “${m.title}”` : "Goals check-in", state: "draft" } });
  };
  const doneCard = (hit: { g?: Goal; m?: Milestone; t?: Task; todo?: Todo }) => {
    const { g, m, t, todo } = hit;
    if (todo) return say({ text: `Tick **${todo.text}** on your to-do list?${m ? ` It's tagged to **${m.title}**.` : g ? ` It's tagged to **${g.title}**.` : ""}`,
      subject: g ? { goalId: g.id, milestoneId: m?.id } : undefined, card: { kind: "done", goalId: g?.id, milestoneId: m?.id, todoId: todo.id, state: "draft" } });
    if (!g || !m || !t) return;
    say({ text: `Mark **${t.title}** done? It's in **${m.title}**, which is ${tasksDone(m)} of ${m.tasks.length} tasks done.`,
      subject: { goalId: g.id, milestoneId: m.id, taskId: t.id }, card: { kind: "done", goalId: g.id, milestoneId: m.id, taskId: t.id, state: "draft" } });
  };
  const live = () => quarterMilestones().filter(({ m }) => ["in_progress", "pending"].includes(milestoneStatus(m, today))).sort((a, b) => a.m.end.localeCompare(b.m.end));
  const updateText = () => {
    const l = live();
    const doneT = l.flatMap(({ m }) => m.tasks.filter((t) => taskProgress(t) >= 1).map((t) => t.title)).slice(0, 4);
    const doing = l.flatMap(({ m }) => m.tasks.filter((t) => { const p = taskProgress(t); return p > 0 && p < 1; }).map((t) => `${t.title} (${pct(taskProgress(t))})`)).slice(0, 4);
    const blocked = l.flatMap(({ m }) => m.tasks.filter((t) => t.blocked).map((t) => `${t.title}: ${t.blocked!.title} (with ${firstName(t.blocked!.ownerName)})`));
    const next = l.flatMap(({ m }) => m.tasks.filter((t) => taskProgress(t) === 0 && !t.blocked).map((t) => t.title)).slice(0, 2);
    return [doneT.length && `Done: ${doneT.join("; ")}`, doing.length && `In progress: ${doing.join("; ")}`, blocked.length && `Blocked: ${blocked.join("; ")}`, next.length && `Next: ${next.join("; ")}`].filter(Boolean).join("\n");
  };
  const dueSummary = () => {
    const l = live();
    if (!l.length) return say({ text: "Nothing is in progress this quarter yet. Want to plan milestones for a goal?", chips: ["Plan milestones for a goal"] });
    say({ text: `Here's what's open:\n${l.map(({ m }) => {
      const b = m.tasks.filter((t) => t.blocked).length;
      return `• **${m.title}**: ${tasksDone(m)}/${m.tasks.length} tasks done, ${m.end < today ? `ended ${fmtDate(m.end)}` : `ends ${fmtDate(m.end)}`}${b ? `, ${b} blocked` : ""}`;
    }).join("\n")}`, chips: ["Draft my weekly update", "Raise a blocker"] });
  };
  const howIs = (hit: { g: Goal; m?: Milestone }) => {
    const { g, m } = hit;
    if (!m) {
      const cur = g.milestones.find((x) => milestoneStatus(x, today) === "in_progress") ?? g.milestones.find((x) => milestoneStatus(x, today) === "pending");
      const doneM = g.milestones.filter((x) => x.tasks.length && tasksDone(x) === x.tasks.length).length;
      return say({ text: g.milestones.length ? `**${g.title}** has ${doneM} of ${g.milestones.length} milestones done and ends ${fmtDate(g.end)}.${cur ? ` The one to watch is **${cur.title}**: ${tasksDone(cur)}/${cur.tasks.length} tasks, ends ${fmtDate(cur.end)}.` : ""}`
        : `**${g.title}** has no milestones yet. Want me to suggest some?`, chips: g.milestones.length ? ["What's due this week?"] : ["Plan milestones for a goal"], subject: { goalId: g.id, milestoneId: cur?.id } });
    }
    const left = daysBetween(today, m.end);
    const next = m.tasks.find((t) => taskProgress(t) < 1 && !t.blocked);
    const blocked = m.tasks.filter((t) => t.blocked);
    say({ text: `**${m.title}** is ${tasksDone(m)} of ${m.tasks.length} tasks done, ${left < 0 ? `${-left} days past its end date` : `${left} days left`} (ends ${fmtDate(m.end)}).${blocked.length ? `\n• Blocked: ${blocked.map((t) => `${t.title} (with ${firstName(t.blocked!.ownerName)})`).join(", ")}` : ""}${next ? `\n• Next up: ${next.title} (${pct(taskProgress(next))})` : ""}`,
      chips: ["I'm blocked on this", "Draft my weekly update"], subject: { goalId: g.id, milestoneId: m.id, taskId: next?.id } });
  };
  const suggestFor = (g: Goal) => startThinking(async () => {
    const r = await suggestMilestonesAction({ title: g.title, why: g.why, start: g.start, end: g.end, existing: g.milestones.map((x) => x.title) });
    say({ text: `Here's how I'd break down **${g.title}** (${range(g.start, g.end)}). Add the ones you want.`, subject: { goalId: g.id }, card: { kind: "suggest", goalId: g.id, items: r.milestones, state: "draft" } });
  });
  const todoCard = (raw: string, remind: boolean) => {
    const { text: what, at } = parseWhen(raw.replace(/[.!]$/, ""), today);
    const s = subject();
    const g = goal(s?.goalId); const m = milestone(s);
    say({ text: `Here's the to-do. Tag it with a goal or milestone if it helps one along, then add it to your list.`,
      card: { kind: "todo", text: what[0]?.toUpperCase() + what.slice(1), goalId: g?.id ?? "", milestoneId: m?.id ?? "", remindAt: at ?? (remind ? `${nextWorkday(today)}T10:00` : ""), state: "draft" } });
  };
  const remindLater = (when: string, label: string) => {
    const s = subject();
    const m = milestone(s); const t = m?.tasks.find((x) => x.id === s?.taskId);
    if (!s || !t) return say({ text: "Which task? Add a to-do for it on your To-dos page and set a reminder there." });
    const g = goal(s.goalId)!;
    setTodos((all) => [{ id: newId("d"), text: `Pick up: ${t.title}`, done: false, quarter: g.quarter, goalId: g.id, milestoneId: m!.id, reminder: { at: when, toId: "self", toName: "You", via: "chat" } }, ...all]);
    say({ text: `Tasks don't have dates, so I added a to-do “Pick up: ${t.title}” with a reminder for ${label}. **${m!.title}** still ends ${fmtDate(m!.end)}.`, applied: "Added to your to-dos" });
  };

  /** Routes what was said (a chip or typed text) to a flow, else to Claude. */
  const respond = (said: string): void => {
    const l = said.toLowerCase().trim();
    const p = findPerson(said);
    if (lastStage === "what") {
      if (l.startsWith("waiting")) return p ? blockerCard(p.id, said) : askWho(subject(), "Who are you waiting on?");
      if (l.startsWith("requirements")) return askWho(subject(), "Who can make the requirements clear?");
      if (l.startsWith("a technical")) return say({ text: "Want to talk it through with someone? I can set up a 1:1.", chips: [...(manager ? [`Set a 1:1 with ${manager.name}`] : []), "I'll handle it"] });
    }
    if ((lastStage === "who" || lastStage === "who_1on1") && l === "someone else") return say({ text: "Type their name, for example “Kanav”.", stage: lastStage });
    if (lastStage === "who" && p) return blockerCard(p.id);
    if (lastStage === "who_1on1" && p) return meetingCard(p.id);
    if (lastStage === "todo_text" && l) return todoCard(said, false);
    const addTodo = said.match(/^(?:please\s+)?(?:add|create|make|put|new)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:to-?do|todo)(?:\s*[:\-]|\s+(?:to|for|that)\b)?\s*(.*)$/i);
    if (addTodo) return addTodo[1].trim() ? todoCard(addTodo[1].trim(), false) : say({ text: "What's the to-do? You can add when, like “ask Kanav for staging access tomorrow at 11”.", stage: "todo_text" });
    const remindMe = said.match(/^remind me to (.+)$/i);
    if (remindMe) return todoCard(remindMe[1].trim(), true);
    if (lastStage === "plan") { const g = goals.find((x) => x.title.toLowerCase() === l); if (g) return suggestFor(g); }
    if (lastStage === "done_which") { const hit = findTask(said) ?? (() => { for (const { g, m } of quarterMilestones()) { const t = m.tasks.find((x) => x.title.toLowerCase() === l); if (t) return { g, m, t }; } })(); if (hit) return doneCard(hit); }

    const set1on1 = said.match(/^set a 1:1 with (.+)$/i);
    if (set1on1) { const q = findPerson(set1on1[1]); if (q) return meetingCard(q.id); }
    if (l === "yes, i'm blocked" || l === "i'm blocked on this" || l === "raise a blocker") return askWhat(subject());
    if (l === "no, just busy") return say({ text: "Fair enough. Want a reminder to pick it up tomorrow morning?", chips: ["Remind me tomorrow at 10:00", "No thanks"] });
    if (l === "remind me tomorrow at 10:00") return remindLater(`${nextWorkday(today)}T10:00`, `${fmtWhen(`${nextWorkday(today)}T10:00`)}`);
    if (l === "move it to next week") { let d = addDays(today, 1); while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 1) d = addDays(d, 1); return remindLater(`${d}T10:00`, fmtWhen(`${d}T10:00`)); }
    if (["no thanks", "i'll handle it", "no, wait for the reply", "leave it"].includes(l)) return say({ text: "OK. I'll check in on it tomorrow." });
    if (l === "what's due this week?") return dueSummary();
    if (l === "draft my weekly update") return say({ text: `Here's a draft from your goals. Edit it, then send it to ${manager ? firstName(manager.name) : "your manager"}.`, card: { kind: "update", text: updateText(), state: "draft" } });
    if (l === "set up a 1:1") return say({ text: "Who with?", chips: [...(manager ? [manager.name] : []), ...(helper ? [helper.name] : []), "Someone else"], stage: "who_1on1" });
    if (l === "plan milestones for a goal") {
      const open = goal(focus?.goalId);
      if (open && !open.milestones.length) return suggestFor(open);
      const empty = goals.filter((g) => !g.milestones.length);
      if (empty.length === 1) return suggestFor(empty[0]);
      return say({ text: "Which goal?", chips: goals.map((g) => g.title).slice(0, 4), stage: "plan" });
    }

    const how = l.match(/^how is “(.+)” going\?$/);
    if (how) { const hit = byTitle(said); if (hit) return howIs(hit); }
    // A question ("which task should I do, given the blocker?") goes to Claude, not into a flow.
    const question = /\?$/.test(l) || /^(which|what|how|why|when|should|could|can you|do i|is it)\b/.test(l);
    if (!question && /\b(blocked|stuck|waiting (on|for)|can'?t|cannot|blocker)\b/.test(l)) {
      const hit = byTitle(said);
      const s = hit && "m" in hit && hit.m ? { goalId: hit.g.id, milestoneId: hit.m.id } : hit ? { goalId: hit.g.id } : subject();
      if (p) return blockerCard(p.id, said);
      return hit ? askWhat(s) : askWho(s, "Who can unblock it?");
    }
    if (!question && /\b(1:1|1-1|one on one|meet|sync up|call)\b/.test(l)) return p ? meetingCard(p.id) : respond("Set up a 1:1");
    if (!question && /\b(done|finished|completed|shipped|merged)\b/.test(l)) {
      const hit = findTask(said);
      if (hit) return doneCard(hit);
      const open = live().flatMap(({ m }) => m.tasks.filter((t) => taskProgress(t) < 1)).slice(0, 4);
      return say({ text: "Nice. Which task was it?", chips: open.map((t) => t.title), stage: "done_which" });
    }
    if (!question && /\b(update|status|report)\b/.test(l)) return respond("Draft my weekly update");
    if (/\b(due|this week|today|what'?s next|next up|priorit)/.test(l)) return dueSummary();
    if (/\b(milestones?|break (it|this) down)\b/.test(l)) return respond("Plan milestones for a goal");

    const context = JSON.stringify(goals.map((g) => ({ goal: g.title, dates: range(g.start, g.end), approval: g.approval, milestones: g.milestones.map((m) => ({
      title: m.title, dates: range(m.start, m.end), status: milestoneStatus(m, today), tasks: m.tasks.map((t) => ({ title: t.title, progress: pct(taskProgress(t)), blocked: t.blocked?.title })),
      todos: todos.filter((d) => d.milestoneId === m.id).map((d) => `${d.done ? "[x]" : "[ ]"} ${d.text}`),
    })), todos: todos.filter((d) => d.goalId === g.id && !d.milestoneId).map((d) => `${d.done ? "[x]" : "[ ]"} ${d.text}`) })));
    const transcript = thread.slice(-8).map((m) => `${m.from === "me" ? firstName(me.name) : "Agent"}: ${m.text}`).join("\n");
    startThinking(async () => {
      const r = await agentReplyAction({ context, transcript, question: said });
      say({ text: r.text, chips: r.source === "rules" ? QUICK : undefined });
    });
  };
  const send = (said: string) => {
    if (!said.trim() || thinking) return;
    setThread((t) => [...t, { id: newId("u"), from: "me", at: clock(), text: said.trim() }]);
    // Let the user's message land before the agent's reply reads the thread's last stage.
    setTimeout(() => respond(said.trim()), 350);
  };
  // "Ask agent" and "Raise blocker" in the middle hand a question over; take it once.
  useEffect(() => { if (prompt) { onPromptTaken(); send(prompt.text); } });

  const lastId = thread.at(-1)?.id;
  const focusLabel = focus && (milestone(focus)?.title ?? goal(focus.goalId)?.title);

  return (
    <aside className="fixed top-16 right-0 bottom-0 w-full sm:w-[400px] bg-white border-l border-line z-30 flex flex-col shadow-pop lg:shadow-none" aria-label="Goal agent">
      <div className="h-14 px-4 border-b border-line flex items-center gap-2.5 shrink-0">
        <span className="w-8 h-8 rounded-lg bg-violet text-white flex items-center justify-center"><Icon name="auto_awesome" className="text-[18px]" /></span>
        <div className="flex-1 min-w-0"><p className="text-title-md leading-tight">PMG agent</p><p className="text-[11px] text-muted leading-tight truncate">Goals, blockers, 1:1s and updates</p></div>
        <button onClick={onReset} className="btn-ghost btn-sm px-2" title="Start the demo chat over" aria-label="Start the demo chat over"><Icon name="restart_alt" className="text-[18px]" /></button>
        <button onClick={onClose} className="btn-ghost btn-sm px-2" title="Hide the agent" aria-label="Hide the agent"><Icon name="right_panel_close" className="text-[18px]" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-canvas/40">
        <p className="text-center text-[11px] text-muted uppercase tracking-wide">Today · {fmtDate(today, { weekday: "short", day: "numeric", month: "short" })}</p>
        {thread.map((m) => (
          <div key={m.id} className={cx("flex gap-2", m.from === "me" && "justify-end")}>
            {m.from === "agent" && <span className="w-6 h-6 rounded-md bg-violet-tint text-violet flex items-center justify-center shrink-0 mt-0.5"><Icon name="auto_awesome" className="text-[14px]" /></span>}
            <div className={cx("min-w-0", m.from === "me" ? "max-w-[85%]" : "flex-1")}>
              <div className={cx("rounded-xl px-3 py-2 text-body-md", m.from === "me" ? "bg-teal text-white rounded-br-sm" : "bg-white border border-line rounded-tl-sm")}><Rich text={m.text} /></div>
              {m.applied && <p className="mt-1 text-[11px] text-emerald-700 inline-flex items-center gap-1"><Icon name="check_circle" className="text-[13px]" />{m.applied}</p>}
              {m.card && <CardView msg={m} card={m.card} ctx={{ goals, todos, setTodos, people, manager, me, today, mutate, patch: (p) => patchCard(m.id, p), say }} />}
              {m.chips && m.id === lastId && !thinking && (
                <div className="flex flex-wrap gap-1.5 mt-2">{m.chips.map((c) => <button key={c} onClick={() => send(c)} className="text-label-sm rounded-full border border-violet/40 bg-white text-violet px-3 py-1 hover:bg-violet-tint">{c}</button>)}</div>
              )}
              <p className={cx("text-[10px] text-muted mt-1", m.from === "me" && "text-right")}>{m.at}</p>
            </div>
            {m.from === "me" && <Avatar name={me.name} size={24} className="mt-0.5" />}
          </div>
        ))}
        {thinking && <div className="flex gap-2 items-center text-body-sm text-muted"><span className="w-6 h-6 rounded-md bg-violet-tint text-violet flex items-center justify-center"><Icon name="auto_awesome" className="text-[14px] animate-pulse" /></span>Thinking…</div>}
        <div ref={end} />
      </div>

      <div className="border-t border-line p-3 space-y-2 shrink-0 bg-white">
        {focusLabel && <p className="text-[11px] text-muted inline-flex items-center gap-1 max-w-full"><Icon name="visibility" className="text-[13px]" /><span className="truncate">Looking at: {focusLabel}</span></p>}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">{QUICK.map((q) => <button key={q} onClick={() => send(q)} disabled={thinking} className="shrink-0 text-[11px] font-medium rounded-full border border-line bg-canvas px-2.5 py-1 text-muted hover:text-ink hover:border-slate-300">{q}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); setText(""); }} className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Tell the agent what moved, what's stuck, or ask anything…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); setText(""); } }}
            className="input h-auto py-2 resize-none flex-1" aria-label="Message the goal agent" />
          <button disabled={!text.trim() || thinking} className="btn-kudos h-10 px-3" aria-label="Send"><Icon name="send" className="text-[18px]" /></button>
        </form>
      </div>
    </aside>
  );
}

/** **bold** and line breaks, nothing more. */
function Rich({ text }: { text: string }) {
  return <>{text.split("\n").map((line, i) => <p key={i} className={cx(i > 0 && "mt-1")}>{line.split(/(\*\*.+?\*\*)/).map((part, j) => (part.startsWith("**") && part.endsWith("**") ? <b key={j} className="font-semibold">{part.slice(2, -2)}</b> : part))}</p>)}</>;
}

type CardCtx = {
  goals: Goal[]; todos: Todo[]; setTodos: (fn: (t: Todo[]) => Todo[]) => void; people: PersonOpt[]; manager: PersonOpt | null; me: { id: string; name: string }; today: string; mutate: Mutate;
  patch: (p: Partial<Card>) => void; say: (m: Omit<Msg, "id" | "from" | "at">) => void;
};

function CardView({ card, ctx }: { msg: Msg; card: Card; ctx: CardCtx }) {
  const [busy, start] = useTransition();
  const shell = (children: React.ReactNode, tone = "border-violet/30") => <div className={cx("mt-2 rounded-xl border bg-white p-3 space-y-2.5", tone)}>{children}</div>;
  const Done = ({ text }: { text: string }) => <p className="text-label-sm text-emerald-700 inline-flex items-center gap-1"><Icon name="check_circle" className="text-[15px]" />{text}</p>;

  if (card.kind === "blocker") {
    const g = ctx.goals.find((x) => x.id === card.goalId); const m = g?.milestones.find((x) => x.id === card.milestoneId);
    const owner = ctx.people.find((p) => p.id === card.ownerId);
    if (!m || !owner) return null;
    const raise = () => start(async () => {
      const tasks = m.tasks.filter((t) => card.taskIds.includes(t.id));
      const r = await raiseBlockerAction({ ownerId: owner.id, title: card.title, needBy: card.needBy, tasks: tasks.map((t) => t.title), goal: g!.title });
      if (!r.ok) return ctx.say({ text: "That didn't go through. Try again in a moment." });
      ctx.mutate((all) => { const mm = all.find((x) => x.id === card.goalId)?.milestones.find((x) => x.id === card.milestoneId); mm?.tasks.forEach((t) => { if (card.taskIds.includes(t.id)) t.blocked = { title: card.title, ownerName: owner.name, at: ctx.today }; }); });
      ctx.patch({ state: "sent" });
      ctx.say({ text: `Sent to ${firstName(owner.name)} in PMG chat, and it's on your Blockers page. ${tasks.length === 1 ? "The task now shows" : `${tasks.length} tasks now show`} as blocked on your goals. Want a quick 1:1 with ${firstName(owner.name)} to sort it out faster?`,
        chips: [`Set a 1:1 with ${owner.name}`, "No, wait for the reply"], applied: "Updated your goals" });
    });
    return shell(<>
      <p className="text-label-sm text-muted uppercase tracking-wide flex items-center gap-1"><Icon name="report" className="text-[15px] text-rose-600" />Blocker · to {owner.name}</p>
      {card.state === "draft" ? <>
        <input value={card.title} onChange={(e) => ctx.patch({ title: e.target.value })} className="input h-9 text-body-sm" aria-label="What's stuck" />
        <div className="space-y-1">
          {m.tasks.filter((t) => taskProgress(t) < 1).map((t) => (
            <label key={t.id} className="flex items-start gap-2 text-body-sm cursor-pointer">
              <input type="checkbox" checked={card.taskIds.includes(t.id)} onChange={() => ctx.patch({ taskIds: card.taskIds.includes(t.id) ? card.taskIds.filter((x) => x !== t.id) : [...card.taskIds, t.id] })} className="w-4 h-4 mt-0.5 accent-violet" />
              <span>{t.title}</span>
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-body-sm text-muted">Need by <input type="date" value={card.needBy} min={ctx.today} onChange={(e) => ctx.patch({ needBy: e.target.value })} className="input h-8 w-auto text-body-sm" /></label>
        <div className="flex gap-2"><button onClick={raise} disabled={busy || !card.taskIds.length || card.title.trim().length < 4} className="btn-kudos btn-sm"><Icon name="send" className="text-[16px]" />{busy ? "Sending…" : `Raise blocker (${card.taskIds.length})`}</button><button onClick={() => ctx.patch({ state: "dropped" })} className="btn-ghost btn-sm">Not now</button></div>
      </> : card.state === "sent" ? <><p className="text-body-sm font-medium">{card.title}</p><Done text={`Sent · ${card.taskIds.length} task${card.taskIds.length === 1 ? "" : "s"} marked blocked · need by ${fmtDate(card.needBy)}`} /></>
        : <p className="text-body-sm text-muted">Not raised.</p>}
    </>, card.state === "sent" ? "border-emerald-200" : "border-rose-200");
  }

  if (card.kind === "meeting") {
    const p = ctx.people.find((x) => x.id === card.withId);
    if (!p) return null;
    const sendInvite = () => start(async () => {
      const r = await requestMeetingAction({ withId: p.id, when: fmtWhen(card.picked), agenda: card.agenda });
      if (!r.ok) return ctx.say({ text: "That didn't go through. Try again in a moment." });
      ctx.patch({ state: "sent" });
      ctx.say({ text: `Asked ${firstName(p.name)} for ${fmtWhen(card.picked)} (15 min) in PMG chat. The agenda: “${card.agenda}”.` });
    });
    return shell(<>
      <p className="text-label-sm text-muted uppercase tracking-wide flex items-center gap-1"><Icon name="event" className="text-[15px] text-violet" />1:1 with {p.name}</p>
      {card.state === "draft" ? <>
        <div className="flex flex-wrap gap-1.5">{card.slots.map((s) => <button key={s} onClick={() => ctx.patch({ picked: s })} className={cx("text-label-sm rounded-lg border px-2.5 py-1", card.picked === s ? "bg-violet text-white border-violet" : "border-line hover:border-violet/40")}>{fmtWhen(s)}</button>)}</div>
        <textarea value={card.agenda} onChange={(e) => ctx.patch({ agenda: e.target.value })} rows={2} className="input h-auto py-1.5 text-body-sm resize-none" aria-label="Agenda" />
        <button onClick={sendInvite} disabled={busy} className="btn-kudos btn-sm"><Icon name="send" className="text-[16px]" />{busy ? "Sending…" : "Send request"}</button>
      </> : <Done text={`Requested ${fmtWhen(card.picked)} · 15 min`} />}
    </>);
  }

  if (card.kind === "update") {
    const sendIt = () => start(async () => {
      const r = await sendUpdateAction({ text: card.text });
      if (!r.ok) return ctx.say({ text: "You don't have a manager set, so there's no one to send it to." });
      ctx.patch({ state: "sent" });
      ctx.say({ text: `Sent to ${ctx.manager ? firstName(ctx.manager.name) : "your manager"} in PMG chat.` });
    });
    return shell(<>
      <p className="text-label-sm text-muted uppercase tracking-wide flex items-center gap-1"><Icon name="summarize" className="text-[15px] text-violet" />Weekly update</p>
      {card.state === "draft" ? <>
        <textarea value={card.text} onChange={(e) => ctx.patch({ text: e.target.value })} rows={7} className="input h-auto py-1.5 text-body-sm" aria-label="Weekly update" />
        <button onClick={sendIt} disabled={busy || !card.text.trim()} className="btn-kudos btn-sm"><Icon name="send" className="text-[16px]" />{busy ? "Sending…" : `Send to ${ctx.manager ? firstName(ctx.manager.name) : "manager"}`}</button>
      </> : <><p className="text-body-sm whitespace-pre-line text-muted">{card.text}</p><Done text="Sent" /></>}
    </>);
  }

  if (card.kind === "done") {
    const g = ctx.goals.find((x) => x.id === card.goalId); const m = g?.milestones.find((x) => x.id === card.milestoneId); const t = m?.tasks.find((x) => x.id === card.taskId);
    const todo = ctx.todos.find((x) => x.id === card.todoId);
    if (!todo && (!m || !t)) return null;
    const mark = () => {
      ctx.patch({ state: "done" });
      if (todo) {
        ctx.setTodos((all) => all.map((d) => (d.id === todo.id ? { ...d, done: true } : d)));
        const next = ctx.todos.find((d) => !d.done && d.id !== todo.id && (todo.milestoneId ? d.milestoneId === todo.milestoneId : d.goalId === todo.goalId));
        return ctx.say({ text: `Ticked.${next ? ` Next on your list${m ? ` for **${m.title}**` : ""}: ${next.text}.` : ""}`, applied: "Updated your to-dos" });
      }
      ctx.mutate((all) => { const tt = all.find((x) => x.id === card.goalId)?.milestones.find((x) => x.id === card.milestoneId)?.tasks.find((x) => x.id === card.taskId); if (tt) tt.progress = 100; });
      const n = tasksDone(m!) + (taskProgress(t!) < 1 ? 1 : 0);
      ctx.say({ text: n === m!.tasks.length ? `That finishes **${m!.title}**. Nice work.` : `**${m!.title}** is now ${n} of ${m!.tasks.length} tasks done.`, applied: "Updated your goals" });
    };
    return shell(card.state === "draft"
      ? <div className="flex gap-2"><button onClick={mark} className="btn-primary btn-sm"><Icon name="check" className="text-[16px]" />{todo ? "Tick it" : "Mark done"}</button><button onClick={() => ctx.patch({ state: "dropped" })} className="btn-ghost btn-sm">Not yet</button></div>
      : card.state === "done" ? <Done text={`Ticked “${todo?.text ?? t!.title}”`} /> : <p className="text-body-sm text-muted">Left as is.</p>);
  }

  if (card.kind === "todo") {
    const g = ctx.goals.find((x) => x.id === card.goalId); const m = g?.milestones.find((x) => x.id === card.milestoneId);
    const add = () => {
      if (!card.text.trim()) return;
      ctx.setTodos((all) => [{ id: newId("d"), text: card.text.trim(), done: false, quarter: g?.quarter ?? ctx.goals[0]?.quarter ?? quarterOf(ctx.today).key,
        goalId: g?.id, milestoneId: m?.id, reminder: card.remindAt ? { at: card.remindAt, toId: "self", toName: "You", via: "chat" } : undefined }, ...all]);
      ctx.patch({ state: "added" });
      ctx.say({ text: `Added to your to-dos${m ? `, tagged to **${m.title}**` : g ? `, tagged to **${g.title}**` : ""}.${card.remindAt ? ` I'll remind you ${fmtWhen(card.remindAt)}.` : ""}`, applied: "Added to your to-dos" });
    };
    return shell(<>
      <p className="text-label-sm text-muted uppercase tracking-wide flex items-center gap-1"><Icon name="checklist" className="text-[15px] text-violet" />New to-do</p>
      {card.state === "draft" ? <>
        <input value={card.text} onChange={(e) => ctx.patch({ text: e.target.value })} className="input h-9 text-body-sm" aria-label="To-do" />
        <select value={card.goalId} onChange={(e) => ctx.patch({ goalId: e.target.value, milestoneId: "" })} className="input h-9 text-body-sm" aria-label="Goal">
          <option value="">No goal</option>
          {ctx.goals.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
        <select value={card.milestoneId} onChange={(e) => ctx.patch({ milestoneId: e.target.value })} disabled={!g?.milestones.length} className="input h-9 text-body-sm disabled:opacity-50" aria-label="Milestone">
          <option value="">{g ? "Whole goal" : "Pick a goal first"}</option>
          {g?.milestones.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
        <label className="flex items-center gap-2 text-body-sm text-muted">
          <input type="checkbox" checked={!!card.remindAt} onChange={() => ctx.patch({ remindAt: card.remindAt ? "" : `${addDays(ctx.today, 1)}T10:00` })} className="w-4 h-4 accent-violet" /><span className="whitespace-nowrap">Remind me</span>
          {card.remindAt && <input type="datetime-local" value={card.remindAt} onChange={(e) => ctx.patch({ remindAt: e.target.value })} className="input h-8 w-auto text-body-sm" aria-label="Remind me at" />}
        </label>
        <div className="flex gap-2"><button onClick={add} disabled={!card.text.trim()} className="btn-kudos btn-sm"><Icon name="add" className="text-[16px]" />Add to-do</button><button onClick={() => ctx.patch({ state: "dropped" })} className="btn-ghost btn-sm">Not now</button></div>
      </> : card.state === "added" ? <><p className="text-body-sm font-medium">{card.text}</p><Done text={`Added${m ? ` · ${m.title}` : g ? ` · ${g.title}` : ""}${card.remindAt ? ` · reminder ${fmtWhen(card.remindAt)}` : ""}`} /></>
        : <p className="text-body-sm text-muted">Not added.</p>}
    </>);
  }

  const g = ctx.goals.find((x) => x.id === card.goalId);
  if (!g) return null;
  const add = () => {
    ctx.mutate((all) => {
      const x = all.find((y) => y.id === card.goalId); if (!x) return;
      x.milestones.push(...card.items.map((s) => ({ id: newId("m"), title: s.title, start: s.start, end: s.end, ai: true, tasks: s.tasks.map((tt) => ({ id: newId("t"), title: tt, progress: 0 })) })));
      x.milestones.sort((a, b) => a.start.localeCompare(b.start));
    });
    ctx.patch({ state: "added" });
    ctx.say({ text: `Added ${card.items.length} milestones to **${g.title}**. Open the goal in the middle to change any of them.`, applied: "Updated your goals" });
  };
  return shell(<>
    <ul className="space-y-2">{card.items.map((s, i) => <li key={i}><p className="text-body-sm font-semibold">{s.title}</p><p className="text-[11px] text-muted">{range(s.start, s.end)} · {s.tasks.join(" · ")}</p></li>)}</ul>
    {card.state === "draft" ? <button onClick={add} disabled={!card.items.length} className="btn-kudos btn-sm"><Icon name="add" className="text-[16px]" />Add all {card.items.length}</button> : <Done text="Added to your goal" />}
  </>);
}
