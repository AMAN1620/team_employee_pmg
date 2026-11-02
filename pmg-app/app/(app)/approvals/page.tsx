import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Avatar, Card, Empty, Icon, PageHeader, Pill, fmtDate } from "@/components/ui";
import { all } from "@/lib/db";
import { draftPlansFor, peopleById, pendingAdditions, pendingApprovals, type Goal } from "@/lib/repo";
import { planLabel } from "@/lib/planner";
import { approveAdditionAction, approvePlanAction } from "@/app/actions/work";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const me = await requirePerson();
  const { done } = await searchParams;
  const people = peopleById();
  const pending = pendingApprovals(me.id);
  const drafts = draftPlansFor(me.id);
  const additions = pendingAdditions(me.id);
  const decided = all<Goal>(`SELECT g.* FROM goals g JOIN people p ON p.id = g.owner_id WHERE p.manager_id = ? AND g.status IN ('approved','changes_requested') AND g.level = 'individual' AND g.kind = 'work' AND (g.status = 'changes_requested' OR g.approved_by IS NOT NULL) ORDER BY COALESCE(g.approved_at, g.submitted_at) DESC LIMIT 6`, me.id);
  return (
    <div>
      <PageHeader title="Approvals" subtitle="Goals your team has drafted. Approve them, or ask for changes with a note." />
      {done && <div className="mb-6 rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">{done === "changes" ? "Changes requested. They got your note in chat." : done === "added" ? "Added to their week." : "Goal approved. It's now on their goal list."}</div>}
      <Card className="mb-6">
        {pending.length === 0 ? <Empty icon="task_alt" title="You're all caught up">No goals waiting for approval.</Empty> : (
          <ul className="divide-y divide-line">
            {pending.map((g) => (
              <li key={g.id} className="p-5 flex items-center gap-4">
                <Avatar name={people.get(g.owner_id)!.name} size={40} />
                <div className="flex-1"><p className="text-title-md">{g.title}</p><p className="text-body-sm text-muted">{people.get(g.owner_id)!.name}{g.horizon ? ` · ${planLabel(g)} · ${g.source === "ai" ? "planned by PMG" : "set by them"}` : ""} · submitted {fmtDate(g.submitted_at)}</p></div>
                <Pill tone="amber">Waiting for you</Pill>
                <Link href={`/approvals/${g.id}`} className="btn-primary">Review <Icon name="arrow_forward" className="text-[18px]" /></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {additions.length > 0 && <>
        <h2 className="label">Tickets that joined an approved week</h2>
        <Card className="mb-6"><ul className="divide-y divide-line">
          {additions.map((m) => (
            <li key={m.id} className="p-5 flex flex-wrap items-center gap-4">
              <Avatar name={people.get(m.owner_id)!.name} size={36} />
              <div className="flex-1 min-w-64"><p className="text-title-md">{m.title}</p><p className="text-body-sm text-muted">{people.get(m.owner_id)!.name} · {planLabel({ horizon: "week", start_date: m.start_date })} · {m.goal_title}</p></div>
              <form action={approveAdditionAction}><input type="hidden" name="milestoneId" value={m.id} /><input type="hidden" name="back" value="/approvals" /><button className="btn-primary btn-sm">Approve</button></form>
            </li>
          ))}
        </ul></Card>
      </>}
      {drafts.length > 0 && <>
        <h2 className="label">Drafted by PMG, not sent to you yet</h2>
        <Card className="mb-6"><ul className="divide-y divide-line">
          {drafts.map((g) => (
            <li key={g.id} className="p-5 flex flex-wrap items-center gap-4">
              <Avatar name={people.get(g.owner_id)!.name} size={36} />
              <div className="flex-1 min-w-64"><p className="text-title-md">{g.title}</p><p className="text-body-sm text-muted">{people.get(g.owner_id)!.name} · {planLabel(g)}</p></div>
              <Link href={`/team/${g.owner_id}?week=${g.start_date}#week`} className="btn-secondary btn-sm">Edit</Link>
              <form action={approvePlanAction}><input type="hidden" name="goalId" value={g.id} /><input type="hidden" name="back" value="/approvals" /><button className="btn-primary btn-sm">Approve</button></form>
            </li>
          ))}
        </ul></Card>
      </>}
      <h2 className="label">Recently decided</h2>
      <Card><ul className="divide-y divide-line">
        {decided.map((g) => (
          <li key={g.id} className="px-5 py-3 flex items-center gap-3"><Avatar name={people.get(g.owner_id)!.name} size={28} /><span className="flex-1 text-body-md">{g.title}</span>
            <Pill tone={g.status === "approved" ? "green" : "rose"}>{g.status === "approved" ? "Approved" : "Changes requested"}</Pill></li>
        ))}
      </ul></Card>
    </div>
  );
}
