// Quarter goals: goal (start/end) → milestones (start/end) → tasks (progress, no dates). To-dos are a separate,
// private list: each one sits in a quarter and can be tagged with one of its goals and a milestone, and carry a
// reminder. Pure data and rules, safe for the browser. The board keeps a person's copy in their browser for now;
// the samples below are what people start with (Aman's comes from his Jira work, everyone else gets a generic one).
import { daysBetween } from "@/lib/time";

export type Reminder = { at: string; toId: string; toName: string; via: "chat" | "slack"; sentAt?: string };
export type Todo = { id: string; text: string; done: boolean; quarter: string; goalId?: string; milestoneId?: string; reminder?: Reminder };
export type Task = { id: string; title: string; progress: number; blocked?: { title: string; ownerName: string; at: string } };
export type Milestone = { id: string; title: string; start: string; end: string; ai?: boolean; tasks: Task[] };
export type Goal = {
  id: string; quarter: string; title: string; why: string; start: string; end: string;
  source: "manager" | "self"; approval: "approved" | "waiting"; milestones: Milestone[];
};
export type Status = "yet_to_start" | "in_progress" | "pending" | "done";
export type Health = "On track" | "At risk" | "Off track" | "Done";

export const QUARTERS = [
  { key: "2026-07-01", label: "Q3 2026", start: "2026-07-01", end: "2026-09-30" },
  { key: "2026-10-01", label: "Q4 2026", start: "2026-10-01", end: "2026-12-31" },
  { key: "2027-01-01", label: "Q1 2027", start: "2027-01-01", end: "2027-03-31" },
];
export const quarterOf = (d: string) => QUARTERS.find((q) => q.start <= d && d <= q.end) ?? QUARTERS[1];

/** A task's progress is set by hand, in quarters (0, 25, 50, 75, 100). */
export const taskProgress = (t: Task) => t.progress / 100;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const milestoneProgress = (m: Milestone) => avg(m.tasks.map(taskProgress));
export const goalProgress = (g: Goal) => avg(g.milestones.map(milestoneProgress));
export const tasksDone = (m: Milestone) => m.tasks.filter((t) => taskProgress(t) >= 1).length;
export const milestonesDone = (g: Goal) => g.milestones.filter((m) => m.tasks.length > 0 && tasksDone(m) === m.tasks.length).length;

export function milestoneStatus(m: Milestone, today: string): Status {
  const p = milestoneProgress(m);
  if (m.tasks.length && p >= 1) return "done";
  if (m.end < today) return "pending";
  if (p > 0 || m.start <= today) return "in_progress";
  return "yet_to_start";
}

/** Progress against how much of the goal's time has gone. */
export function goalHealth(g: Goal, today: string): Health {
  const p = goalProgress(g);
  if (g.milestones.length && p >= 1) return "Done";
  const span = Math.max(1, daysBetween(g.start, g.end));
  const elapsed = Math.min(1, Math.max(0, daysBetween(g.start, today) / span));
  const behind = elapsed - p;
  if (behind > 0.35) return "Off track";
  return behind > 0.15 || g.milestones.some((m) => milestoneStatus(m, today) === "pending") ? "At risk" : "On track";
}

let n = 0;
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;

const t = (id: string, title: string, progress: number): Task => ({ id, title, progress });

/** The sample quarter for someone. Reminders name real people from the org chart so "send now" reaches their chat. */
export function sampleGoals(personId?: string): Goal[] {
  return personId === "aman" ? amanGoals() : genericGoals();
}

