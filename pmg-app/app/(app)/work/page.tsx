import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Card, CardHeader, Empty, Icon, PageHeader, Pill, cx, fmtDate } from "@/components/ui";
import { connectionsFor, workItemsFor, type WorkItem } from "@/lib/repo";
import { CONNECTORS } from "@/lib/connectors";
import { DAYS_PER_POINT, DAYS_PER_TASK, buildPlan, fmtDay, themeName } from "@/lib/planner";
import { today } from "@/lib/time";
import { addWorkAction, syncNowAction, workStatusAction } from "@/app/actions/work";

const STATUS: Record<WorkItem["status"], [string, "slate" | "teal" | "violet" | "amber" | "green"]> = {
  todo: ["To do", "slate"], in_progress: ["In progress", "teal"], review: ["In review", "violet"], on_hold: ["On hold", "amber"], done: ["Done", "green"],
};

function ago(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`;
  return fmtDate(iso);
}

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ synced?: string; drafted?: string; added?: string; error?: string }> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  const connections = connectionsFor(me.id);
  const items = workItemsFor(me.id);
  const plan = buildPlan(items, today());
  const due = new Map(plan.features.flatMap((f) => f.tasks.map((t) => [t.item.id, t.due] as const)));
  const active = plan.features.filter((f) => !f.doneAt);
  const open = items.filter((i) => i.status !== "done" && i.status !== "on_hold");
  const held = items.filter((i) => i.status === "on_hold");
  const done = items.filter((i) => i.status === "done").slice(0, 15);
  const parents = new Set(items.map((i) => i.parent_key).filter(Boolean));
  const drafted = Number(sp.drafted ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader title="My work" subtitle="PMG plans your weekly, monthly and quarterly goals from this work. You don't write them; your manager approves them." />

      {sp.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-body-md text-red-900">Sync didn't work: {sp.error}</div>}
      {(sp.synced || sp.added) && (
        <div className="rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">
          {sp.synced ? `Synced ${sp.synced} tickets.` : "Added."} {drafted ? `${drafted} new week goal${drafted > 1 ? "s" : ""} drafted. Check ${drafted > 1 ? "them" : "it"} and ask your manager to approve.` : "Your goals are up to date."}
          {" "}<Link href="/goals" className="underline">See goals</Link>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-7 p-6">
          <CardHeader title="Where your work comes from" icon="hub" />
          <ul className="divide-y divide-line">
            {connections.map((c) => (
              <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                <Icon name="confirmation_number" className="text-[22px] text-teal" />
                <div className="flex-1 min-w-48">
                  <p className="text-title-md">{CONNECTORS[c.kind]?.label ?? c.kind} <span className="text-body-sm text-muted">· {c.label}</span></p>
                  <p className={cx("text-body-sm", c.last_error ? "text-red-700" : "text-muted")}>
                    {c.last_error ? `Last sync failed: ${c.last_error}` : `Synced ${ago(c.last_synced_at)} · every 15 minutes while PMG runs`}
                  </p>
                </div>
                <form action={syncNowAction}><button className="btn-secondary btn-sm"><Icon name="sync" className="text-[16px]" /> Sync now</button></form>
              </li>
            ))}
            {connections.length === 0 && (
              <li className="py-3 text-body-md text-muted">
                No work tool connected. {Object.values(CONNECTORS).some((c) => c.configured()) ? "Jira is set up for your company; ask your admin to link your account." : ""} Until then, add your work below.
              </li>
            )}
            <li className="py-3 flex items-center gap-3">
              <Icon name="edit_note" className="text-[22px] text-teal" />
              <div className="flex-1"><p className="text-title-md">Added by hand</p><p className="text-body-sm text-muted">For work no tool tracks. Planned the same way.</p></div>
              <span className="text-body-sm text-muted">{items.filter((i) => i.source === "manual").length} items</span>
            </li>
          </ul>
          <p className="text-body-sm text-muted mt-3">Linear, GitHub and Asana would plug in the same way; Jira is the first connector.</p>
        </Card>

        <Card className="col-span-12 lg:col-span-5 p-6">
          <CardHeader title="How PMG sizes your work" icon="straighten" />
          <p className="text-body-md">1 story point is {DAYS_PER_POINT} working days; a task without points is {DAYS_PER_TASK}. A feature is due on its Jira due date, or when its tasks add up to.</p>
          {active.length > 0 && (
            <ul className="mt-3 divide-y divide-line">
              {active.map((f) => (
                <li key={f.key} className="py-2.5">
                  <p className="text-label-md">{f.theme}</p>
                  <p className="text-body-sm text-muted">
                    {f.tasks.length} task{f.tasks.length === 1 ? "" : "s"}{f.points ? ` · ${f.points} pts` : ""} → {f.effortDays} days · due {fmtDay(f.deadline)}{f.deadlineFrom === "jira" ? " (Jira)" : ""}
                    {f.expected > f.deadline && <span className="text-amber-700"> · now {fmtDay(f.expected)}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-body-sm text-muted mt-3">Each task counts toward the week it should finish. When work slips, PMG re-plans the rest from today, so your manager sees why.</p>
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader title="Add work by hand" icon="add_task" subtitle="For anything your work tool doesn't track" />
        <form action={addWorkAction} className="grid grid-cols-12 gap-3 items-end">
          <label className="col-span-12 md:col-span-6"><span className="label">What are you working on?</span><input name="title" required className="input" placeholder="e.g. Write the cross-chat memory tech note" /></label>
          <label className="col-span-6 md:col-span-2"><span className="label">Size</span>
            <select name="size" defaultValue="medium" className="input"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select>
          </label>
          <label className="col-span-6 md:col-span-2"><span className="label">Due (optional)</span><input name="due" type="date" className="input" /></label>
          <label className="col-span-6 md:col-span-1 flex items-center gap-2 h-10"><input type="checkbox" name="started" defaultChecked /> <span className="text-body-sm">Started</span></label>
          <div className="col-span-6 md:col-span-1"><button className="btn-primary w-full">Add</button></div>
        </form>
      </Card>

      <Card className="p-6">
        <CardHeader title="Open work" icon="pending_actions" right={<Pill tone="slate">{open.length}</Pill>} />
        {open.length === 0 ? <Empty icon="task_alt" title="Nothing open">New tickets show up here after the next sync.</Empty> : <ItemList items={open} due={due} parents={parents} />}
      </Card>

      {held.length > 0 && (
        <Card className="p-6">
          <CardHeader title="On hold" icon="pause_circle" iconTone="amber" subtitle="Left out of your goals until they move again" />
          <ItemList items={held} due={due} parents={parents} />
        </Card>
      )}

      <Card className="p-6">
        <CardHeader title="Recently done" icon="task_alt" />
        <ItemList items={done} due={due} parents={parents} />
      </Card>
    </div>
  );
}

function ItemList({ items, due, parents }: { items: WorkItem[]; due: Map<number, string>; parents: Set<string | null> }) {
  const t = today();
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => {
        const d = due.get(i.id);
        const late = !i.done_at && d && d < t;
        return (
          <li key={i.id} className="py-3 flex flex-wrap items-center gap-3">
            <Pill tone={STATUS[i.status][1]}>{i.status_label ?? STATUS[i.status][0]}</Pill>
            <div className="flex-1 min-w-64">
              <p className="text-body-md">
                {i.url ? <a href={i.url} target="_blank" rel="noreferrer" className="text-teal hover:underline mr-1.5">{i.external_key}</a> : <span className="text-muted mr-1.5">By hand</span>}
                {i.title}
              </p>
              <p className="text-body-sm text-muted">
                {[i.parent_title && themeName(i.parent_title), i.epic_title, i.size ? `${i.size} pt` : i.kind, i.started_at && `started ${fmtDate(i.started_at)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className={cx("text-body-sm w-36 text-right", late ? "text-red-700" : "text-muted")}>
              {i.done_at ? `Done ${fmtDate(i.done_at)}` : d ? `${late ? "Was due" : "Expected"} ${fmtDate(d)}` : parents.has(i.external_key) ? "Tracked through its sub-tasks" : ""}
            </span>
            {i.source === "manual" && i.status !== "done" && (
              <form action={workStatusAction} className="flex gap-1">
                <input type="hidden" name="itemId" value={i.id} />
                {i.status === "todo" && <button name="status" value="in_progress" className="btn-ghost btn-sm">Start</button>}
                <button name="status" value="done" className="btn-ghost btn-sm text-teal">Mark done</button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
