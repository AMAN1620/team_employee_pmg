// What PMG notices that might be a blocker: a goal for this week that's behind by mid-week, tasks past their date,
// and blockers due today ("is it resolved?"). Each leads straight into the blocker form, prefilled. On chat, the
// same prompts would also go out on the org's messaging channel (mocked in this prototype).
import Link from "next/link";
import { Icon, fmtDate } from "@/components/ui";
import { blockersRaisedBy, getPerson, type Person } from "@/lib/repo";
import { planLabel } from "@/lib/planner";
import { behindGoals, describeNudge, overdueTasks } from "@/lib/services/blockers";
import { today } from "@/lib/time";
import { dismissNudgeAction } from "@/app/actions/blockers";
import { blockerAction } from "@/app/actions/app";

const raise = (p: Record<string, string | number>) => `/blockers?drawer=1&${new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)]))}`;

export function BlockerPrompts({ person, showDue = true }: { person: Person; showDue?: boolean }) {
  const behind = behindGoals(person.id);
  const overdue = overdueTasks(person.id).slice(0, 5);
  const due = showDue ? blockersRaisedBy(person.id).filter((b) => b.status !== "resolved" && b.need_by === today()) : [];
  if (!behind.length && !overdue.length && !due.length) return null;
  return (
    <div className="space-y-3 mb-6">
      {behind.map((b) => (
        <div key={b.goal.id} className="rounded-xl border border-violet/30 bg-violet-tint/40 p-4 flex flex-wrap items-center gap-3">
          <Icon name="auto_awesome" className="text-violet" />
          <div className="flex-1 min-w-64">
            <p className="text-body-md"><b>{describeNudge(b)}</b> Is something in the way?</p>
            <p className="text-body-sm text-muted">{b.goal.title}</p>
          </div>
          <Link href={raise({ goalId: b.goal.id, origin: "nudge" })} className="btn-primary btn-sm"><Icon name="report" className="text-[16px]" /> Raise a blocker</Link>
          <form action={dismissNudgeAction}><input type="hidden" name="goalId" value={b.goal.id} /><button className="btn-ghost btn-sm">Not blocked</button></form>
        </div>
      ))}
      {due.map((b) => (
        <div key={b.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center gap-3 text-amber-900">
          <Icon name="event" />
          <p className="flex-1 min-w-64 text-body-md"><b>Due today:</b> is “{b.title}” resolved?</p>
          <Op id={b.id} op="resolve" label="Yes, resolved" primary />
          {b.owner_id !== b.raised_by && <Op id={b.id} op="nudge" label={`Still blocked: nudge ${getPerson(b.owner_id)?.name.split(" ")[0]}`} />}
        </div>
      ))}
      {overdue.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-white p-4">
          <p className="text-label-md flex items-center gap-2 text-amber-800"><Icon name="notifications_active" className="text-[18px]" /> {overdue.length === 1 ? "A task is" : `${overdue.length} tasks are`} past their date</p>
          <ul className="mt-2 divide-y divide-line">
            {overdue.map((o) => (
              <li key={o.milestone.id} className="py-2 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-64">
                  <p className="text-body-md">{o.milestone.title}</p>
                  <p className="text-body-sm text-muted">{o.goal.horizon ? planLabel(o.goal) : o.goal.title} · was due {fmtDate(o.due)} · {o.daysLate} day{o.daysLate === 1 ? "" : "s"} late</p>
                </div>
                <Link href={raise({ goalId: o.goal.id, milestoneId: o.milestone.id, origin: "overdue_task" })} className="btn-secondary btn-sm"><Icon name="report" className="text-[16px]" /> Something blocking it?</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Op({ id, op, label, primary }: { id: number; op: string; label: string; primary?: boolean }) {
  return (
    <form action={blockerAction}>
      <input type="hidden" name="blockerId" value={id} /><input type="hidden" name="op" value={op} />
      <button className={`${primary ? "btn-primary" : "btn-secondary"} btn-sm`}>{label}</button>
    </form>
  );
}
