"use client";
// Demo of the quarter view for goals: each quarter has milestones set by the manager, each milestone has tasks with
// their own dates. The overview shows a quarter timeline, what's being worked on now (milestones in progress or
// late, with their active tasks) and every milestone; opening one shows all its tasks. A blocker raised from a card
// can cover several of that milestone's tasks. Everything is in memory: a refresh puts the demo data back.
import { useEffect, useState } from "react";
import { Card, Icon, Pill, ProgressBar, cx, fmtDate } from "@/components/ui";
import { addDays, daysBetween } from "@/lib/time";
import { HELPERS, QUARTERS, SEED_BLOCKERS, type DemoBlocker, type DemoMilestone, type DemoTask, type MsStatus } from "@/lib/demo/priya-milestones";

const STATUS: Record<MsStatus, { label: string; tone: "slate" | "teal" | "amber" | "green"; icon: string; bar: string; dot: string }> = {
  yet_to_start: { label: "Yet to start", tone: "slate", icon: "event_upcoming", bar: "bg-slate-300", dot: "border-slate-300" },
  in_progress: { label: "In progress", tone: "teal", icon: "play_circle", bar: "bg-teal", dot: "border-teal bg-teal-tint" },
  pending: { label: "Pending", tone: "amber", icon: "schedule", bar: "bg-amber-500", dot: "border-amber-500 bg-amber-100" },
  done: { label: "Done", tone: "green", icon: "check_circle", bar: "bg-emerald-500", dot: "border-emerald-500 bg-emerald-500" },
};
const ORDER: MsStatus[] = ["yet_to_start", "in_progress", "pending", "done"];

/** A task that's past its end date and not done counts as pending, whatever it was set to. */
const taskStatus = (t: DemoTask, today: string): MsStatus => (t.status !== "done" && t.end < today ? "pending" : t.status);
function milestoneStatus(m: DemoMilestone, today: string): MsStatus {
  const s = m.tasks.map((t) => taskStatus(t, today));
  if (s.every((x) => x === "done")) return "done";
  if (s.includes("pending") || m.end < today) return "pending";
  if (s.some((x) => x === "in_progress" || x === "done")) return "in_progress";
  return "yet_to_start";
}
const doneCount = (m: DemoMilestone) => m.tasks.filter((t) => t.status === "done").length;
const helperName = (id: string) => HELPERS.find((h) => h.id === id)?.name ?? id;
const first = (name: string) => name.split(" ")[0];
const range = (a: string, b: string) => `${fmtDate(a)} – ${fmtDate(b)}`;

