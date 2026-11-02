import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { Avatar, Card, CardHeader, HealthPill, Icon, PageHeader, ProgressBar, RoleBadge, cx, fmtDate, healthTone } from "@/components/ui";
import { PlanBoard } from "@/components/plan/PlanBoard";
import { chainAbove, directReports, getPerson, goalsFor, isInLine, orgBelow, peopleById, winsFor } from "@/lib/repo";
import { goalViewsFor, rollup } from "@/lib/services/views";
import { canSeeWin } from "@/lib/logic/permissions";

const DONE_NOTE: Record<string, string> = {
  approved: "Approved. They got it in chat.", edited: "Saved. PMG keeps your wording.", added: "Approved the added ticket.", assigned: "Goal set. They got it in chat.",
};

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; m?: string; week?: string; done?: string }> }) {
  const me = await requirePerson();
  const { id } = await params;
  const { q, m, week, done } = await searchParams;
  const p = getPerson(id);
  if (!p || !(isInLine(me.id, p.id) || me.role === "hr")) notFound();
  const people = peopleById();
  const direct = p.manager_id === me.id;
  const planned = goalsFor(p.id).some((g) => g.horizon);
  const goals = goalViewsFor(p.id).filter((g) => !g.horizon);
  const wins = winsFor(p.id).filter((w) => canSeeWin(me, p, w)).slice(0, 8);
  const reports = directReports(p.id);
  const org = orgBelow(p.id);
  const team = org.length ? rollup(org) : null;
  const chain = chainAbove(p.id);

  return (
    <div className="space-y-6">
      <nav className="text-body-sm text-muted flex items-center gap-1 flex-wrap">
        <Link href="/team" className="hover:text-teal">My team</Link>
        {[...chain].reverse().filter((c) => isInLine(me.id, c.id)).map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1"><Icon name="chevron_right" className="text-[16px]" /><Link href={`/team?under=${c.id}`} className="hover:text-teal">{c.name}&apos;s team</Link></span>
        ))}
        <Icon name="chevron_right" className="text-[16px]" /><span className="text-ink">{p.name}</span>
      </nav>
      <PageHeader
        title={<span className="inline-flex items-center gap-3"><Avatar name={p.name} size={44} />{p.name}</span>}
        chip={<RoleBadge role={p.role} />}
        subtitle={`${p.title} · reports to ${people.get(p.manager_id ?? "")?.name ?? "—"}${reports.length ? ` · leads ${org.length} ${org.length === 1 ? "person" : "people"}` : ""}`}
        right={<>
          {reports.length > 0 && <Link href={`/team?under=${p.id}`} className="btn-secondary"><Icon name="groups" className="text-[18px]" /> View their team</Link>}
          {direct && <Link href={`/one-on-ones?with=${p.id}`} className="btn-secondary">Open 1:1</Link>}
          {direct && <Link href={`/reviews/manager/${p.id}`} className="btn-primary">Review</Link>}
        </>} />
      {done && DONE_NOTE[done] && <div className="rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">{DONE_NOTE[done]}</div>}
      {planned && <PlanBoard person={p} viewer={me} week={week} quarter={q} month={m} back={`/team/${p.id}`} />}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {(!planned || goals.length > 0) && <Card className="p-6">
            <CardHeader title={planned ? "Other goals" : "Own goals"} icon="flag" />
            {goals.length === 0 && <p className="text-body-md text-muted">No goals yet.</p>}
            <div className="divide-y divide-line">
              {goals.map((g) => (
                <Link key={g.id} href={`/goals/${g.id}`} className="block py-4 group">
                  <div className="flex items-center gap-2"><span className="text-title-md group-hover:text-teal">{g.title}</span><HealthPill health={g.h.health} /></div>
                  <p className="text-body-sm text-muted">{g.h.reason}</p>
                  <ProgressBar value={g.h.progress * 100} tone={healthTone(g.h.health)} className="mt-2" />
                </Link>
              ))}
            </div>
          </Card>}

          {team && (
            <Card className="p-6">
              <CardHeader title={`${p.name.split(" ")[0]}'s team`} subtitle={`${reports.length} direct · ${org.length} in total · ${Math.round(team.avgProgress * 100)}% average progress`} icon="account_tree"
                right={<Link href={`/team?under=${p.id}`} className="text-label-md text-teal hover:underline">Open team view →</Link>} />
              <div className="grid grid-cols-3 gap-3 mb-5">
                <Mini label="On track" value={team.on} tone="text-[#15803D]" /><Mini label="At risk" value={team.risk} tone="text-[#B45309]" /><Mini label="Off track" value={team.off} tone="text-[#B91C1C]" />
              </div>
              <ul className="divide-y divide-line">
                {reports.map((r) => {
                  const own = goalViewsFor(r.id);
                  const below = orgBelow(r.id);
                  const sub = below.length ? rollup(below) : null;
                  const avg = own.length ? own.reduce((n, g) => n + g.h.progress, 0) / own.length : 0;
                  const worst = own.find((g) => g.h.health === "Off track") ?? own.find((g) => g.h.health === "At risk");
                  return (
                    <li key={r.id} className="py-3 grid grid-cols-[minmax(200px,1fr)_160px_auto] gap-4 items-center">
                      <Link href={`/team/${r.id}`} className="flex items-center gap-2 min-w-0 hover:text-teal"><Avatar name={r.name} size={30} /><span className="min-w-0"><span className="block text-label-md truncate">{r.name}</span><span className="block text-body-sm text-muted truncate">{r.title}</span></span></Link>
                      <span><ProgressBar value={avg * 100} tone={healthTone(worst?.h.health ?? "On track")} /><span className="text-body-sm text-muted">{Math.round(avg * 100)}% · {own.length} goal{own.length === 1 ? "" : "s"}</span></span>
                      <span className="text-right">
                        {worst ? <HealthPill health={worst.h.health} /> : <HealthPill health="On track" />}
                        {sub && <Link href={`/team?under=${r.id}`} className={cx("block text-label-sm text-teal hover:underline mt-1")}>+ team of {sub.people} · {Math.round(sub.avgProgress * 100)}% →</Link>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <Card accent="violet" className="col-span-12 lg:col-span-4 p-6 self-start">
          <CardHeader title="Shared wins" icon="celebration" iconTone="violet" />
          {wins.length === 0 && <p className="text-body-md text-muted">Nothing shared with you yet.</p>}
          <ul className="space-y-3">
            {wins.map((w) => <li key={w.id}><p className="text-label-md">{w.kind === "kudos" ? `Kudos from ${people.get(w.from_id!)?.name}: ` : ""}{w.title}</p><p className="text-body-sm text-muted">{fmtDate(w.at)}</p></li>)}
          </ul>
          <p className="text-body-sm text-muted mt-4 flex gap-1"><Icon name="lock" className="text-[16px]" /> {direct ? "Private entries stay private." : "You see what's shared with the team. Manager-only entries stay with their direct manager."}</p>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-lg bg-canvas p-3"><p className={cx("text-headline-sm", tone)}>{value}</p><p className="text-body-sm text-muted">{label}</p></div>;
}
