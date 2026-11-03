"use client";
// Small pieces shared by the quarter goals board and its agent: status and health pills, a "1/4 done" bar, and
// the reminder chip and editor on a to-do.
import { useState } from "react";
import { HealthPill, Icon, Pill, ProgressBar, cx, fmtDate } from "@/components/ui";
import type { Goal, Health, Reminder, Status } from "@/lib/demo/quarter-goals";

export type PersonOpt = { id: string; name: string; title: string };

export const STATUS: Record<Status, { label: string; tone: "slate" | "teal" | "amber" | "green"; icon: string }> = {
  yet_to_start: { label: "Yet to start", tone: "slate", icon: "event_upcoming" },
  in_progress: { label: "In progress", tone: "teal", icon: "play_circle" },
  pending: { label: "Pending", tone: "amber", icon: "schedule" },
  done: { label: "Done", tone: "green", icon: "check_circle" },
};

export const StatusPill = ({ s }: { s: Status }) => <Pill tone={STATUS[s].tone} icon={STATUS[s].icon}>{STATUS[s].label}</Pill>;
export const GoalHealthPill = ({ h }: { h: Health }) => (h === "Done" ? <Pill tone="green" icon="task_alt">Done</Pill> : <HealthPill health={h} />);
export const range = (a: string, b: string) => `${fmtDate(a)} – ${fmtDate(b)}`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "1/4 done" with a bar: the simple progress for goals (milestones done) and milestones (tasks done). */
export function CountBar({ done, total, label, tone = "teal" }: { done: number; total: number; label: string; tone?: "teal" | "amber" }) {
  return (
    <div className="flex items-center gap-3">
      <ProgressBar value={total ? (done / total) * 100 : 0} tone={tone} className="flex-1" />
      <span className="text-label-sm text-muted whitespace-nowrap">{done}/{total} {label}</span>
    </div>
  );
}

export function SourceLine({ g, manager }: { g: Goal; manager: string }) {
  if (g.approval === "waiting") return <Pill tone="amber" icon="hourglass_empty">Waiting for {manager} to approve</Pill>;
  return g.source === "manager"
    ? <span className="text-body-sm text-muted inline-flex items-center gap-1"><Icon name="person" className="text-[16px]" />Set by {manager}</span>
    : <span className="text-body-sm text-muted inline-flex items-center gap-1"><Icon name="verified" className="text-[16px] text-teal" />Created by you · approved</span>;
}

export const fmtWhen = (at: string) =>
  new Date(at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function ReminderChip({ r, now }: { r: Reminder; now: string }) {
  const who = r.toId === "self" ? "you" : r.toName.split(" ")[0];
  if (r.sentAt) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700"><Icon name="mark_chat_read" className="text-[13px]" />Sent to {who}</span>;
  const due = r.at <= now;
  return (
    <span className={cx("inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5", due ? "bg-amber-100 text-amber-800" : "bg-violet-tint text-violet")}>
      <Icon name="notifications" className="text-[13px]" />{fmtWhen(r.at)} · {who} · {r.via === "slack" ? "Slack" : "Chat"}
    </span>
  );
}

/** Set, change or send a reminder for a to-do: to yourself or a colleague, by PMG chat or Slack. */
export function ReminderEditor({ initial, people, me, defaultAt, onSave, onSendNow, onRemove, onClose }: {
  initial?: Reminder; people: PersonOpt[]; me: string; defaultAt: string;
  onSave: (r: Reminder) => void; onSendNow: (r: Reminder) => void; onRemove: () => void; onClose: () => void;
}) {
  const [toId, setToId] = useState(initial?.toId ?? "self");
  const [at, setAt] = useState(initial?.at ?? defaultAt);
  const [via, setVia] = useState<Reminder["via"]>(initial?.via ?? "chat");
  const build = (): Reminder => ({ at, via, toId, toName: toId === "self" ? "You" : people.find((p) => p.id === toId)?.name ?? toId });
  return (
    <div className="mt-2 rounded-lg border border-violet/30 bg-violet-tint/30 p-3 space-y-2.5">
      <div className="grid sm:grid-cols-[1fr_190px] gap-2">
        <label className="block"><span className="text-label-sm text-muted">Remind</span>
          <select value={toId} onChange={(e) => setToId(e.target.value)} className="input h-9">
            <option value="self">Me</option>
            {people.filter((p) => p.id !== me).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
          </select></label>
        <label className="block"><span className="text-label-sm text-muted">When</span>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="input h-9" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
          {(["chat", "slack"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setVia(v)} className={cx("px-2.5 py-1 rounded-md text-label-sm", via === v ? "bg-violet text-white" : "text-muted")}>{v === "chat" ? "PMG chat" : "Slack"}</button>
          ))}
        </div>
        <span className="flex-1" />
        {initial && <button type="button" onClick={onRemove} className="btn-ghost btn-sm">Remove</button>}
        <button type="button" onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
        <button type="button" onClick={() => onSendNow(build())} className="btn-secondary btn-sm"><Icon name="send" className="text-[16px]" />Send now</button>
        <button type="button" onClick={() => onSave(build())} className="btn-kudos btn-sm"><Icon name="notifications" className="text-[16px]" />Set reminder</button>
      </div>
    </div>
  );
}
