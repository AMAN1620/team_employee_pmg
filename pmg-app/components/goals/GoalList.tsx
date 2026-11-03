"use client";
// The middle of the goals page: the quarter's goals as cards. Open a goal to see its milestones ("1/4 tasks done"),
// open a milestone to see its tasks and set their progress. To-dos live on their own page; a milestone links to the
// ones tagged to it. AI can suggest a goal's milestones, and any milestone can be handed to the agent ("Ask agent").
import Link from "next/link";
import { useState, useTransition } from "react";
import { Card, Icon, Pill, ProgressBar, cx, fmtDate } from "@/components/ui";
import { addDays, daysBetween } from "@/lib/time";
import { goalHealth, milestoneStatus, milestonesDone, newId, taskProgress, tasksDone, type Goal, type Milestone, type Task } from "@/lib/demo/quarter-goals";
import type { SuggestedMilestone } from "@/lib/ai/types";
import { suggestMilestonesAction } from "@/app/actions/quarter-goals";
import { CountBar, GoalHealthPill, SourceLine, StatusPill, pct, range } from "./bits";

export type Mutate = (fn: (goals: Goal[]) => void) => void;
type Ctx = { today: string; manager: string; mutate: Mutate; notify: (t: string) => void; ask: (t: string) => void; openTodos: (milestoneId: string) => number };

export function GoalList({ goals, openGoal, openMilestone, onGoal, onMilestone, ctx }: {
  goals: Goal[]; openGoal?: string; openMilestone?: string; onGoal: (id?: string) => void; onMilestone: (id?: string) => void; ctx: Ctx;
}) {
  return (
    <ul className="space-y-3">
      {goals.map((g) => (
        <li key={g.id}>
          <GoalCard g={g} open={openGoal === g.id} openMilestone={openMilestone} onToggle={() => onGoal(openGoal === g.id ? undefined : g.id)} onMilestone={onMilestone} ctx={ctx} />
        </li>
      ))}
    </ul>
  );
}