export function MilestoneBoard({ today, owner, right }: { today: string; owner: string; right?: React.ReactNode }) {
  const current = QUARTERS.find((q) => q.start <= today && today <= q.end) ?? QUARTERS[1];
  const [quarterKey, setQuarterKey] = useState(current.key);
  const [openId, setOpenId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState(() => QUARTERS.flatMap((q) => q.milestones));
  const [blockers, setBlockers] = useState<DemoBlocker[]>(SEED_BLOCKERS);
  const [raising, setRaising] = useState<{ milestoneId: string; taskIds: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const quarter = QUARTERS.find((q) => q.key === quarterKey)!;
  const ms = milestones.filter((m) => quarter.milestones.some((x) => x.id === m.id));
  const open = blockers.filter((b) => !b.resolved);
  const blockedTasks = new Set(open.flatMap((b) => b.taskIds));
  const opened = ms.find((m) => m.id === openId);

  const setTaskStatus = (taskId: string, status: MsStatus) =>
    setMilestones((all) => all.map((m) => ({ ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) })));
  const raise = (b: Omit<DemoBlocker, "id" | "raisedOn" | "resolved">) => {
    setBlockers((all) => [...all, { ...b, id: `b${all.length + 1}`, raisedOn: today, resolved: false }]);
    setRaising(null);
    setNotice(`Blocker sent to ${first(helperName(b.owner))} in chat. ${b.taskIds.length} task${b.taskIds.length === 1 ? " is" : "s are"} marked blocked until it's resolved.`);
  };
  const resolve = (id: string) => setBlockers((all) => all.map((b) => (b.id === id ? { ...b, resolved: true } : b)));
  const go = (id: string | null) => { setOpenId(id); setNotice(null); window.scrollTo({ top: 0 }); };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap"><h1 className="page-title">My goals</h1><Pill tone="violet" icon="science">Demo</Pill></div>
          <p className="text-body-md text-muted mt-1">Milestones {first(ms[0]?.setBy ?? "Your manager")} set for {owner} this quarter. Each one has its tasks and dates decided.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        {right}
        <div className="inline-flex rounded-lg border border-line bg-white p-1">
          {QUARTERS.map((q) => (
            <button key={q.key} onClick={() => { setQuarterKey(q.key); go(null); }}
              className={cx("px-3 py-1.5 rounded-md text-label-md inline-flex items-center gap-1.5", q.key === quarterKey ? "bg-teal text-white" : "text-muted hover:text-ink")}>
              {q.label}{q.key === current.key && <span className={cx("w-1.5 h-1.5 rounded-full", q.key === quarterKey ? "bg-white" : "bg-teal")} />}
            </button>
          ))}
        </div>
        </div>
      </div>

      {notice && (
        <div className="mb-6 rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal flex items-center gap-2">
          <Icon name="check_circle" /><span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-teal/70 hover:text-teal" aria-label="Dismiss"><Icon name="close" className="text-[18px]" /></button>
        </div>
      )}

      {!ms.length ? (
        <Card className="p-10 text-center">
          <Icon name="flag" className="text-[40px] text-slate-300" />
          <p className="text-title-md mt-2">No milestones for {quarter.label} yet</p>
          <p className="text-body-md text-muted mt-1">{quarter.key > current.key ? "Your manager sets them at the start of the quarter." : "Nothing was set for this quarter."}</p>
        </Card>
      ) : opened ? (
        <MilestoneDetail m={opened} today={today} quarterLabel={quarter.label} blockers={blockers.filter((b) => b.milestoneId === opened.id)}
          blockedTasks={blockedTasks} onBack={() => go(null)} onRaise={(taskIds) => setRaising({ milestoneId: opened.id, taskIds })}
          onStatus={setTaskStatus} onResolve={resolve} />
      ) : (
        <Overview ms={ms} today={today} quarter={quarter} blockedTasks={blockedTasks} openBlockers={open.filter((b) => ms.some((m) => m.id === b.milestoneId)).length}
          onOpen={go} onRaise={(milestoneId, taskIds) => setRaising({ milestoneId, taskIds })} />
      )}

      {raising && <RaiseBlocker m={milestones.find((m) => m.id === raising.milestoneId)!} today={today} preselected={raising.taskIds}
        blockedTasks={blockedTasks} onClose={() => setRaising(null)} onSend={raise} />}
    </div>
  );
}

