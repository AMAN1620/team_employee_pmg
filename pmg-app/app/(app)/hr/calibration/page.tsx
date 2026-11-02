import { requirePerson } from "@/lib/session";
import { Card, CardHeader, Icon, PageHeader, Pill, cx } from "@/components/ui";
import { activeCycle, listTeams, ratingLevels, reviewsInCycle, getPerson, type ReviewPayload } from "@/lib/repo";

// Rating shares (1..5, %) from the rest of the org, as they'd look once manager reviews close. Live manager reviews are added to their team.
const BASE: Record<string, number[]> = {
  engineering: [2, 13, 55, 24, 6], sales: [1, 8, 30, 45, 16], cs: [4, 16, 60, 20, 0], finance: [3, 12, 52, 27, 6], product: [3, 10, 50, 28, 9], people: [0, 14, 50, 29, 7],
};
const COLORS = ["#B91C1C", "#F59E0B", "#94A3B8", "#14B8A6", "#0F766E"];

export default async function CalibrationPage() {
  await requirePerson();
  const cycle = activeCycle()!;
  const levels = ratingLevels(cycle.id);
  const teams = listTeams();
  const live: Record<string, number[]> = {};
  for (const r of reviewsInCycle(cycle.id).filter((r) => r.kind === "manager" && r.status === "submitted")) {
    const team = getPerson(r.person_id)?.team_id ?? "";
    const ratings = Object.values((JSON.parse(r.payload) as ReviewPayload).goals ?? {}).map((g) => g.rating).filter(Boolean) as number[];
    if (!ratings.length) continue;
    const avg = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
    (live[team] ??= [0, 0, 0, 0, 0])[avg - 1]++;
  }
  const dist = (id: string) => {
    const base = BASE[id] ?? [0, 0, 100, 0, 0];
    const team = teams.find((t) => t.id === id)!;
    const add = live[id] ?? [0, 0, 0, 0, 0];
    const counts = base.map((pct, i) => (pct / 100) * team.headcount + add[i]);
    const total = counts.reduce((a, b) => a + b, 0);
    return counts.map((c) => Math.round((c / total) * 100));
  };
  const company = [0, 1, 2, 3, 4].map((i) => Math.round(teams.reduce((n, t) => n + (BASE[t.id]?.[i] ?? 0) * t.headcount, 0) / teams.reduce((n, t) => n + t.headcount, 0)));
  const high = (d: number[]) => d[3] + d[4];

  return (
    <div className="space-y-6">
      <PageHeader title={`Calibration · ${cycle.name}`} subtitle="How ratings are spread across teams, to start the right conversations."
        chip={<Pill tone="slate">Preview: final once manager reviews close on 11 Dec</Pill>}
        right={<button className="btn-secondary" disabled><Icon name="download" className="text-[18px]" /> Export for calibration meeting</button>} />

      <Card className="p-6">
        <CardHeader title="Rating spread by team" icon="stacked_bar_chart" />
        <div className="flex flex-wrap gap-4 mb-4">{levels.map((l, i) => <span key={l.level} className="inline-flex items-center gap-1.5 text-body-sm"><span className="w-3 h-3 rounded-sm" style={{ background: COLORS[i] }} />{l.level} {l.label}</span>)}</div>
        <div className="space-y-3">
          {[{ id: "company", name: "Company", d: company }, ...teams.map((t) => ({ id: t.id, name: t.name, d: dist(t.id) }))].map((row) => {
            const flag = row.id !== "company" && high(row.d) - high(company) > 20;
            return (
              <div key={row.id} className="grid grid-cols-[160px_1fr_220px] gap-4 items-center">
                <span className={cx("text-label-md", row.id === "company" && "font-semibold")}>{row.name}</span>
                <div className={cx("flex h-8 rounded-md overflow-hidden", row.id === "company" && "ring-2 ring-slate-300")}>
                  {row.d.map((v, i) => <div key={i} style={{ width: `${v}%`, background: COLORS[i] }} className="text-[11px] text-white font-semibold flex items-center justify-center">{v >= 6 ? `${v}%` : ""}</div>)}
                </div>
                <span>{flag ? <Pill tone="amber" icon="flag">Much higher than the company average</Pill> : <span className="text-body-sm text-muted">{high(row.d)}% rated 4+</span>}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-8 p-6">
          <CardHeader title="Worth discussing" icon="forum" />
          <ul className="divide-y divide-line">
            {[
              `Sales: ${high(dist("sales"))}% rated 4+ vs ${high(company)}% company-wide`,
              "Customer Success: no 5 ratings across 3 managers",
              "2 people rated 2 had 10+ days blocked by other teams",
            ].map((t) => (
              <li key={t} className="py-3 flex items-center gap-3"><Icon name="flag" className="text-amber-600" /><span className="flex-1 text-body-md">{t}</span><button className="btn-secondary btn-sm" disabled>View people</button><button className="btn-ghost btn-sm" disabled>Add to agenda</button></li>
            ))}
          </ul>
        </Card>
        <Card className="col-span-12 lg:col-span-4 p-6">
          <CardHeader title="Manager consistency" icon="balance" />
          <ul className="space-y-3">
            {[["Nida Shaikh · Sales", 3.7], ["Poonam Ramesh · CS", 2.9], ["Muru Arjunan · Product", 3.3], ["Prerna Makhija · Finance", 3.2]].map(([m, avg]) => (
              <li key={m as string}>
                <p className="text-body-md">{m as string}</p>
                <div className="relative h-2 bg-surface-container rounded-full mt-2">
                  <span className="absolute -top-1 w-0.5 h-4 bg-slate-500" style={{ left: `${((3.2 - 1) / 4) * 100}%` }} title="Company average 3.2" />
                  <span className="absolute -top-1 w-4 h-4 rounded-full bg-teal border-2 border-white" style={{ left: `calc(${(((avg as number) - 1) / 4) * 100}% - 8px)` }} />
                </div>
                <p className="text-body-sm text-muted mt-1">Average {avg as number} · company 3.2</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="rounded-xl border border-line bg-white p-4 flex gap-2 text-body-md text-muted"><Icon name="info" className="text-teal" /> No forced bell curve. Use the spread to start conversations. Managers can adjust a rating with a reason, and every change is logged.</div>
    </div>
  );
}