/** Aman's quarter, from his Jira work: Simkey Phase 4's cross-chat memory (SP0-615) and the web search tool (SP0-1231). */
function amanGoals(): Goal[] {
  return [
    {
      id: "a0", quarter: "2026-07-01", title: "Multiple goals with payments live in Simkey", why: "Users can run more than one goal and pay for it in the app.",
      start: "2026-07-01", end: "2026-09-25", source: "manager", approval: "approved",
      milestones: [
        { id: "a0m1", title: "Razorpay micro-payments working", start: "2026-07-01", end: "2026-07-24", tasks: [t("a0t1", "Razorpay integration for micro-payments", 100), t("a0t2", "Payment pop-up when a free user adds a second goal", 100)] },
        { id: "a0m2", title: "Goal chats live", start: "2026-07-27", end: "2026-09-25", tasks: [t("a0t3", "Goal Action Journey chats", 100), t("a0t4", "First-time and return user experience", 100)] },
      ],
    },
    {
      id: "a1", quarter: "2026-10-01", title: "Ship cross-chat memory in Simkey", why: "Simkey remembers what users said in earlier chats, without slowing answers down.",
      start: "2026-10-01", end: "2026-12-18", source: "manager", approval: "approved",
      milestones: [
        { id: "a1m1", title: "Cross-chat memory proven in a PoC", start: "2026-10-01", end: "2026-10-23", tasks: [
          t("a1t1", "POC: Cross-Chat Memory for Simkey", 100),
          t("a1t2", "Backfill chat summaries for un-summarised chats", 75)] },
        { id: "a1m2", title: "Memory recall gated and fast on staging", start: "2026-10-26", end: "2026-11-20", tasks: [
          t("a1t3", "PoC to find relevant context from past conversations", 50),
          t("a1t4", "Measure vector query latency at 1 to 1000 concurrent users", 25),
          t("a1t5", "Gate when to fetch summaries", 0), t("a1t6", "Send relevant summaries to the context", 0)] },
        { id: "a1m3", title: "Cross-chat memory live for all users", start: "2026-11-23", end: "2026-12-18", tasks: [
          t("a1t7", "Load-test memory lookups on staging", 0), t("a1t8", "Roll out behind a feature flag", 0), t("a1t9", "Track recall quality after launch", 0)] },
      ],
    },
    {
      id: "a2", quarter: "2026-10-01", title: "Web search answers users can trust", why: "Simkey searches the web only when it helps, and shows where answers came from.",
      start: "2026-10-01", end: "2026-11-27", source: "self", approval: "approved",
      milestones: [
        { id: "a2m1", title: "Web search live in chat", start: "2026-10-01", end: "2026-10-16", tasks: [
          t("a2t1", "Tech spec for the web search tool", 100), t("a2t2", "Evaluate search providers and pick one", 100),
          t("a2t3", "Add the general web search tool", 100), t("a2t4", "Show web results in the chat UI", 100)] },
        { id: "a2m2", title: "Web search in voice chat", start: "2026-10-19", end: "2026-11-06", ai: true, tasks: [
          t("a2t5", "Web search in voice chat", 100), t("a2t6", "Trigger guidelines: when to search", 50), t("a2t7", "Read out sources in voice answers", 0)] },
        { id: "a2m3", title: "Search quality measured", start: "2026-11-09", end: "2026-11-27", ai: true, tasks: [
          t("a2t8", "Log every search trigger", 0), t("a2t9", "Review 50 answers with Anshika", 0)] },
      ],
    },
    {
      id: "a3", quarter: "2026-10-01", title: "Lead the tech design for a Simkey feature", why: "Own a design end to end, from spec to review.",
      start: "2026-11-02", end: "2026-12-31", source: "self", approval: "waiting", milestones: [],
    },
  ];
}

function genericGoals(): Goal[] {
  return [
    {
      id: "g0", quarter: "2026-07-01", title: "Ship the onboarding redesign", why: "New users reach their first saved project in one session.",
      start: "2026-07-01", end: "2026-09-25", source: "manager", approval: "approved",
      milestones: [
        { id: "g0m1", title: "Designs signed off", start: "2026-07-01", end: "2026-07-24", tasks: [t("g0t1", "Review flows with Design", 100), t("g0t2", "Prototype the new first-run screen", 100)] },
        { id: "g0m2", title: "New onboarding live for all users", start: "2026-07-27", end: "2026-09-25", tasks: [t("g0t3", "Build the first-run screens", 100), t("g0t4", "Roll out behind a flag", 100)] },
      ],
    },
    {
      id: "g1", quarter: "2026-10-01", title: "Launch Design System v2 across the web app", why: "Squads stop rebuilding inputs, dialogs and colours on every screen.",
      start: "2026-10-01", end: "2026-12-15", source: "manager", approval: "approved",
      milestones: [
        { id: "g1m1", title: "Tokens and audit done", start: "2026-10-01", end: "2026-10-16", tasks: [
          t("g1t1", "Audit existing components", 100), t("g1t2", "Define colour and spacing tokens", 100), t("g1t3", "Publish the tokens package", 100)] },
        { id: "g1m2", title: "Core components in Storybook", start: "2026-10-12", end: "2026-11-13", tasks: [
          t("g1t4", "Button, Input and Select", 100),
          t("g1t5", "Modal and Toast with focus trap", 50),
          t("g1t6", "Form field patterns", 25), t("g1t7", "Dark-mode tokens", 0)] },
        { id: "g1m3", title: "Adopted by 2 squads", start: "2026-11-16", end: "2026-12-15", tasks: [
          t("g1t8", "Migrate checkout to v2", 0), t("g1t9", "Migrate settings pages", 0), t("g1t10", "Docs site with usage examples", 0)] },
      ],
    },
    {
      id: "g2", quarter: "2026-10-01", title: "Make mobile checkout faster and easier", why: "Fewer people drop off between cart and payment on phones.",
      start: "2026-10-15", end: "2026-12-31", source: "self", approval: "approved",
      milestones: [
        { id: "g2m1", title: "Cart and address step rebuilt", start: "2026-10-15", end: "2026-11-06", ai: true, tasks: [
          t("g2t1", "Responsive cart page", 100),
          t("g2t2", "Address form with validation", 75),
          t("g2t3", "Saved addresses", 50)] },
        { id: "g2m2", title: "Payment and confirmation live", start: "2026-11-09", end: "2026-12-04", ai: true, tasks: [
          t("g2t4", "Payment step UI", 0), t("g2t5", "Order confirmation screen", 0), t("g2t6", "Retry failed payments", 0)] },
        { id: "g2m3", title: "Drop-off measured and tuned", start: "2026-12-07", end: "2026-12-31", ai: true, tasks: [
          t("g2t7", "Checkout funnel dashboard", 0), t("g2t8", "Test a one-page checkout", 0)] },
      ],
    },
    {
      id: "g3", quarter: "2026-10-01", title: "Grow as a code reviewer", why: "Give reviews the team learns from, not just approvals.",
      start: "2026-11-02", end: "2026-12-31", source: "self", approval: "waiting", milestones: [],
    },
  ];
}