function Overview({ ms, today, quarter, blockedTasks, openBlockers, onOpen, onRaise }: {
  ms: DemoMilestone[]; today: string; quarter: { label: string; start: string; end: string }; blockedTasks: Set<string>; openBlockers: number;
  onOpen: (id: string) => void; onRaise: (milestoneId: string, taskIds: string[]) => void;
}) {
  const statuses = ms.map((m) => milestoneStatus(m, today));
  const tasks = ms.flatMap((m) => m.tasks);
  const active = ms.filter((_, i) => statuses[i] === "in_progress" || statuses[i] === "pending");
  const count = (s: MsStatus) => statuses.filter((x) => x === s).length;

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-6">
          <Stat label="Milestones" value={ms.length} />
          <Stat label="Tasks done" value={`${tasks.filter((t) => t.status === "done").length}/${tasks.length}`} />
          <Stat label="In progress" value={count("in_progress")} tone="text-teal" />
          <Stat label="Pending" value={count("pending")} tone="text-amber-700" />
          <Stat label="Yet to start" value={count("yet_to_start")} tone="text-slate-500" />
          <Stat label="Open blockers" value={openBlockers} tone={openBlockers ? "text-rose-700" : undefined} />
        </div>
        <Timeline start={quarter.start} end={quarter.end} today={today}
          rows={ms.map((m, i) => ({ id: m.id, label: `${m.code} · ${m.title}`, start: m.start, end: m.end, status: statuses[i], progress: doneCount(m) / m.tasks.length }))}
          onClick={onOpen} />
      </Card>

      {active.length > 0 && (
        <section>
          <h2 className="section-title mb-1">Working on now</h2>
          <p className="text-body-sm text-muted mb-4">Tasks from milestones that are in progress or running late. Raise a blocker on a card to flag one or more of its tasks.</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {active.map((m) => {
              const status = milestoneStatus(m, today);
              const now = m.tasks.filter((t) => ["in_progress", "pending"].includes(taskStatus(t, today)));
              const next = m.tasks.find((t) => taskStatus(t, today) === "yet_to_start");
              const late = status === "pending" && m.end < today ? daysBetween(m.end, today) : 0;
              return (
                <Card key={m.id} className={cx("p-5 flex flex-col", status === "pending" && "border-l-[3px] border-l-amber-500")}>
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => onOpen(m.id)} className="text-left min-w-0 group">
                      <p className="text-label-sm text-muted">{m.code} · {range(m.start, m.end)}</p>
                      <p className="text-title-md group-hover:text-teal">{m.title}</p>
                    </button>
                    <StatusPill s={status} extra={late ? `${late}d late` : undefined} />
                  </div>
                  <ul className="mt-3 divide-y divide-line flex-1">
                    {now.map((t) => <TaskRow key={t.id} t={t} today={today} blocked={blockedTasks.has(t.id)} onFlag={() => onRaise(m.id, [t.id])} />)}
                    {next && <TaskRow t={next} today={today} blocked={blockedTasks.has(next.id)} upNext onFlag={() => onRaise(m.id, [next.id])} />}
                  </ul>
                  <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-line">
                    <ProgressBar value={(doneCount(m) / m.tasks.length) * 100} tone={status === "pending" ? "amber" : "teal"} className="flex-1 min-w-24" />
                    <span className="text-body-sm text-muted">{doneCount(m)}/{m.tasks.length} done</span>
                    <button onClick={() => onOpen(m.id)} className="btn-ghost btn-sm">All tasks <Icon name="arrow_forward" className="text-[16px]" /></button>
                    <button onClick={() => onRaise(m.id, [])} className="btn-secondary btn-sm"><Icon name="report" className="text-[16px]" />Raise blocker</button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-4">All milestones · {quarter.label}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {ms.map((m, i) => {
            const blocked = m.tasks.filter((t) => blockedTasks.has(t.id)).length;
            return (
              <button key={m.id} onClick={() => onOpen(m.id)} className="card card-hover p-5 text-left flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label-sm text-muted">{m.code}</span><StatusPill s={statuses[i]} />
                </div>
                <p className="text-title-md mt-2">{m.title}</p>
                <p className="text-body-sm text-muted mt-1 line-clamp-2 flex-1">{m.why}</p>
                <ProgressBar value={(doneCount(m) / m.tasks.length) * 100} tone={statuses[i] === "pending" ? "amber" : "teal"} className="mt-4" />
                <div className="flex items-center justify-between mt-2 text-body-sm text-muted">
                  <span>{doneCount(m)}/{m.tasks.length} tasks · {range(m.start, m.end)}</span>
                  {blocked > 0 && <span className="text-rose-700 inline-flex items-center gap-0.5"><Icon name="block" className="text-[14px]" />{blocked}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function MilestoneDetail({ m, today, quarterLabel, blockers, blockedTasks, onBack, onRaise, onStatus, onResolve }: {
  m: DemoMilestone; today: string; quarterLabel: string; blockers: DemoBlocker[]; blockedTasks: Set<string>;
  onBack: () => void; onRaise: (taskIds: string[]) => void; onStatus: (taskId: string, s: MsStatus) => void; onResolve: (id: string) => void;
}) {
  const status = milestoneStatus(m, today);
  const left = daysBetween(today, m.end);
  const when = status === "done" ? "Finished" : left < 0 ? `${-left} days past the end date` : today < m.start ? `Starts in ${daysBetween(today, m.start)} days` : `${left} days left`;
  const taskTitle = (id: string) => m.tasks.find((t) => t.id === id)?.title ?? id;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-label-md text-teal hover:underline inline-flex items-center gap-1"><Icon name="arrow_back" className="text-[16px]" />{quarterLabel} milestones</button>
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap"><span className="text-label-sm text-muted">{m.code}</span><StatusPill s={status} /></div>
            <h2 className="text-headline-md mt-1">{m.title}</h2>
            <p className="text-body-md text-muted mt-1">{m.why}</p>
            <p className="text-body-sm text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1"><Icon name="person" className="text-[16px]" />Set by {m.setBy}</span>
              <span className="inline-flex items-center gap-1"><Icon name="date_range" className="text-[16px]" />{range(m.start, m.end)}</span>
              <span className={cx("inline-flex items-center gap-1", left < 0 && status !== "done" && "text-amber-700")}><Icon name="hourglass_top" className="text-[16px]" />{when}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-headline-md">{doneCount(m)}/{m.tasks.length}</div>
            <div className="text-body-sm text-muted">tasks done</div>
            <button onClick={() => onRaise([])} className="btn-secondary btn-sm mt-3"><Icon name="report" className="text-[16px]" />Raise blocker</button>
          </div>
        </div>
        <ProgressBar value={(doneCount(m) / m.tasks.length) * 100} tone={status === "pending" ? "amber" : "teal"} className="mt-5" />
      </Card>

      <Card className="overflow-hidden">
        <div className="px-6 pt-5 pb-3"><h3 className="section-title">Tasks</h3></div>
        <div className="hidden md:grid grid-cols-[1fr_90px_90px_160px_40px] gap-3 px-6 py-2 bg-canvas text-label-sm text-muted uppercase tracking-wide border-y border-line">
          <span>Task</span><span>Start</span><span>End</span><span>Status</span><span />
        </div>
        <ul className="divide-y divide-line">
          {m.tasks.map((t) => {
            const s = taskStatus(t, today);
            const blocked = blockedTasks.has(t.id);
            return (
              <li key={t.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_90px_90px_160px_40px] gap-x-3 gap-y-2 items-center px-6 py-3">
                <div className="min-w-0 col-span-2 md:col-span-1">
                  <p className={cx("text-body-md", t.status === "done" && "text-muted line-through decoration-slate-300")}>{t.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {blocked && <Pill tone="red" icon="block" className="h-5">Blocked</Pill>}
                    {s === "pending" && t.status !== "pending" && <span className="text-body-sm text-amber-700">Past its end date</span>}
                    {t.note && <span className="text-body-sm text-muted">{t.note}</span>}
                    <span className="md:hidden text-body-sm text-muted">{range(t.start, t.end)}</span>
                  </div>
                </div>
                <span className="hidden md:block text-body-sm">{fmtDate(t.start)}</span>
                <span className={cx("hidden md:block text-body-sm", s === "pending" && "text-amber-700 font-medium")}>{fmtDate(t.end)}</span>
                <select value={t.status} onChange={(e) => onStatus(t.id, e.target.value as MsStatus)} aria-label={`Status of ${t.title}`}
                  className={cx("input h-8 text-label-sm py-0", s === "pending" && "border-amber-300 bg-amber-50", s === "in_progress" && "border-teal/40 bg-teal-tint/30", s === "done" && "border-emerald-200 bg-emerald-50")}>
                  {ORDER.map((o) => <option key={o} value={o}>{STATUS[o].label}</option>)}
                </select>
                <button onClick={() => onRaise([t.id])} disabled={t.status === "done"} title="Raise a blocker on this task" aria-label={`Raise a blocker on ${t.title}`}
                  className="btn-ghost btn-sm px-2 hidden md:inline-flex"><Icon name="report" className="text-[18px]" /></button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-6">
        <h3 className="section-title mb-4">Timeline</h3>
        <Timeline start={addDays(m.start, -2)} end={addDays(m.end, 2)} today={today} compact
          rows={m.tasks.map((t) => ({ id: t.id, label: t.title, start: t.start, end: t.end, status: taskStatus(t, today), blocked: blockedTasks.has(t.id),
            // A task in progress fills up to today, so the bar shows how much of its window has gone.
            progress: t.status === "done" ? 1 : Math.max(0, Math.min(1, (daysBetween(t.start, today) + 1) / (daysBetween(t.start, t.end) + 1))) }))} />
      </Card>

      <Card className="p-6">
        <h3 className="section-title mb-4">Blockers on this milestone</h3>
        {!blockers.length ? <p className="text-body-md text-muted">Nothing raised.</p> : (
          <ul className="space-y-3">
            {blockers.map((b) => (
              <li key={b.id} className={cx("rounded-xl border p-4", b.resolved ? "border-line bg-canvas" : "border-rose-200 bg-rose-50/40")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-title-md">{b.title}</p>
                    <p className="text-body-sm text-muted">With {helperName(b.owner)} · raised {fmtDate(b.raisedOn)} · need by {fmtDate(b.needBy)}</p>
                  </div>
                  {b.resolved ? <Pill tone="green" icon="check_circle">Resolved</Pill>
                    : <button onClick={() => onResolve(b.id)} className="btn-secondary btn-sm"><Icon name="check" className="text-[16px]" />Mark resolved</button>}
                </div>
                {b.details && <p className="text-body-md mt-2">{b.details}</p>}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {b.taskIds.map((id) => <span key={id} className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-white border border-line text-label-sm"><Icon name="task_alt" className="text-[14px]" />{taskTitle(id)}</span>)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function RaiseBlocker({ m, today, preselected, blockedTasks, onClose, onSend }: {
  m: DemoMilestone; today: string; preselected: string[]; blockedTasks: Set<string>;
  onClose: () => void; onSend: (b: Omit<DemoBlocker, "id" | "raisedOn" | "resolved">) => void;
}) {
  const [taskIds, setTaskIds] = useState(preselected);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(HELPERS[0].id);
  const [needBy, setNeedBy] = useState(addDays(today, 2));
  const [details, setDetails] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choices = m.tasks.filter((t) => t.status !== "done");
  const toggle = (id: string) => setTaskIds(taskIds.includes(id) ? taskIds.filter((x) => x !== id) : [...taskIds, id]);
  const ready = taskIds.length > 0 && title.trim().length > 2;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal aria-labelledby="raise-title" className="card w-full max-w-xl shadow-pop my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div>
            <h2 id="raise-title" className="section-title">Raise a blocker</h2>
            <p className="text-body-sm text-muted">{m.code} · {m.title}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm px-2" aria-label="Close"><Icon name="close" className="text-[18px]" /></button>
        </div>
        <form className="p-6 space-y-5" onSubmit={(e) => { e.preventDefault(); if (ready) onSend({ milestoneId: m.id, taskIds, title: title.trim(), owner, needBy, details: details.trim() }); }}>
          <fieldset>
            <legend className="label">Which tasks are blocked?</legend>
            <ul className="rounded-lg border border-line divide-y divide-line">
              {choices.map((t) => {
                const s = taskStatus(t, today);
                return (
                  <li key={t.id}>
                    <label className={cx("flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-canvas", taskIds.includes(t.id) && "bg-teal-tint/30")}>
                      <input type="checkbox" checked={taskIds.includes(t.id)} onChange={() => toggle(t.id)} className="w-4 h-4 accent-teal" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-body-md">{t.title}</span>
                        <span className="block text-body-sm text-muted">{range(t.start, t.end)}{blockedTasks.has(t.id) && " · already has an open blocker"}</span>
                      </span>
                      <StatusPill s={s} />
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-body-sm text-muted mt-1.5">{taskIds.length ? `${taskIds.length} selected` : "Pick at least one."}</p>
          </fieldset>
          <label className="block"><span className="label">What&apos;s stuck?</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Payment sandbox keys not issued yet" autoFocus /></label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block"><span className="label">Who can unblock it?</span>
              <select value={owner} onChange={(e) => setOwner(e.target.value)} className="input">
                {HELPERS.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.title}</option>)}
              </select></label>
            <label className="block"><span className="label">Need it by</span>
              <input type="date" value={needBy} min={today} onChange={(e) => setNeedBy(e.target.value)} className="input" /></label>
          </div>
          <label className="block"><span className="label">Details (optional)</span>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="textarea" placeholder="What you've tried, what you need" /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-body-sm text-muted inline-flex items-center gap-1"><Icon name="chat" className="text-[16px]" />{first(helperName(owner))} gets this in chat.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button disabled={!ready} className="btn-primary"><Icon name="send" className="text-[18px]" />Send blocker</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

type Row = { id: string; label: string; start: string; end: string; status: MsStatus; progress: number; blocked?: boolean };
/** Bars on a date axis with month marks and a line for today. Rows are clickable when onClick is given. */
function Timeline({ start, end, today, rows, onClick, compact }: { start: string; end: string; today: string; rows: Row[]; onClick?: (id: string) => void; compact?: boolean }) {
  const span = daysBetween(start, end) + 1;
  const pct = (d: string) => Math.max(0, Math.min(100, (daysBetween(start, d) / span) * 100));
  const months: string[] = [];
  for (let d = `${start.slice(0, 7)}-01`; d <= end; d = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 1)).toISOString().slice(0, 10)) months.push(d);
  const showToday = today >= start && today <= end;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[minmax(160px,220px)_1fr] gap-3">
          <span />
          <div className="relative h-5 text-label-sm text-muted">
            {months.map((d) => <span key={d} className="absolute top-0 pl-1 border-l border-line h-full" style={{ left: `${pct(d < start ? start : d)}%` }}>{fmtDate(d, { month: "short" })}</span>)}
            {showToday && <span className="absolute -top-0.5 -translate-x-1/2 text-[10px] font-semibold text-rose-600 bg-white px-1" style={{ left: `${pct(today)}%` }}>Today</span>}
          </div>
        </div>
        {rows.map((r) => {
          const Label = onClick ? "button" : "span";
          return (
            <div key={r.id} className="grid grid-cols-[minmax(160px,220px)_1fr] gap-3 items-center">
              <Label {...(onClick ? { onClick: () => onClick(r.id) } : {})} className={cx("text-left truncate text-body-sm py-2", onClick && "hover:text-teal")} title={r.label}>{r.label}</Label>
              <div className={cx("relative", compact ? "h-6" : "h-8")}>
                {months.map((d) => <span key={d} className="absolute inset-y-0 border-l border-line/70" style={{ left: `${pct(d < start ? start : d)}%` }} />)}
                {showToday && <span className="absolute inset-y-0 border-l-2 border-rose-400 z-10" style={{ left: `${pct(today)}%` }} />}
                <Label {...(onClick ? { onClick: () => onClick(r.id) } : {})} title={`${r.label} · ${range(r.start, r.end)} · ${STATUS[r.status].label}`}
                  className={cx("absolute top-1/2 -translate-y-1/2 rounded-md overflow-hidden bg-slate-100 border", compact ? "h-4" : "h-6",
                    r.blocked ? "border-rose-400 border-dashed" : "border-transparent", onClick && "hover:ring-2 hover:ring-teal/30")}
                  style={{ left: `${pct(r.start)}%`, width: `${Math.max(1.5, pct(addDays(r.end, 1)) - pct(r.start))}%` }}>
                  <span className={cx("block h-full", STATUS[r.status].bar, r.status === "yet_to_start" && "opacity-60")}
                    style={{ width: `${r.status === "yet_to_start" ? 100 : r.status === "done" ? 100 : Math.max(8, r.progress * 100)}%` }} />
                </Label>
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-4 mt-3 text-body-sm text-muted">
          {ORDER.map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className={cx("w-3 h-3 rounded-sm", STATUS[s].bar)} />{STATUS[s].label}</span>)}
          {rows.some((r) => r.blocked) && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-dashed border-rose-400" />Blocked</span>}
        </div>
      </div>
    </div>
  );
}

function TaskRow({ t, today, blocked, upNext, onFlag }: { t: DemoTask; today: string; blocked: boolean; upNext?: boolean; onFlag: () => void }) {
  const s = taskStatus(t, today);
  const late = s === "pending" ? daysBetween(t.end, today) : 0;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className={cx("w-3 h-3 rounded-full border-2 shrink-0", STATUS[s].dot)} />
      <div className="flex-1 min-w-0">
        <p className="text-body-md truncate">{upNext && <span className="text-label-sm text-muted mr-1.5">Up next</span>}{t.title}</p>
        <p className={cx("text-body-sm", late ? "text-amber-700" : "text-muted")}>{range(t.start, t.end)}{late > 0 && ` · ${late}d late`}</p>
      </div>
      {blocked && <Pill tone="red" icon="block">Blocked</Pill>}
      <StatusPill s={s} />
      <button onClick={onFlag} className="btn-ghost btn-sm px-1.5" title="Raise a blocker on this task" aria-label={`Raise a blocker on ${t.title}`}><Icon name="report" className="text-[18px]" /></button>
    </li>
  );
}

function StatusPill({ s, extra }: { s: MsStatus; extra?: string }) {
  return <Pill tone={STATUS[s].tone} icon={STATUS[s].icon}>{STATUS[s].label}{extra && ` · ${extra}`}</Pill>;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div>
      <div className={cx("text-headline-sm", tone)}>{value}</div>
      <div className="text-label-sm text-muted uppercase tracking-wide">{label}</div>
    </div>
  );
}
