"use client";
// The to-do list: the person's own checklist, separate from the tasks on their goals and seen only by them. A to-do
// sits in a quarter (this one by default) and can be tagged with one of that quarter's goals and, inside it, a
// milestone. Any to-do can carry a reminder, to yourself or a colleague, sent by PMG chat or Slack. Shares storage
// with the Goals page (lib/demo/store.ts), so tags and the agent's to-dos stay in step.
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, Icon, cx } from "@/components/ui";
import { addDays } from "@/lib/time";
import { QUARTERS, newId, quarterOf, sampleGoals, sampleTodos, type Goal, type Reminder, type Todo } from "@/lib/demo/quarter-goals";
import { goalsKey, todosKey, useStored } from "@/lib/demo/store";
import { sendReminderAction } from "@/app/actions/quarter-goals";
import { ReminderChip, ReminderEditor, type PersonOpt } from "./bits";

type View = "open" | "reminders" | "done";
const clock = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function TodoBoard({ me, people, today }: { me: string; people: PersonOpt[]; today: string }) {
  const params = useSearchParams();
  const [goals] = useStored<Goal[]>(goalsKey(me), () => sampleGoals(me));
  const [todos, setTodos] = useStored<Todo[]>(todosKey(me), () => sampleTodos(me));
  const [quarter, setQuarter] = useState(() => QUARTERS.find((q) => q.key === params.get("q"))?.key ?? quarterOf(today).key);
  const [view, setView] = useState<View>("open");
  const [goalFilter, setGoalFilter] = useState(params.get("goal") ?? "all");
  const [milestoneFilter, setMilestoneFilter] = useState(params.get("milestone") ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(`${today}T09:00`);
  const [fresh, setFresh] = useState<string | null>(null);
  useEffect(() => setNow(`${today}T${clock()}`), [today]);
  useEffect(() => {
    if (!fresh) return;
    document.getElementById(`todo-${fresh}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setFresh(null), 2500);
    return () => clearTimeout(t);
  }, [fresh]);

  const qGoals = goals.filter((g) => g.quarter === quarter);
  const goalOf = (id?: string) => goals.find((g) => g.id === id);
  const milestoneOf = (d: Todo) => goalOf(d.goalId)?.milestones.find((m) => m.id === d.milestoneId);
  const edit = (id: string, fn: (d: Todo) => void) => setTodos((all) => all.map((d) => { if (d.id !== id) return d; const x = { ...d }; fn(x); return x; }));
  const pickQuarter = (q: string) => { setQuarter(q); setGoalFilter("all"); setMilestoneFilter(""); };

  const inQuarter = todos.filter((d) => d.quarter === quarter);
  const matchesGoal = (d: Todo) => (goalFilter === "all" || (goalFilter === "none" ? !d.goalId : d.goalId === goalFilter)) && (!milestoneFilter || d.milestoneId === milestoneFilter);
  const counts = { open: inQuarter.filter((d) => !d.done).length, reminders: inQuarter.filter((d) => !d.done && d.reminder && !d.reminder.sentAt).length, done: inQuarter.filter((d) => d.done).length };
  const shown = inQuarter.filter(matchesGoal).filter((d) => (view === "done" ? d.done : !d.done && (view === "open" || (d.reminder && !d.reminder.sentAt))))
    .sort((a, b) => (view === "reminders" ? (a.reminder?.at ?? "").localeCompare(b.reminder?.at ?? "") : 0));
  // Grouped by goal in the quarter's goal order, untagged ones last.
  const groups = [...qGoals.map((g) => ({ key: g.id, title: g.title, goal: g as Goal | undefined })), { key: "none", title: "Not tagged to a goal", goal: undefined }]
    .map((grp) => ({ ...grp, items: shown.filter((d) => (grp.goal ? d.goalId === grp.goal.id : !d.goalId || !qGoals.some((g) => g.id === d.goalId))) }))
    .filter((grp) => grp.items.length);
  const upcoming = inQuarter.filter((d) => !d.done && d.reminder && !d.reminder.sentAt).sort((a, b) => a.reminder!.at.localeCompare(b.reminder!.at));
  const filterMilestone = goalOf(goalFilter)?.milestones.find((m) => m.id === milestoneFilter);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">My to-dos</h1>
          <p className="text-body-md text-muted mt-1 flex items-center gap-1"><Icon name="lock" className="text-[16px]" />Your own list, separate from your goal tasks. Only you see it.</p>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-white p-1">
          {QUARTERS.map((q) => <button key={q.key} onClick={() => pickQuarter(q.key)} className={cx("px-3 py-1.5 rounded-md text-label-md", q.key === quarter ? "bg-teal text-white" : "text-muted hover:text-ink")}>{q.label}</button>)}
        </div>
      </div>

      {notice && (
        <div className="mb-5 rounded-xl border border-teal/30 bg-teal-tint/40 p-3.5 text-body-md text-teal flex items-center gap-2">
          <Icon name="check_circle" /><span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-teal/70 hover:text-teal" aria-label="Dismiss"><Icon name="close" className="text-[18px]" /></button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 xl:col-span-8 space-y-4">
          <AddTodo key={`${quarter}:${goalFilter}:${milestoneFilter}`} quarter={quarter} goals={qGoals} people={people} me={me} today={today}
            initialGoal={goalFilter !== "all" && goalFilter !== "none" ? goalFilter : ""} initialMilestone={milestoneFilter}
            onAdd={(d) => {
              setTodos((all) => [d, ...all]); setView("open"); setFresh(d.id);
              // Don't let a goal or milestone filter hide what was just added.
              const hidden = (goalFilter !== "all" && (goalFilter === "none" ? !!d.goalId : d.goalId !== goalFilter)) || (!!milestoneFilter && d.milestoneId !== milestoneFilter);
              if (hidden) { setGoalFilter("all"); setMilestoneFilter(""); }
              setNotice(`${d.reminder ? `Added, with a reminder for ${d.reminder.toId === "self" ? "you" : d.reminder.toName.split(" ")[0]}` : "Added to your to-dos"}${hidden ? ". Filters cleared so you can see it" : ""}.`);
            }} />

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-line bg-white p-1">
              {([["open", "Open"], ["reminders", "With reminders"], ["done", "Done"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setView(k)} className={cx("px-3 py-1.5 rounded-md text-label-md inline-flex items-center gap-1.5", view === k ? "bg-ink text-white" : "text-muted hover:text-ink")}>
                  {label}<span className={cx("text-pill-tag rounded-full px-1.5", view === k ? "bg-white/20" : "bg-slate-100")}>{counts[k]}</span>
                </button>
              ))}
            </div>
            <select value={goalFilter} onChange={(e) => { setGoalFilter(e.target.value); setMilestoneFilter(""); }} className="input h-10 w-auto max-w-xs" aria-label="Filter by goal">
              <option value="all">All goals</option>
              {qGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              <option value="none">Not tagged to a goal</option>
            </select>
            {filterMilestone && (
              <span className="inline-flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full bg-violet-tint text-violet text-label-sm">
                <Icon name="flag" className="text-[14px]" />{filterMilestone.title}
                <button onClick={() => setMilestoneFilter("")} className="p-0.5 rounded-full hover:bg-violet/10" aria-label="Clear milestone filter"><Icon name="close" className="text-[14px]" /></button>
              </span>
            )}
          </div>

          {!groups.length && (
            <Card className="p-10 text-center">
              <Icon name="checklist" className="text-[40px] text-slate-300" />
              <p className="text-title-md mt-2">{view === "done" ? "Nothing ticked off yet" : view === "reminders" ? "No reminders set" : "Nothing to do here"}</p>
              <p className="text-body-md text-muted mt-1">Add a to-do above and tag it with a goal or milestone if it helps one along.</p>
            </Card>
          )}
          {groups.map((grp) => (
            <Card key={grp.key} className="overflow-hidden">
              <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3 bg-canvas/50">
                <p className="text-title-md flex items-center gap-2 min-w-0"><Icon name={grp.goal ? "flag" : "label_off"} className={cx("text-[18px]", grp.goal ? "text-teal" : "text-muted")} /><span className="truncate">{grp.title}</span></p>
                <span className="text-body-sm text-muted shrink-0">{grp.items.length}</span>
              </div>
              <ul className="divide-y divide-line">
                {grp.items.map((d) => (
                  <TodoRow key={d.id} d={d} fresh={fresh === d.id} goals={qGoals} milestone={milestoneOf(d)} people={people} me={me} today={today} now={now}
                    onEdit={(fn) => edit(d.id, fn)} onDelete={() => setTodos((all) => all.filter((x) => x.id !== d.id))} notify={setNotice} />
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <aside className="col-span-12 xl:col-span-4 space-y-4">
          <Card className="p-5">
            <p className="text-title-md flex items-center gap-2"><Icon name="notifications" className="text-[20px] text-violet" />Coming up</p>
            {!upcoming.length ? <p className="text-body-md text-muted mt-2">No reminders set. Add one from any to-do.</p> : (
              <ul className="mt-3 space-y-3">
                {upcoming.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <p className="text-body-md">{d.text}</p>
                    <p className="text-body-sm text-muted truncate">{milestoneOf(d)?.title ?? goalOf(d.goalId)?.title ?? "Not tagged"}</p>
                    <div className="mt-1"><ReminderChip r={d.reminder!} now={now} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-title-md mb-3">By goal</p>
            <ul className="space-y-2">
              {qGoals.map((g) => {
                const open = inQuarter.filter((d) => d.goalId === g.id && !d.done).length;
                return (
                  <li key={g.id}>
                    <button onClick={() => { setGoalFilter(g.id); setMilestoneFilter(""); setView("open"); }} className={cx("w-full text-left rounded-lg px-3 py-2 flex items-center justify-between gap-3 hover:bg-canvas", goalFilter === g.id && "bg-teal-tint/40")}>
                      <span className="text-body-md truncate">{g.title}</span><span className="text-label-sm text-muted shrink-0">{open} open</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link href="/goals" className="text-body-sm text-teal hover:underline inline-flex items-center gap-1 mt-3">Open your goals<Icon name="arrow_forward" className="text-[16px]" /></Link>
          </Card>
          <button onClick={() => { setTodos(sampleTodos(me)); setNotice("Started over with the sample to-dos."); }} className="text-body-sm text-muted hover:text-ink inline-flex items-center gap-1"><Icon name="restart_alt" className="text-[16px]" />Start over with the sample to-dos</button>
        </aside>
      </div>
    </div>
  );
}

/** Goal and milestone pickers, limited to the quarter's goals; the milestone list follows the goal chosen. */
function TagPickers({ goals, goalId, milestoneId, onChange }: { goals: Goal[]; goalId: string; milestoneId: string; onChange: (goalId: string, milestoneId: string) => void }) {
  const g = goals.find((x) => x.id === goalId);
  return (
    <>
      <select value={goalId} onChange={(e) => onChange(e.target.value, "")} className="input h-9 w-auto max-w-[240px]" aria-label="Goal">
        <option value="">No goal</option>
        {goals.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
      </select>
      <select value={milestoneId} onChange={(e) => onChange(goalId, e.target.value)} disabled={!g || !g.milestones.length} className="input h-9 w-auto max-w-[240px] disabled:opacity-50" aria-label="Milestone">
        <option value="">{g ? (g.milestones.length ? "Whole goal" : "No milestones yet") : "Pick a goal first"}</option>
        {g?.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
    </>
  );
}

function AddTodo({ quarter, goals, people, me, today, initialGoal, initialMilestone, onAdd }: {
  quarter: string; goals: Goal[]; people: PersonOpt[]; me: string; today: string; initialGoal: string; initialMilestone: string; onAdd: (d: Todo) => void;
}) {
  const [text, setText] = useState("");
  const [goalId, setGoalId] = useState(goals.some((g) => g.id === initialGoal) ? initialGoal : "");
  const [milestoneId, setMilestoneId] = useState(initialMilestone);
  const [remind, setRemind] = useState(false);
  const [toId, setToId] = useState("self");
  const [at, setAt] = useState(`${addDays(today, 1)}T10:00`);
  const [via, setVia] = useState<Reminder["via"]>("chat");
  const submit = () => {
    const v = text.trim(); if (!v) return;
    onAdd({ id: newId("d"), text: v, done: false, quarter, goalId: goalId || undefined, milestoneId: milestoneId || undefined,
      reminder: remind ? { at, via, toId, toName: toId === "self" ? "You" : people.find((p) => p.id === toId)?.name ?? toId } : undefined });
    setText(""); setRemind(false);
  };
  return (
    <Card className="p-4 space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} className="input" placeholder="Add a to-do, e.g. Ask Kanav for staging access" aria-label="New to-do" />
        <button disabled={!text.trim()} className="btn-primary"><Icon name="add" className="text-[18px]" />Add</button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label-sm text-muted inline-flex items-center gap-1"><Icon name="sell" className="text-[16px]" />Tag</span>
        <TagPickers goals={goals} goalId={goalId} milestoneId={milestoneId} onChange={(g, m) => { setGoalId(g); setMilestoneId(m); }} />
        <button type="button" onClick={() => setRemind(!remind)} className={cx("btn-sm btn", remind ? "bg-violet text-white" : "btn-secondary")}><Icon name={remind ? "notifications_active" : "notification_add"} className="text-[16px]" />Reminder</button>
      </div>
      {remind && (
        <div className="rounded-lg border border-violet/30 bg-violet-tint/30 p-3 flex flex-wrap items-end gap-2">
          <label className="block"><span className="block text-label-sm text-muted mb-1">Remind</span>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className="input h-9 w-auto max-w-[240px]">
              <option value="self">Me</option>
              {people.filter((p) => p.id !== me).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <label className="block"><span className="block text-label-sm text-muted mb-1">When</span><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="input h-9" /></label>
          <div className="inline-flex rounded-lg border border-line bg-white p-0.5 h-9 items-center">
            {(["chat", "slack"] as const).map((v) => <button key={v} type="button" onClick={() => setVia(v)} className={cx("px-2.5 py-1 rounded-md text-label-sm", via === v ? "bg-violet text-white" : "text-muted")}>{v === "chat" ? "PMG chat" : "Slack"}</button>)}
          </div>
        </div>
      )}
    </Card>
  );
}

function TodoRow({ d, fresh, goals, milestone, people, me, today, now, onEdit, onDelete, notify }: {
  d: Todo; fresh: boolean; goals: Goal[]; milestone?: Goal["milestones"][number]; people: PersonOpt[]; me: string; today: string; now: string;
  onEdit: (fn: (d: Todo) => void) => void; onDelete: () => void; notify: (t: string) => void;
}) {
  const [tagging, setTagging] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [, startSending] = useTransition();
  const goal = goals.find((g) => g.id === d.goalId);
  const sendNow = (r: Reminder) => startSending(async () => {
    const res = await sendReminderAction({ toId: r.toId === "self" ? me : r.toId, todo: d.text, task: milestone?.title ?? goal?.title ?? "your to-do list", goal: goal?.title ?? "no goal" });
    onEdit((x) => { x.reminder = { ...r, sentAt: now }; });
    setReminding(false);
    notify(res.ok ? `Reminder sent to ${r.toId === "self" ? "your" : `${r.toName.split(" ")[0]}'s`} PMG chat${r.via === "slack" ? " (and Slack, when it's connected)" : ""}.` : "Couldn't send that reminder.");
  });
  return (
    <li id={`todo-${d.id}`} className={cx("group px-5 py-3 transition-colors duration-700", fresh && "bg-teal-tint/50")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <input type="checkbox" checked={d.done} onChange={() => onEdit((x) => { x.done = !x.done; })} className="w-[18px] h-[18px] accent-teal" aria-label={d.text} />
        <span className={cx("text-body-md flex-1 min-w-48", d.done && "text-muted line-through decoration-slate-300")}>{d.text}</span>
        {milestone && <span className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-violet-tint text-violet max-w-[220px]"><Icon name="flag" className="text-[13px]" /><span className="truncate">{milestone.title}</span></span>}
        {d.reminder && <button onClick={() => setReminding(!reminding)}><ReminderChip r={d.reminder} now={now} /></button>}
        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
          {!d.reminder && !d.done && <button onClick={() => setReminding(!reminding)} className="btn-ghost btn-sm px-1.5" title="Set a reminder" aria-label={`Set a reminder for ${d.text}`}><Icon name="notification_add" className="text-[18px]" /></button>}
          <button onClick={() => setTagging(!tagging)} className="btn-ghost btn-sm px-1.5" title="Tag with a goal or milestone" aria-label={`Tag ${d.text}`}><Icon name="sell" className="text-[18px]" /></button>
          <button onClick={onDelete} className="btn-ghost btn-sm px-1.5 hover:text-rose-600" title="Delete" aria-label={`Delete ${d.text}`}><Icon name="close" className="text-[18px]" /></button>
        </div>
      </div>
      {tagging && (
        <div className="mt-2 ml-[30px] flex flex-wrap items-center gap-2">
          <TagPickers goals={goals} goalId={d.goalId ?? ""} milestoneId={d.milestoneId ?? ""} onChange={(g, m) => onEdit((x) => { x.goalId = g || undefined; x.milestoneId = m || undefined; })} />
          <button onClick={() => setTagging(false)} className="btn-secondary btn-sm">Done</button>
        </div>
      )}
      {reminding && (
        <div className="ml-[30px]">
          <ReminderEditor initial={d.reminder} people={people} me={me} defaultAt={`${addDays(today, 1)}T10:00`}
            onClose={() => setReminding(false)} onRemove={() => { onEdit((x) => { delete x.reminder; }); setReminding(false); }}
            onSave={(r) => { onEdit((x) => { x.reminder = r; }); setReminding(false); notify(`Reminder set for ${r.toId === "self" ? "you" : r.toName.split(" ")[0]}.`); }}
            onSendNow={sendNow} />
        </div>
      )}
    </li>
  );
}