const td = (id: string, text: string, tags: { goalId?: string; milestoneId?: string; quarter?: string } = {}, done = false, reminder?: Reminder): Todo =>
  ({ id, text, done, quarter: tags.quarter ?? "2026-10-01", goalId: tags.goalId, milestoneId: tags.milestoneId, reminder });

/** Sample to-dos to go with the sample goals: some tagged to a goal and milestone, some to a goal only, some to nothing. */
export function sampleTodos(personId?: string): Todo[] {
  if (personId === "aman") {
    const recall = { goalId: "a1", milestoneId: "a1m2" }, poc = { goalId: "a1", milestoneId: "a1m1" };
    return [
      td("d1", "Pick the top 3 summaries under the token budget", recall),
      td("d2", "Compare answers with and without memory", recall),
      td("d3", "Get read access to the staging DB", recall, false, { at: "2026-10-30T10:00", toId: "kanav", toName: "Kanav Anand", via: "slack" }),
      td("d4", "Share the latency numbers with Venkatesh", recall, false, { at: "2026-11-02T11:00", toId: "self", toName: "You", via: "chat" }),
      td("d5", "Get Venkatesh's review on the backfill PR", poc, false, { at: "2026-10-29T16:00", toId: "venkatesh", toName: "Venkatesh TR", via: "chat" }),
      td("d6", "Draft the voice copy for reading out sources", { goalId: "a2", milestoneId: "a2m2" }),
      td("d7", "Ask Anshika for 50 sample questions to review", { goalId: "a2", milestoneId: "a2m3" }, false, { at: "2026-11-09T10:00", toId: "anshika", toName: "Anshika Goswami", via: "slack" }),
      td("d8", "Read DDIA chapter 3 before the design review", { goalId: "a3" }),
      td("d9", "Book the laptop battery replacement", {}, false, { at: "2026-10-30T17:30", toId: "self", toName: "You", via: "chat" }),
      td("d10", "Score summaries by relevance", recall, true),
      td("d11", "Pull the last 20 chat summaries", recall, true),
      td("d12", "Write the backfill script", poc, true),
    ];
  }
  const storybook = { goalId: "g1", milestoneId: "g1m2" }, address = { goalId: "g2", milestoneId: "g2m1" };
  return [
    td("d1", "Stories for every Modal and Toast variant", storybook),
    td("d2", "Ask Rupam for an accessibility review", storybook, false, { at: "2026-10-30T10:00", toId: "rupam", toName: "Rupam Mishra", via: "slack" }),
    td("d3", "Unit tests for the address validators", address, false, { at: "2026-10-29T16:00", toId: "self", toName: "You", via: "chat" }),
    td("d4", "Review checkout copy with Salman", address, false, { at: "2026-11-02T11:00", toId: "salman", toName: "Mahammad Salman Hawaldar", via: "chat" }),
    td("d5", "Pick three PRs to review with written notes", { goalId: "g3" }),
    td("d6", "Submit travel reimbursement", {}),
    td("d7", "Focus trap and Escape to close", storybook, true),
  ];
}