function GoalCard({ g, open, openMilestone, onToggle, onMilestone, ctx }: {
  g: Goal; open: boolean; openMilestone?: string; onToggle: () => void; onMilestone: (id?: string) => void; ctx: Ctx;
}) {
  const [suggested, setSuggested] = useState<{ items: SuggestedMilestone[]; pick: boolean[]; source: "ai" | "rules" } | null>(null);
  const [adding, setAdding] = useState(false);
  const [thinking, startThinking] = useTransition();
  const edit = (fn: (goal: Goal) => void) => ctx.mutate((all) => { const x = all.find((y) => y.id === g.id); if (x) fn(x); });
  const suggest = () => startThinking(async () => {
    const r = await suggestMilestonesAction({ title: g.title, why: g.why, start: g.start, end: g.end, existing: g.milestones.map((x) => x.title) });
    setSuggested({ items: r.milestones, pick: r.milestones.map(() => true), source: r.source });
  });
  const addSuggested = () => {
    if (!suggested) return;
    const made: Milestone[] = suggested.items.filter((_, i) => suggested.pick[i]).map((s) => ({
      id: newId("m"), title: s.title, start: s.start, end: s.end, ai: true, tasks: s.tasks.map((t) => ({ id: newId("t"), title: t, progress: 0 })),
    }));
    edit((x) => { x.milestones.push(...made); x.milestones.sort((a, b) => a.start.localeCompare(b.start)); });
    setSuggested(null);
    ctx.notify(`Added ${made.length} milestone${made.length === 1 ? "" : "s"} to “${g.title}”.`);
  };
  const done = milestonesDone(g);
  const pending = g.milestones.some((m) => milestoneStatus(m, ctx.today) === "pending");

  return (
    <Card className={cx("overflow-hidden", open && "ring-2 ring-teal/20 border-teal/40", g.approval === "waiting" && "border-dashed border-amber-300")}>
      <button onClick={onToggle} className="w-full text-left p-5 hover:bg-canvas/50">
        <div className="flex items-start gap-3">
          <Icon name={open ? "expand_more" : "chevron_right"} className="text-[22px] text-muted mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">{g.approval === "approved" && g.milestones.length > 0 && <GoalHealthPill h={goalHealth(g, ctx.today)} />}<SourceLine g={g} manager={ctx.manager} /></div>
            <p className="text-headline-sm mt-1.5">{g.title}</p>
            <p className="text-body-sm text-muted mt-0.5">{range(g.start, g.end)}{g.why && ` · ${g.why}`}</p>
            <div className="mt-3">{g.milestones.length ? <CountBar done={done} total={g.milestones.length} label="milestones done" tone={pending ? "amber" : "teal"} />
              : <p className="text-body-sm text-violet inline-flex items-center gap-1"><Icon name="auto_awesome" className="text-[16px]" />No milestones yet. Open it and let AI suggest them.</p>}</div>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-line bg-canvas/40 p-4 space-y-3">
          {g.approval === "waiting" && <p className="text-body-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">You can plan it now. {ctx.manager} sees the milestones when approving the goal.</p>}
          {g.milestones.map((m) => <MilestoneRow key={m.id} g={g} m={m} open={openMilestone === m.id} onToggle={() => onMilestone(openMilestone === m.id ? undefined : m.id)} ctx={ctx} />)}

          {suggested && (
            <div className="rounded-xl border border-violet/40 bg-violet-tint/30 p-4">
              <p className="text-label-md text-violet flex items-center gap-1.5"><Icon name="auto_awesome" className="text-[18px]" />{suggested.source === "ai" ? "Suggested by AI" : "Suggested by PMG"} · pick the ones to keep</p>
              {!suggested.items.length && <p className="text-body-md text-muted mt-2">Nothing new to suggest for this goal.</p>}
              <ul className="mt-3 space-y-2">
                {suggested.items.map((s, i) => (
                  <li key={i}>
                    <label className={cx("flex gap-3 rounded-lg border bg-white p-3 cursor-pointer", suggested.pick[i] ? "border-violet/40" : "border-line opacity-60")}>
                      <input type="checkbox" checked={suggested.pick[i]} onChange={() => setSuggested({ ...suggested, pick: suggested.pick.map((v, j) => (j === i ? !v : v)) })} className="mt-1 w-4 h-4 accent-violet" />
                      <span className="min-w-0">
                        <span className="block text-title-md">{s.title}</span>
                        <span className="block text-body-sm text-muted">{range(s.start, s.end)} · {s.tasks.join(" · ")}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setSuggested(null)} className="btn-ghost btn-sm">Discard</button>
                {suggested.items.length > 0 && <button onClick={addSuggested} disabled={!suggested.pick.some(Boolean)} className="btn-kudos btn-sm">Add {suggested.pick.filter(Boolean).length} milestones</button>}
              </div>
            </div>
          )}
          {adding && <AddMilestone g={g} today={ctx.today} onCancel={() => setAdding(false)} onAdd={(nm) => { edit((x) => { x.milestones.push(nm); x.milestones.sort((a, b) => a.start.localeCompare(b.start)); }); setAdding(false); onMilestone(nm.id); }} />}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={suggest} disabled={thinking} className={g.milestones.length ? "btn-secondary btn-sm" : "btn-kudos btn-sm"}><Icon name="auto_awesome" className={cx("text-[16px]", g.milestones.length > 0 && "text-violet")} />{thinking ? "Thinking…" : "Suggest milestones with AI"}</button>
            <button onClick={() => setAdding(true)} className="btn-secondary btn-sm"><Icon name="add" className="text-[16px]" />Add milestone</button>
            <button onClick={() => ctx.ask(`How is “${g.title}” going?`)} className="btn-ghost btn-sm"><Icon name="forum" className="text-[16px]" />Ask agent</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function MilestoneRow({ g, m, open, onToggle, ctx }: { g: Goal; m: Milestone; open: boolean; onToggle: () => void; ctx: Ctx }) {
  const [newTask, setNewTask] = useState("");
  const s = milestoneStatus(m, ctx.today);
  const em = (fn: (x: Milestone) => void) => ctx.mutate((all) => { const x = all.find((y) => y.id === g.id)?.milestones.find((y) => y.id === m.id); if (x) fn(x); });
  const left = daysBetween(ctx.today, m.end);
  const blocked = m.tasks.filter((t) => t.blocked).length;
  const todos = ctx.openTodos(m.id);
  return (
    <div className={cx("rounded-xl border bg-white", open ? "border-teal/50" : "border-line", s === "pending" && "border-l-[3px] border-l-amber-500")}>
      <button onClick={onToggle} className="w-full text-left px-4 py-3">
        <div className="flex items-start gap-2">
          <Icon name={open ? "expand_more" : "chevron_right"} className="text-[20px] text-muted" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-title-md">{m.title}</p>
              <div className="flex items-center gap-1.5">{blocked > 0 && <Pill tone="red" icon="block">{blocked} blocked</Pill>}<StatusPill s={s} /></div>
            </div>
            <p className="text-body-sm text-muted flex items-center gap-2">
              {range(m.start, m.end)} · {s === "done" ? "finished" : left < 0 ? <span className="text-amber-700">{-left} days past its end</span> : ctx.today < m.start ? `starts ${fmtDate(m.start)}` : `${left} days left`}
              {m.ai && <span className="inline-flex items-center gap-0.5 text-violet"><Icon name="auto_awesome" className="text-[13px]" />AI</span>}
            </p>
            <div className="mt-2"><CountBar done={tasksDone(m)} total={m.tasks.length} label="tasks done" tone={s === "pending" ? "amber" : "teal"} /></div>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-line">
          <ul className="divide-y divide-line">{m.tasks.map((t) => <TaskRow key={t.id} t={t} em={em} notify={ctx.notify} />)}</ul>
          <Link href={`/todos?goal=${g.id}&milestone=${m.id}`} className="flex items-center gap-1.5 px-4 py-2.5 border-t border-line text-body-sm text-teal hover:bg-canvas/60">
            <Icon name="checklist" className="text-[16px]" />{todos ? `${todos} open to-do${todos === 1 ? "" : "s"} for this milestone` : "Add a to-do for this milestone"}<Icon name="arrow_forward" className="text-[16px]" />
          </Link>
          <div className="p-3 border-t border-line flex flex-wrap gap-2">
            <form onSubmit={(e) => { e.preventDefault(); const v = newTask.trim(); if (!v) return; em((x) => x.tasks.push({ id: newId("t"), title: v, progress: 0 })); setNewTask(""); }} className="flex gap-2 flex-1 min-w-60">
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} className="input h-9" placeholder="Add a task and press Enter" />
            </form>
            <button onClick={() => ctx.ask(`I'm blocked on “${m.title}”`)} className="btn-secondary btn-sm h-9"><Icon name="report" className="text-[16px]" />Raise blocker</button>
            <button onClick={() => ctx.ask(`How is “${m.title}” going?`)} className="btn-ghost btn-sm h-9"><Icon name="forum" className="text-[16px]" />Ask agent</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddMilestone({ g, today, onAdd, onCancel }: { g: Goal; today: string; onAdd: (m: Milestone) => void; onCancel: () => void }) {
  const last = g.milestones.at(-1)?.end;
  const start0 = last && last < g.end ? addDays(last, 1) : today > g.start && today < g.end ? today : g.start;
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(start0);
  const [end, setEnd] = useState(addDays(start0, 20) < g.end ? addDays(start0, 20) : g.end);
  const ok = title.trim().length > 2 && start <= end && start >= g.start && end <= g.end;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok) onAdd({ id: newId("m"), title: title.trim(), start, end, tasks: [] }); }} className="rounded-xl border border-line bg-white p-4 space-y-3">
      <label className="block"><span className="label">Milestone</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Memory recall live on staging" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="label">Start</span><input type="date" value={start} min={g.start} max={g.end} onChange={(e) => setStart(e.target.value)} className="input" /></label>
        <label className="block"><span className="label">End</span><input type="date" value={end} min={start} max={g.end} onChange={(e) => setEnd(e.target.value)} className="input" /></label>
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="btn-ghost btn-sm">Cancel</button><button disabled={!ok} className="btn-primary btn-sm">Add milestone</button></div>
    </form>
  );
}

const STEPS = [0, 25, 50, 75, 100];

function TaskRow({ t, em, notify }: { t: Task; em: (fn: (x: Milestone) => void) => void; notify: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const p = taskProgress(t);
  const et = (fn: (x: Task) => void) => em((ms) => { const x = ms.tasks.find((y) => y.id === t.id); if (x) fn(x); });
  return (
    <li className={cx(open && "bg-canvas/60")}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
        <span className={cx("w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ml-6", p >= 1 ? "bg-emerald-500 border-emerald-500" : p > 0 ? "border-teal" : "border-slate-300")}>{p >= 1 && <Icon name="check" className="text-[12px] text-white" />}</span>
        <span className={cx("flex-1 min-w-0 text-body-md", p >= 1 && "text-muted line-through decoration-slate-300")}>{t.title}</span>
        {t.blocked && <Pill tone="red" icon="block">Blocked · {t.blocked.ownerName.split(" ")[0]}</Pill>}
        <span className="w-24 hidden sm:flex items-center gap-2"><ProgressBar value={p * 100} className="flex-1" /><span className="text-label-sm text-muted w-8 text-right">{pct(p)}</span></span>
      </button>
      {open && (
        <div className="pl-[60px] pr-4 pb-3 space-y-2.5">
          {t.blocked && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-body-sm text-rose-800 flex flex-wrap items-center gap-2">
              <Icon name="block" className="text-[16px]" /><span className="flex-1">{t.blocked.title} · with {t.blocked.ownerName}</span>
              <button onClick={() => { et((x) => { delete x.blocked; }); notify(`Marked “${t.title}” as unblocked.`); }} className="btn-secondary btn-sm">Unblocked</button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-sm text-muted">Progress</span>
            <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
              {STEPS.map((v) => <button key={v} onClick={() => et((x) => { x.progress = v; })} className={cx("px-2.5 py-1 rounded-md text-label-sm", t.progress === v ? "bg-teal text-white" : "text-muted hover:text-ink")}>{v}%</button>)}
            </div>
            <span className="flex-1" />
            <button onClick={() => em((x) => { x.tasks = x.tasks.filter((y) => y.id !== t.id); })} className="text-body-sm text-muted hover:text-rose-600">Remove task</button>
          </div>
        </div>
      )}
    </li>
  );
}
