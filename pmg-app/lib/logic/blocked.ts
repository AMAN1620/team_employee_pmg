import type { Blocker } from "@/lib/repo/types";
import { addDays, daysBetween } from "@/lib/time";
import { fmtDay } from "@/lib/planner";

/** Days a single blocker has been (or was) open. Same-day resolutions count as 1 day. */
export function blockerDays(b: Pick<Blocker, "opened_at" | "resolved_at">, today: string): number {
  return Math.max(1, daysBetween(b.opened_at, b.resolved_at ?? today));
}

/**
 * Calendar days with at least one blocker open, e.g. for a goal's "8 days blocked this quarter".
 * Overlapping blockers count once: waiting on three people for the same week is one week blocked.
 */
export function daysBlocked(blockers: Pick<Blocker, "opened_at" | "resolved_at">[], today: string): number {
  const spans = blockers
    .map((b) => { const start = b.opened_at.slice(0, 10); return [start, addDays(start, blockerDays(b, today))] as const; })
    .sort((a, b) => a[0].localeCompare(b[0]));
  let total = 0, end = "";
  for (const [start, stop] of spans) {
    if (stop <= end) continue;
    total += daysBetween(start > end ? start : end, stop);
    end = stop;
  }
  return total;
}

export type DisplayStatus = Blocker["status"] | "overdue";

/** What the pill shows: an unresolved blocker past its need-by date is Overdue. */
export function displayStatus(b: Blocker, today: string): DisplayStatus {
  if (b.status !== "resolved" && b.need_by && b.need_by < today) return "overdue";
  return b.status;
}

export function daysOverdue(b: Blocker, today: string): number {
  return b.need_by && b.status !== "resolved" ? Math.max(0, daysBetween(b.need_by, today)) : 0;
}

/** Suggest escalation once a blocker is past its need-by date and hasn't been escalated yet. */
export function shouldSuggestEscalation(b: Blocker, today: string): boolean {
  return daysOverdue(b, today) > 0 && !b.escalated_at;
}

// ── Raising a blocker (shared by the form, which previews, and the server, which saves) ──

export const BLOCKER_CATEGORIES = [
  { key: "people", label: "People and dependencies", icon: "group", help: "Waiting on a person or a team" },
  { key: "skills", label: "Skills and knowledge", icon: "school", help: "Something you don't know how to do yet" },
  { key: "tools", label: "Tools and technology", icon: "build", help: "Access, environments, broken tools" },
  { key: "time", label: "Time and workload", icon: "hourglass_top", help: "Too much on, or pulled onto other work" },
  { key: "clarity", label: "Clarity and direction", icon: "explore", help: "Unclear scope, priorities or requirements" },
  { key: "process", label: "Processes and approvals", icon: "rule", help: "Waiting on a sign-off or a process step" },
  { key: "personal", label: "Personal", icon: "beach_access", help: "Absence, leave or personal commitments" },
] as const;
export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[number]["key"];
export const categoryOf = (key: string | null) => BLOCKER_CATEGORIES.find((c) => c.key === key);

export const CHANNEL_LABEL: Record<string, string> = { slack: "Slack", google_chat: "Google Chat", email: "Email", calendar: "Calendar" };

/** The email PMG drafts from what the employee entered, for each person who can unblock them. */
export function draftBlockerEmail(b: { title: string; needed?: string | null; details?: string | null; needBy?: string | null; goal?: string | null; milestone?: string | null },
  from: string, to: string): { subject: string; body: string } {
  const first = (n: string) => n.split(" ")[0];
  const on = b.milestone ? `“${b.milestone}” on my goal “${b.goal}”` : b.goal ? `my goal “${b.goal}”` : "my work";
  const lines = [
    `Hi ${first(to)},`,
    "",
    `I'm blocked on ${on}: ${b.title.replace(/\.$/, "")}.`,
    "",
    ...(b.needed ? [`What I need: ${b.needed}`] : []),
    ...(b.needBy ? [`Needed by: ${fmtDay(b.needBy)}`] : []),
    ...(b.details ? ["", b.details] : []),
    "",
    "Could you help, or point me to the right person? I'm happy to jump on a quick call.",
    "",
    "Thanks,",
    first(from),
  ];
  return { subject: `Blocked: ${b.title}${b.needBy ? ` (needed by ${fmtDay(b.needBy)})` : ""}`, body: lines.join("\n") };
}

export type Reminder = { kind: "day_before" | "due_day" | "escalation_prompt"; on: string; to: "owner" | "raiser"; text: string; state: "sent" | "scheduled" | "skipped" };

/**
 * When PMG reminds people about a blocker: whoever can unblock it a day before it's needed, the employee on the day
 * (is it resolved?), and the employee again the day after if it isn't, asking before anything is escalated.
 */
export function blockerReminders(b: Pick<Blocker, "need_by" | "status" | "resolved_at" | "opened_at" | "owner_id" | "raised_by">, today: string): Reminder[] {
  if (!b.need_by) return [];
  const plan: Omit<Reminder, "state">[] = [
    ...(b.owner_id !== b.raised_by ? [{ kind: "day_before" as const, on: addDays(b.need_by, -1), to: "owner" as const, text: "Reminder: it's needed tomorrow" }] : []),
    { kind: "due_day", on: b.need_by, to: "raiser", text: "Due today: is it resolved?" },
    { kind: "escalation_prompt", on: addDays(b.need_by, 1), to: "raiser", text: "Still blocked: escalate? (you decide first)" },
  ];
  const opened = b.opened_at.slice(0, 10), closed = b.resolved_at?.slice(0, 10);
  return plan.filter((r) => r.on >= opened).map((r) => ({
    ...r, state: closed && closed < r.on ? "skipped" : r.on <= today ? "sent" : "scheduled",
  }));
}
