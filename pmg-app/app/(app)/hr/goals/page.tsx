import { requirePerson } from "@/lib/session";
import { Avatar, Card, CardHeader, HealthPill, Icon, PageHeader, Pill, ProgressBar } from "@/components/ui";
import { get } from "@/lib/db";
import { childGoals, companyGoals, listPeople, listTeams, peopleById } from "@/lib/repo";
import { goalProgress } from "@/lib/logic/health";
import { goalView } from "@/lib/services/views";
import { createCompanyGoalAction } from "@/app/actions/app";

export default async function CompanyGoalsPage({ searchParams }: { searchParams: Promise<{ created?: string; open?: string }> }) {
  await requirePerson();
  const sp = await searchParams;
  const people = peopleById();
  const goals = companyGoals();
  const teams = listTeams();
  const linkedTeams = new Set(goals.flatMap((g) => childGoals(g.id).map((t) => t.team_id)));
  const unlinked = teams.filter((t) => !linkedTeams.has(t.id));
  const approved = get<{ n: number }>("SELECT COUNT(*) AS n FROM goals WHERE level = 'individual' AND kind = 'work' AND status = 'approved'")?.n ?? 0;
  const waiting = get<{ n: number }>("SELECT COUNT(*) AS n FROM goals WHERE level = 'individual' AND kind = 'work' AND status = 'pending'")?.n ?? 0;
  // Individual goals across the org: modelled goals plus the rest of the company.
  const orgApproved = 268 - 11 + approved, orgWaiting = 18 + waiting;
  const open = Number(sp.open ?? goals[0]?.id);

  return (
    <div>
      <PageHeader title="Company goals · FY 2026–27" subtitle="Set the company's goals and see how teams and people connect to them." />
      {sp.created && <div className="mb-6 rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">Goal created. Teams can now link their goals to it.</div>}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {goals.map((g) => {
            const teamsUnder = childGoals(g.id);
            const expanded = g.id === open;
            return (
              <Card key={g.id} className="p-6">
                <a href={`/hr/goals?open=${expanded ? 0 : g.id}`} className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Icon name={expanded ? "expand_more" : "chevron_right"} className="text-[24px] text-muted" />
                    <div><p className="text-title-md">{g.title}</p><p className="text-body-sm text-muted">Owner: {people.get(g.owner_id)?.title === "Chief Executive Officer" ? "CEO" : people.get(g.owner_id)?.name} · {teamsUnder.length} team goals</p></div>
                  </div>
                  <div className="w-40 text-right"><p className="text-title-md">{Math.round(goalProgress(g) * 100)}%</p><ProgressBar value={goalProgress(g) * 100} /></div>
                </a>
                {expanded && (
                  <ul className="mt-4 ml-9 border-l-2 border-line pl-6 space-y-3">
                    {teamsUnder.map((t) => {
                      const v = goalView(t);
                      return (
                        <li key={t.id} className="relative rounded-lg border border-line p-3 flex items-center gap-3">
                          <span className="absolute -left-6 top-1/2 w-6 border-t-2 border-line" />
                          <Avatar name={people.get(t.owner_id)?.name ?? ""} size={28} />
                          <div className="flex-1"><p className="text-label-md">{teams.find((x) => x.id === t.team_id)?.name}: {t.title}</p><p className="text-body-sm text-muted">{people.get(t.owner_id)?.name} · {childGoals(t.id).filter((c) => c.status === "approved").length} individual goals</p></div>
                          <HealthPill health={v.h.health} />
                        </li>
                      );
                    })}
                    <li>
                      <form action={createCompanyGoalAction} className="flex gap-2">
                        <input type="hidden" name="parentId" value={g.id} />
                        <input name="title" required placeholder="Add a team goal under this…" className="input" />
                        <select name="ownerId" className="input w-48">{listPeople().filter((p) => p.role === "manager" && p.id !== "neha").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                        <button className="btn-secondary">Add</button>
                      </form>
                    </li>
                  </ul>
                )}
              </Card>
            );
          })}
          {unlinked.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3 text-body-md text-amber-900">
              <Pill tone="amber" icon="warning">{unlinked.length} teams</Pill> have no linked goals yet: {unlinked.map((t) => t.name).join(", ")}
            </div>
          )}
          <Card className="p-6">
            <CardHeader title="New company goal" icon="add_circle" />
            <form action={createCompanyGoalAction} className="grid sm:grid-cols-[1fr_180px_auto] gap-2">
              <input name="title" required placeholder="e.g. Expand to two new cities with 50 customers each" className="input" />
              <input name="dueDate" type="date" defaultValue="2027-03-31" className="input" />
              <button className="btn-primary">Create</button>
            </form>
          </Card>
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="p-6">
            <CardHeader title="Goal templates" icon="dashboard_customize" />
            <ul className="space-y-2">
              {[["Launch a feature", 42], ["Improve a metric", 37], ["Customer outcome", 21], ["Learning goal", 18]].map(([t, n]) => (
                <li key={t} className="flex items-center justify-between rounded-lg border border-line p-3"><span className="text-label-md">{t}</span><span className="text-body-sm text-muted">used {n} times</span></li>
              ))}
            </ul>
            <p className="text-body-sm text-muted mt-3">Templates give every team a measurable starting point, so goal quality doesn&apos;t depend on each manager.</p>
          </Card>
          <Card className="p-6">
            <CardHeader title="Goal-setting progress" icon="flag" />
            <p className="text-body-md">Individual goals approved: <b>{orgApproved} of 312</b> ({Math.round((orgApproved / 312) * 100)}%)</p>
            <ProgressBar value={(orgApproved / 312) * 100} className="mt-2" />
            <p className="text-body-md mt-3">Waiting for manager approval: <b>{orgWaiting}</b></p>
          </Card>
        </div>
      </div>
    </div>
  );
}
