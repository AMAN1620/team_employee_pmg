"use client";
// The goals page: the quarter's goals in the middle (goal → milestones → tasks) and the goal agent docked on the
// right, the way an assistant sits beside an editor. The agent sees the goal or milestone that's open, and anything it
// does (tick a task, raise a blocker, add a to-do) shows up straight away. To-dos have their own page (/todos) and
// share this page's storage (lib/demo/store.ts); lib/demo/quarter-goals.ts has the samples people start with.
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Icon, cx } from "@/components/ui";
import { QUARTERS, milestoneStatus, newId, quarterOf, sampleGoals, sampleTodos, taskProgress, type Goal, type Todo } from "@/lib/demo/quarter-goals";
import { chatKey, goalsKey, todosKey, useStored } from "@/lib/demo/store";
import { GoalList, type Mutate } from "./GoalList";
import { AgentPanel, seedThread, type Msg } from "./Agent";
import type { PersonOpt } from "./bits";

/** The goal and milestone to open first: the earliest milestone that's in progress (or past its end) this quarter. */
function firstOpen(goals: Goal[], quarter: string, today: string): { goal?: string; milestone?: string } {
  for (const g of goals.filter((x) => x.quarter === quarter)) {
    const m = g.milestones.find((x) => ["in_progress", "pending"].includes(milestoneStatus(x, today)) && x.end >= today) ?? g.milestones.find((x) => milestoneStatus(x, today) === "in_progress");
    if (m) return { goal: g.id, milestone: m.id };
  }
  return { goal: goals.find((x) => x.quarter === quarter)?.id, milestone: undefined };
}

export function QuarterGoals({ me, manager, people, today, right }: {
  me: { id: string; name: string }; manager: PersonOpt | null; people: PersonOpt[]; today: string; right?: React.ReactNode;
}) {
  const params = useSearchParams();
  const managerFirst = manager?.name.split(" ")[0] ?? "Your manager";
  const [goals, setGoals] = useStored<Goal[]>(goalsKey(me.id), () => sampleGoals(me.id));
  const [todos, setTodos] = useStored<Todo[]>(todosKey(me.id), () => sampleTodos(me.id));
  const [thread, setThread] = useStored<Msg[]>(chatKey(me.id), () => seedThread(me.id, me.name, sampleGoals(me.id), today));
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [prompt, setPrompt] = useState<{ text: string } | null>(null);
  const quarter = QUARTERS.find((q) => q.key === params.get("q")) ?? quarterOf(today);
  const [open, setOpen] = useState(() => firstOpen(sampleGoals(me.id), quarter.key, today));

  useEffect(() => { if (window.innerWidth < 1024) setAgentOpen(false); }, []);

  const mutate: Mutate = (fn) => setGoals((prev) => { const next = structuredClone(prev); fn(next); return next; });
  const pickQuarter = (q: string) => {
    window.history.pushState(null, "", q === quarterOf(today).key ? "/goals" : `/goals?q=${q}`);
    setOpen(firstOpen(goals, q, today));
  };
  const ask = (text: string) => { setAgentOpen(true); setPrompt({ text }); };
  const reset = () => {
    const g = sampleGoals(me.id);
    setGoals(g); setTodos(sampleTodos(me.id)); setThread(seedThread(me.id, me.name, g, today)); setOpen(firstOpen(g, quarter.key, today));
    setNotice("Started over with the sample goals, to-dos and chat.");
  };

  const inQuarter = goals.filter((g) => g.quarter === quarter.key);
  const tasks = inQuarter.flatMap((g) => g.milestones.flatMap((m) => m.tasks));
  const blocked = tasks.filter((t) => t.blocked).length;

  return (
    <>
      <div className={cx("transition-[margin]", agentOpen && "lg:mr-[400px]")}>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">My goals</h1>
            <p className="text-body-md text-muted mt-1">
              {quarter.label} · {inQuarter.length} goal{inQuarter.length === 1 ? "" : "s"}{tasks.length > 0 && ` · ${tasks.filter((t) => taskProgress(t) >= 1).length} of ${tasks.length} tasks done`}
              {blocked > 0 && <span className="text-rose-700"> · {blocked} blocked</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {right}
            <div className="inline-flex rounded-lg border border-line bg-white p-1">
              {QUARTERS.map((q) => <button key={q.key} onClick={() => pickQuarter(q.key)} className={cx("px-3 py-1.5 rounded-md text-label-md", q.key === quarter.key ? "bg-teal text-white" : "text-muted hover:text-ink")}>{q.label}</button>)}
            </div>
            <button onClick={() => setCreating(true)} className="btn-primary"><Icon name="add" className="text-[18px]" />New goal</button>
          </div>
        </div>

        {notice && (
          <div className="mb-5 rounded-xl border border-teal/30 bg-teal-tint/40 p-3.5 text-body-md text-teal flex items-center gap-2">
            <Icon name="check_circle" /><span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} className="text-teal/70 hover:text-teal" aria-label="Dismiss"><Icon name="close" className="text-[18px]" /></button>
          </div>
        )}

        {inQuarter.length ? (
          <GoalList goals={inQuarter} openGoal={open.goal} openMilestone={open.milestone}
            onGoal={(goal) => setOpen({ goal, milestone: undefined })} onMilestone={(milestone) => setOpen((o) => ({ ...o, milestone }))}
            ctx={{ today, manager: managerFirst, mutate, notify: setNotice, ask, openTodos: (id) => todos.filter((d) => d.milestoneId === id && !d.done).length }} />
        ) : (
          <Card className="p-10 text-center">
            <Icon name="flag" className="text-[40px] text-slate-300" />
            <p className="text-title-md mt-2">No goals for {quarter.label} yet</p>
            <p className="text-body-md text-muted mt-1">Add one, or wait for {managerFirst} to set them. AI can break each goal into milestones.</p>
            <button onClick={() => setCreating(true)} className="btn-primary mt-4"><Icon name="add" className="text-[18px]" />New goal</button>
          </Card>
        )}
      </div>

      {agentOpen ? (
        <AgentPanel goals={inQuarter} todos={todos} setTodos={setTodos} thread={thread} setThread={setThread} mutate={mutate} today={today} me={me} manager={manager} people={people}
          focus={open.goal ? { goalId: open.goal, milestoneId: open.milestone } : undefined} prompt={prompt} onPromptTaken={() => setPrompt(null)}
          onClose={() => setAgentOpen(false)} onReset={reset} />
      ) : (
        <button onClick={() => setAgentOpen(true)} className="fixed bottom-6 right-6 z-30 btn-kudos shadow-pop rounded-full h-12 px-5"><Icon name="auto_awesome" className="text-[20px]" />Ask the PMG agent</button>
      )}

      {creating && <NewGoal quarter={quarter} today={today} manager={managerFirst} onClose={() => setCreating(false)}
        onCreate={(g, suggest) => {
          setGoals((all) => [...all, g]); setCreating(false); setOpen({ goal: g.id, milestone: undefined });
          setNotice(`Goal created and sent to ${managerFirst} for approval.`);
          if (suggest) ask("Plan milestones for a goal");
        }} />}
    </>
  );
}

