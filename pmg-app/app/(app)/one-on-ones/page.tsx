import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Avatar, Card, Empty, Icon, PageHeader, Pill, cx, fmtDate, fmtTime } from "@/components/ui";
import { directReports, goalsFor, managerOneOnOnes, peopleById } from "@/lib/repo";
import { agendaFor } from "@/lib/services/views";
import { today } from "@/lib/time";
import { addActionItemAction, addTopicAction, saveNotesAction, toggleActionAction } from "@/app/actions/app";

const SOURCE: Record<string, [string, string]> = {
  blocker: ["error", "text-rose-600"], at_risk: ["warning", "text-amber-600"], win: ["celebration", "text-violet"],
  action: ["schedule", "text-rose-600"], topic: ["chat_bubble", "text-teal"],
};

export default async function OneOnOnesPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  const people = peopleById();
  const reports = me.role === "manager" ? directReports(me.id) : [];
  const employeeId = me.role === "manager" ? (reports.find((r) => r.id === sp.with) ?? reports.find((r) => r.id === "anshika") ?? reports[0])?.id : me.id;
  const managerId = me.role === "manager" ? me.id : me.manager_id;
  if (!employeeId || !managerId) return <Card><Empty title="No 1:1s yet" /></Card>;

  const a = agendaFor(employeeId, managerId);
  const one = a.oneOnOne;
  const goals = goalsFor(employeeId).filter((g) => g.status === "approved");
  const upcoming = me.role === "manager" ? managerOneOnOnes(me.id).filter((o) => o.scheduled_at.slice(0, 10) >= today()) : [];
  const isToday = one?.scheduled_at.slice(0, 10) === today();

  return (
    <div>
      <PageHeader
        title={<span className="inline-flex items-center gap-3"><span className="flex -space-x-2"><Avatar name={a.employee.name} size={36} /><Avatar name={a.manager.name} size={36} /></span>{a.employee.name.split(" ")[0]} &amp; {a.manager.name.split(" ")[0]} · Weekly 1:1</span>}
        subtitle={one ? `${isToday ? "Today" : fmtDate(one.scheduled_at, { weekday: "short", day: "numeric", month: "short" })}, ${fmtTime(one.scheduled_at)}–${fmtTime(one.scheduled_at.slice(0, 11) + String(Number(one.scheduled_at.slice(11, 13))).padStart(2, "0") + ":30")}` : undefined}
        chip={<Pill tone="teal" icon="videocam">Google Meet</Pill>}
        right={<><a href="#notes" className="btn-primary"><Icon name="edit_note" className="text-[18px]" /> Start notes</a><button className="btn-secondary" disabled>Reschedule</button></>} />

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-2 space-y-2">
          {me.role === "manager" ? (
            <>
              <p className="label">Upcoming</p>
              {upcoming.map((o) => (
                <Link key={o.id} href={`/one-on-ones?with=${o.employee_id}`} className={cx("block rounded-lg p-3 border", o.employee_id === employeeId ? "border-teal bg-teal-tint/40" : "border-line bg-white hover:border-teal/40")}>
                  <p className="text-label-md">{people.get(o.employee_id)?.name}</p>
                  <p className="text-body-sm text-muted">{fmtDate(o.scheduled_at, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(o.scheduled_at)}</p>
                </Link>
              ))}
            </>
          ) : (
            <>
              <p className="label">Meetings</p>
              {one && <div className="rounded-lg p-3 border border-teal bg-teal-tint/40"><p className="text-label-md">{isToday ? "Today" : fmtDate(one.scheduled_at)}</p><p className="text-body-sm text-muted">Upcoming</p></div>}
              {a.history.map((o) => (
                <details key={o.id} className="rounded-lg p-3 border border-line bg-white">
                  <summary className="text-label-md cursor-pointer">{fmtDate(o.scheduled_at)}</summary>
                  <p className="text-body-sm text-muted mt-1">{o.notes || "No notes"}</p>
                </details>
              ))}
            </>
          )}
        </aside>

        <div className="col-span-12 lg:col-span-6 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Agenda</h2>
              <Pill tone="teal" icon="auto_awesome">Auto-filled from goals, blockers and wins</Pill>
            </div>
            <ul className="space-y-2">
              {a.items.map((it) => {
                const [icon, tone] = SOURCE[it.source];
                const label = it.source === "topic" ? `${people.get(it.authorId ?? "")?.name.split(" ")[0]}'s topic` : it.label;
                return (
                  <li key={it.key} className="flex items-start gap-3 rounded-lg border border-line p-3 bg-white">
                    <Icon name="drag_indicator" className="text-[18px] text-slate-300" />
                    <Icon name={icon} className={`text-[20px] ${tone}`} />
                    <div className="flex-1"><p className="text-label-sm text-muted uppercase tracking-wide">{label}</p><p className="text-body-md">{it.text}</p></div>
                  </li>
                );
              })}
            </ul>
            {one && (
              <form action={addTopicAction} className="flex gap-2 mt-4">
                <input type="hidden" name="oneOnOneId" value={one.id} />
                <input name="text" placeholder="Add a topic…" className="input" />
                <button className="btn-secondary">Add</button>
              </form>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="section-title mb-4">Action items</h2>
            <ul className="divide-y divide-line">
              {a.actions.map((x) => {
                const overdue = !x.done_at && x.due && x.due < today();
                return (
                  <li key={x.id} className="py-3 flex items-center gap-3">
                    <form action={toggleActionAction}><input type="hidden" name="actionId" value={x.id} />
                      <button className={cx("w-5 h-5 rounded border flex items-center justify-center", x.done_at ? "bg-teal border-teal text-white" : "border-slate-300")} aria-label="Toggle done">{x.done_at && <Icon name="check" className="text-[14px]" />}</button></form>
                    <div className={cx("flex-1", x.done_at && "text-muted line-through")}>
                      <p className="text-body-md">{x.text}</p>
                      {x.carried_from && !x.done_at && <p className="text-body-sm text-muted no-underline">Carried over from {fmtDate(x.carried_from)}</p>}
                    </div>
                    <span className="inline-flex items-center gap-1 text-body-sm"><Avatar name={people.get(x.owner_id)?.name ?? ""} size={22} /> {people.get(x.owner_id)?.name.split(" ")[0]}</span>
                    {overdue ? <Pill tone="rose">Overdue {Math.round((Date.parse(today()) - Date.parse(x.due!)) / 86400000)} days</Pill> : <span className="text-body-sm text-muted w-20 text-right">{x.done_at ? "Done" : fmtDate(x.due)}</span>}
                  </li>
                );
              })}
            </ul>
            {one && (
              <form action={addActionItemAction} className="grid grid-cols-[1fr_140px_140px_auto] gap-2 mt-4">
                <input type="hidden" name="oneOnOneId" value={one.id} />
                <input name="text" placeholder="Add an action…" className="input" required />
                <select name="ownerId" className="input" defaultValue={me.id}><option value={a.employee.id}>{a.employee.name.split(" ")[0]}</option><option value={a.manager.id}>{a.manager.name.split(" ")[0]}</option></select>
                <input name="due" type="date" className="input" />
                <button className="btn-secondary">Add</button>
                <select name="goalId" className="input col-span-4"><option value="">Not linked to a goal</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select>
              </form>
            )}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          {one && (
            <Card className="p-6" >
              <h2 className="section-title mb-3" id="notes">Shared notes</h2>
              <form action={saveNotesAction} className="space-y-2">
                <input type="hidden" name="oneOnOneId" value={one.id} />
                <textarea name="notes" defaultValue={one.notes} className="textarea min-h-[180px]" placeholder={"Notes both of you can see.\nTip: lines like “Muru to share the promotion doc” or “Action: send results to Sales” become action items."} />
                <div className="flex gap-2">
                  <button className="btn-secondary btn-sm">Save notes</button>
                  <button name="op" value="extract" className="btn-ghost btn-sm text-teal"><Icon name="auto_awesome" className="text-[16px]" /> Find action items in notes</button>
                </div>
              </form>
            </Card>
          )}
          <Card className="p-6">
            <h2 className="section-title mb-2">Reminders</h2>
            <p className="text-body-md text-muted flex gap-2"><Icon name="notifications_active" className="text-teal" /> You both get a chat reminder a day before an action is due.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
