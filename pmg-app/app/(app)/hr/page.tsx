import { requirePerson } from "@/lib/session";
import { Card, CardHeader, Icon, PageHeader, Pill, ProgressBar, cx, fmtDate } from "@/components/ui";
import { all } from "@/lib/db";
import { activeCycle, allBlockers, listPeople, listTeams, setting } from "@/lib/repo";
import { sendRemindersAction } from "@/app/actions/app";

const COLUMNS = ["Backend", "Engineering", "Finance", "Legal", "IT"];
// Open blockers across the rest of the org (people not modelled individually in the demo). Live blockers are added on top.
const BASE: Record<string, number[]> = {
  product: [7, 3, 1, 1, 0], engineering: [4, 0, 0, 1, 2], cs: [2, 5, 1, 0, 1], sales: [1, 2, 4, 3, 0], finance: [1, 1, 0, 2, 1], people: [0, 1, 1, 1, 0],
};

export default async function HrOverview({ searchParams }: { searchParams: Promise<{ reminded?: string }> }) {
  await requirePerson();
  const { reminded } = await searchParams;
  const cycle = activeCycle();
  const teams = listTeams();
  const people = listPeople();
  const metrics = JSON.parse(setting("org.metrics") ?? "{}") as { checkinParticipation: number; checkinDelta: number; blockerDays: number; blockerDelta: number; health: number[]; mood: number; hoursSaved: number; milestonesOnTime: number; recognized: number };
  const submitted = cycle ? all<{ person_id: string; kind: string }>("SELECT person_id, kind FROM reviews WHERE cycle_id = ? AND status = 'submitted'", cycle.id) : [];
  const teamOf = new Map(people.map((p) => [p.id, p.team_id]));

  const rows = teams.map((t) => {
    const self = t.self_done_base + submitted.filter((r) => r.kind === "self" && teamOf.get(r.person_id) === t.id).length;
    const mgr = t.mgr_done_base + submitted.filter((r) => r.kind === "manager" && teamOf.get(r.person_id) === t.id).length;
    const selfPct = Math.round((self / t.headcount) * 100);
    return { t, self, mgr, selfPct, mgrPct: Math.round((mgr / t.headcount) * 100), behind: selfPct < 35 };
  });
  const totalSelf = rows.reduce((n, r) => n + r.self, 0), totalMgr = rows.reduce((n, r) => n + r.mgr, 0), total = cycle?.participants ?? 312;

  const heat = Object.fromEntries(teams.map((t) => [t.id, [...(BASE[t.id] ?? [0, 0, 0, 0, 0])]]));
  for (const b of allBlockers().filter((b) => b.status !== "resolved")) {
    const from = teamOf.get(b.raised_by);
    const owner = people.find((p) => p.id === b.owner_id);
    const col = owner?.title.includes("Backend") ? 0 : owner?.team_id === "engineering" ? 1 : owner?.team_id === "finance" ? 2 : -1;
    if (from && col >= 0 && from !== owner?.team_id) heat[from][col]++;
  }
  const max = Math.max(...Object.values(heat).flat());

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Acme Labs · 312 employees · team-level view" />
      {reminded && <div className="rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">Reminders sent in chat to {reminded} people who haven&apos;t submitted yet.</div>}

      {cycle && (
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div><h2 className="section-title">{cycle.name}</h2><p className="text-body-md text-muted">Self-reviews due {fmtDate(cycle.self_due)} · Manager reviews due {fmtDate(cycle.manager_due)}</p></div>
            <form action={sendRemindersAction}><button className="btn-primary"><Icon name="send" className="text-[18px]" /> Send reminders in chat</button></form>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div><p className="text-body-md mb-1">Self-reviews <b>{Math.round((totalSelf / total) * 100)}%</b> <span className="text-muted">({totalSelf} of {total})</span></p><ProgressBar value={(totalSelf / total) * 100} /></div>
            <div><p className="text-body-md mb-1">Manager reviews <b>{Math.round((totalMgr / total) * 100)}%</b> <span className="text-muted">({totalMgr} of {total})</span></p><ProgressBar value={(totalMgr / total) * 100} tone="violet" /></div>
          </div>
          <table className="w-full text-left">
            <thead className="text-label-sm text-muted uppercase tracking-wide border-b border-line"><tr>{["Team", "People", "Self-reviews", "Manager reviews", "Status", ""].map((h) => <th key={h} className="py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.t.id}>
                  <td className="py-3 text-label-md">{r.t.name}</td><td className="py-3 text-body-md">{r.t.headcount}</td>
                  <td className="py-3"><div className="flex items-center gap-2"><ProgressBar value={r.selfPct} className="w-24" /><span className="text-body-md">{r.selfPct}%</span></div></td>
                  <td className="py-3 text-body-md">{r.mgrPct}%</td>
                  <td className="py-3">{r.behind ? <Pill tone="amber" icon="schedule">Behind</Pill> : <Pill tone="green" icon="check_circle">On track</Pill>}</td>
                  <td className="py-3 text-right"><form action={sendRemindersAction}><input type="hidden" name="teamId" value={r.t.id} /><button className="btn-ghost btn-sm text-teal">Remind</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Check-in participation" value={`${metrics.checkinParticipation}%`} delta={`+${metrics.checkinDelta} pts this week`} good />
        <Kpi label="Avg time to resolve a blocker" value={`${metrics.blockerDays} days`} delta={`${metrics.blockerDelta} days vs last month`} good />
        <div className="card p-5">
          <p className="label">Goal health</p>
          <p className="text-body-md">{metrics.health[0]}% on track · {metrics.health[1]}% at risk · {metrics.health[2]}% off track</p>
          <div className="flex h-2 rounded-full overflow-hidden mt-3"><div className="bg-[#15803D]" style={{ width: `${metrics.health[0]}%` }} /><div className="bg-[#B45309]" style={{ width: `${metrics.health[1]}%` }} /><div className="bg-[#B91C1C]" style={{ width: `${metrics.health[2]}%` }} /></div>
        </div>
        <Kpi label="Weekly mood" value={`${metrics.mood} / 5`} delta="from the check-in question" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-7 p-6">
          <CardHeader title="Where work gets stuck" icon="grid_view" subtitle="Open blockers by the team raising them (rows) and the team they're waiting on (columns)" />
          <table className="w-full text-center table-fixed">
            <thead><tr><th className="w-36" /><>{COLUMNS.map((c) => <th key={c} className="text-label-sm text-muted font-medium pb-2">{c}</th>)}</></tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td className="text-left text-label-md pr-3 py-1">{t.name}</td>
                  {heat[t.id].map((v, i) => (
                    <td key={i} className="p-1">
                      <div className={cx("h-10 rounded-md flex items-center justify-center text-label-md", t.id === "product" && i === 0 && "ring-2 ring-offset-1 ring-teal")}
                        style={{ background: v ? `rgba(15,118,110,${0.1 + (v / max) * 0.8})` : "#F1F5F9", color: v / max > 0.5 ? "#fff" : "#0F172A" }}>{v || ""}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-body-sm text-muted mt-3">Highest: Product → Backend ({heat.product[0]} open). A conversation with the backend lead would unblock the most people.</p>
        </Card>
        <Card accent="teal" className="col-span-12 lg:col-span-5 p-6">
          <CardHeader title="Value this quarter" icon="savings" />
          <ul className="space-y-5">
            <li><p className="text-headline-md">≈{metrics.hoursSaved.toLocaleString("en-IN")} hours</p><p className="text-body-md text-muted">saved on status updates (estimate: check-ins replacing weekly status reports)</p></li>
            <li><p className="text-headline-md">{metrics.milestonesOnTime}%</p><p className="text-body-md text-muted">of milestones hit on time</p></li>
            <li><p className="text-headline-md">{metrics.recognized}%</p><p className="text-body-md text-muted">of employees recognized at least once</p></li>
          </ul>
        </Card>
      </div>
      <p className="text-body-sm text-muted flex items-center gap-1"><Icon name="lock" className="text-[16px]" /> Team-level data only. HR can&apos;t see private journal entries or raw check-in replies.</p>
    </div>
  );
}

function Kpi({ label, value, delta, good }: { label: string; value: string; delta: string; good?: boolean }) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <p className="text-headline-md">{value}</p>
      <p className={cx("text-body-sm mt-1", good ? "text-green-700" : "text-muted")}>{delta}</p>
    </div>
  );
}