function NewGoal({ quarter, today, manager, onCreate, onClose }: {
  quarter: (typeof QUARTERS)[number]; today: string; manager: string; onCreate: (g: Goal, suggest: boolean) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [start, setStart] = useState(today > quarter.start && today < quarter.end ? today : quarter.start);
  const [end, setEnd] = useState(quarter.end);
  const [suggest, setSuggest] = useState(true);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const ok = title.trim().length > 3 && start <= end;
  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal aria-labelledby="new-goal" className="card w-full max-w-lg shadow-pop" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={(e) => { e.preventDefault(); if (ok) onCreate({ id: newId("g"), quarter: quarter.key, title: title.trim(), why: why.trim(), start, end, source: "self", approval: "waiting", milestones: [] }, suggest); }}>
          <div className="flex items-start justify-between px-6 pt-5">
            <div><h2 id="new-goal" className="section-title">New goal</h2><p className="text-body-sm text-muted">{quarter.label}</p></div>
            <button type="button" onClick={onClose} className="btn-ghost btn-sm px-2" aria-label="Close"><Icon name="close" className="text-[18px]" /></button>
          </div>
          <div className="p-6 space-y-4">
            <label className="block"><span className="label">Goal</span><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Ship cross-chat memory in Simkey" /></label>
            <label className="block"><span className="label">Why it matters (optional)</span><input value={why} onChange={(e) => setWhy(e.target.value)} className="input" placeholder="What's better once it's done" /></label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block"><span className="label">Start</span><input type="date" value={start} min={quarter.start} max={quarter.end} onChange={(e) => setStart(e.target.value)} className="input" /></label>
              <label className="block"><span className="label">End</span><input type="date" value={end} min={start} max={quarter.end} onChange={(e) => setEnd(e.target.value)} className="input" /></label>
            </div>
            <label className="flex items-center gap-2.5 rounded-lg border border-violet/30 bg-violet-tint/30 px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={suggest} onChange={() => setSuggest(!suggest)} className="w-4 h-4 accent-violet" />
              <span className="text-body-md"><Icon name="auto_awesome" className="text-[16px] text-violet align-[-3px] mr-1" />Let the agent suggest milestones and tasks</span>
            </label>
            <p className="text-body-sm text-muted flex gap-1.5"><Icon name="info" className="text-[16px]" />{manager} approves goals you create. You can plan it while you wait.</p>
          </div>
          <div className="px-6 pb-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button disabled={!ok} className="btn-primary"><Icon name="send" className="text-[18px]" />Create and send</button>
          </div>
        </form>
      </div>
    </div>
  );
}
