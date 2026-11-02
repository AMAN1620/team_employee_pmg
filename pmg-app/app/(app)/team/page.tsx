import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Avatar, Card, CardHeader, Icon, PageHeader, Pill, Stat, cx, fmtDate, fmtTime } from "@/components/ui";
import { all } from "@/lib/db";
import {
  blockersOwnedBy, blockersRaisedBy, chainAbove, chatFor, directReports, getPerson, isInLine, lastConfirmedCheckin,
  managerOneOnOnes, orgBelow, peopleById, pendingApprovals, winsFor, type Checkin, type Person,
} from "@/lib/repo";
import { goalViewsFor, rollup, type Rollup } from "@/lib/services/views";
import { canSeeWin } from "@/lib/logic/permissions";
import { daysBetween, today, weekStart } from "@/lib/time";
import { blockerAction } from "@/app/actions/app";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ under?: string; scope?: string }> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  // Managers can open any team below them; anyone else's team falls back to your own.
  const requested = sp.under ? getPerson(sp.under) : undefined;
  const subject = requested && (requested.id === me.id || isInLine(me.id, requested.id)) ? requested : me;
  const own = subject.id === me.id;
  const people = peopleById();
  const reports = directReports(subject.id);
  const org = orgBelow(subject.id);
  const deep = org.length > reports.length;
  const scope = sp.scope === "direct" || !deep ? "direct" : "org";
  const stats = rollup(scope === "org" ? org : reports);
  const path = chainAbove(subject.id).reverse();
  const trail = own ? [] : [...path.slice(path.findIndex((p) => p.id === me.id)), subject];
  const base = `/team${own ? "" : `?under=${subject.id}`}`;
  const withScope = (s: string) => `${base}${base.includes("?") ? "&" : "?"}scope=${s}`;

  const rows = reports.map((p) => {
    const below = orgBelow(p.id);
    const moods = all<Pick<Checkin, "mood">>("SELECT mood FROM checkins WHERE person_id = ? AND status = 'confirmed' ORDER BY week_of", p.id);
    const last = lastConfirmedCheckin(p.id);
    return {
      p, goals: goalViewsFor(p.id), team: below.length ? rollup(below) : null, moods: moods.map((m) => m.mood ?? 3), last,
      win: winsFor(p.id).filter((w) => w.kind !== "helped" && canSeeWin(me, p, w))[0],
      next: own ? managerOneOnOnes(me.id).find((o) => o.employee_id === p.id && o.scheduled_at.slice(0, 10) >= today()) : undefined,
      openBlockers: blockersRaisedBy(p.id).filter((b) => b.status !== "resolved"),
      missed: !last || last.week_of < weekStart(today()),
      dueToday: chatFor(p.id).some((m) => m.kind === "checkin_prompt" && !m.handled && m.at.slice(0, 10) === today()),
    };
  });

  return (
    <div className="space-y-6">
      {trail.length > 0 && (
        <nav className="text-body-sm text-muted flex items-center gap-1 flex-wrap">
          {trail.map((p, i) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              {i > 0 && <Icon name="chevron_right" className="text-[16px]" />}
              {i < trail.length - 1 ? <Link href={p.id === me.id ? "/team" : `/team?under=${p.id}`} className="hover:text-teal">{p.id === me.id ? "My team" : `${p.name}'s team`}</Link> : <span className="text-ink">{p.name}&apos;s team</span>}
            </span>
          ))}
        </nav>
      )}
      <PageHeader
        title={own ? "My team" : <span className="inline-flex items-center gap-3"><Avatar name={subject.name} size={40} />{subject.name}&apos;s team</span>}
        subtitle={`${own ? "" : `${subject.title} · `}${reports.length} direct report${reports.length === 1 ? "" : "s"}${deep ? ` · ${org.length} people in total` : ""} · ${new Date(today()).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`}
        right={deep ? (
          <div className="inline-flex rounded-lg border border-line bg-white p-1">
            <Link href={withScope("direct")} className={cx("px-3 py-1.5 rounded-md text-label-md", scope === "direct" ? "bg-teal text-white" : "text-muted")}>Direct reports</Link>
            <Link href={withScope("org")} className={cx("px-3 py-1.5 rounded-md text-label-md", scope === "org" ? "bg-teal text-white" : "text-muted")}>Whole org ({org.length})</Link>
          </div>
        ) : undefined} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="label">Goal health · {scope === "org" ? "whole org" : "direct reports"}</p>
          <p className="text-body-md"><b>{stats.on}</b> on track · <b className="text-amber-700">{stats.risk}</b> at risk · <b className="text-red-700">{stats.off}</b> off track</p>
          <HealthBar r={stats} className="mt-3" />
          <p className="text-body-sm text-muted mt-2">Average progress {Math.round(stats.avgProgress * 100)}%</p>
        </div>
        <Stat label="Open blockers" value={stats.openBlockers} sub={own ? `${blockersOwnedBy(me.id).filter((b) => b.status !== "resolved").length} waiting on you` : undefined} icon="report" />
        <Stat label="Check-ins this week" value={`${stats.checkedIn} of ${stats.people}`} icon="fact_check" />
        <Stat label="Mid-year review" value={`${stats.selfDone} of ${stats.people}`} sub="self-reviews in" icon="workspace_premium" />
      </div>

      {own && <Attention me={me} rows={rows} people={people} />}

      <Card className="overflow-hidden">
        <div className="px-6 pt-6"><CardHeader title={own ? "Direct reports" : `${subject.name.split(" ")[0]}'s direct reports`} icon="groups" /></div>
        <table className="w-full text-left">
          <thead className="bg-canvas text-label-sm text-muted uppercase tracking-wide">
            <tr>{["Person", "Own goals", "Their team", "Blockers", "Last check-in", "Mood", own ? "Next 1:1" : "Recent win", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.p.id} className="hover:bg-canvas/60 align-top">
                <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={r.p.name} size={32} /><div><p className="text-label-md">{r.p.name}</p><p className="text-body-sm text-muted">{r.p.title}</p></div></div></td>
                <td className="px-4 py-3"><Dots goals={r.goals} /></td>
                <td className="px-4 py-3 min-w-[180px]">
                  {r.team ? (
                    <Link href={`/team?under=${r.p.id}`} className="block group">
                      <span className="text-body-sm"><b>{r.team.people}</b> {r.team.people === 1 ? "person" : "people"} · {Math.round(r.team.avgProgress * 100)}% avg</span>
                      <HealthBar r={r.team} className="mt-1 w-36" />
                      <span className="text-label-sm text-teal group-hover:underline">View team →</span>
                    </Link>
                  ) : <span className="text-body-sm text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-body-md">{r.openBlockers.length || "—"}</td>
                <td className="px-4 py-3">{r.missed && r.dueToday ? <Pill tone="slate" icon="schedule">Due today</Pill> : r.missed ? <Pill tone="amber" icon="schedule">Missed</Pill> : <span className="text-body-md">{fmtDate(r.last!.submitted_at)}</span>}</td>
                <td className="px-4 py-3"><Sparkline values={r.moods.slice(-7)} /></td>
                <td className="px-4 py-3 text-body-sm max-w-[200px] truncate">{own ? (r.next ? `${fmtDate(r.next.scheduled_at, { weekday: "short", day: "numeric" })}, ${fmtTime(r.next.scheduled_at)}` : "—") : r.win?.title ?? "—"}</td>
                <td className="px-4 py-3 text-right"><Link href={`/team/${r.p.id}`} className="btn-ghost btn-sm text-teal">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-6 py-3 text-body-sm text-muted border-t border-line flex items-center gap-1"><Icon name="lock" className="text-[16px]" /> Everyone above someone in the reporting line sees their goals and progress. 1:1s, private wins and reviews stay with their direct manager.</p>
      </Card>

      {deep && (
        <Card className="p-6">
          <CardHeader title="Progress through the org" subtitle="Each leader's whole team, rolled up. Open any team to drill down." icon="account_tree" />
          <OrgTree managerId={subject.id} depth={0} />
        </Card>
      )}
    </div>
  );
}

/** Leaders below a manager, each with the rolled-up progress of everyone under them. */
function OrgTree({ managerId, depth }: { managerId: string; depth: number }) {
  const leaders = directReports(managerId).filter((p) => directReports(p.id).length > 0);
  if (!leaders.length) return null;
  return (
    <ul className={cx(depth > 0 && "ml-6 border-l border-line pl-4")}>
      {leaders.map((p) => {
        const r = rollup(orgBelow(p.id));
        return (
          <li key={p.id} className="py-2">
            <Link href={`/team?under=${p.id}`} className="grid grid-cols-[minmax(220px,1fr)_160px_200px_90px] gap-4 items-center rounded-lg p-2 hover:bg-canvas">
              <span className="flex items-center gap-2 min-w-0"><Avatar name={p.name} size={28} /><span className="min-w-0"><span className="block text-label-md truncate">{p.name}</span><span className="block text-body-sm text-muted truncate">{p.title}</span></span></span>
              <span className="text-body-sm">{r.people} {r.people === 1 ? "person" : "people"} · {r.goals.length} goal{r.goals.length === 1 ? "" : "s"}</span>
              <span><HealthBar r={r} /><span className="text-body-sm text-muted">{r.on} on track · {r.risk + r.off} need attention</span></span>
              <span className="text-title-md text-right">{Math.round(r.avgProgress * 100)}%</span>
            </Link>
            <OrgTree managerId={p.id} depth={depth + 1} />
          </li>
        );
      })}
    </ul>
  );
}

function Attention({ me, rows, people }: { me: Person; rows: { p: Person; goals: ReturnType<typeof goalViewsFor> }[]; people: Map<string, Person> }) {
  const approvals = pendingApprovals(me.id);
  const waitingOnMe = blockersOwnedBy(me.id).filter((b) => b.status !== "resolved");
  const feedbackMoments = chatFor(me.id).filter((m) => m.kind === "feedback_request" && !m.handled);
  const escalations = chatFor(me.id).filter((m) => m.kind === "escalation" && !m.handled);
  const atRisk = rows.flatMap((r) => r.goals.filter((g) => g.h.health !== "On track").map((g) => ({ r, g })));
  const highlights = rows.map((r) => winsFor(r.p.id).filter((w) => w.kind !== "helped" && canSeeWin(me, r.p, w))[0]).filter(Boolean).sort((a, b) => b!.at.localeCompare(a!.at)).slice(0, 3);
  const upcoming = managerOneOnOnes(me.id).filter((o) => o.scheduled_at.slice(0, 10) >= today());
  const items = approvals.length + waitingOnMe.length + feedbackMoments.length + escalations.length + atRisk.length;
  return (
    <div className="grid grid-cols-12 gap-6">
      <Card className="col-span-12 lg:col-span-8 p-6">
        <CardHeader title="Needs your attention" icon="priority_high" iconTone="amber" right={<Pill tone="slate">{items}</Pill>} />
        {items === 0 && <p className="text-body-md text-muted">Nothing needs you right now.</p>}
        <ul className="divide-y divide-line">
          {approvals.map((g) => <Item key={`g${g.id}`} icon="approval" kind="Goal approval" who={people.get(g.owner_id)!.name} text={g.title} action={<Link href={`/approvals/${g.id}`} className="btn-primary btn-sm">Review</Link>} />)}
          {escalations.map((m) => <Item key={`e${m.id}`} icon="trending_up" kind="Escalated to you" who="" text={m.body} action={<Link href="/blockers?tab=waiting" className="btn-secondary btn-sm">Open</Link>} />)}
          {waitingOnMe.map((b) => (
            <Item key={`b${b.id}`} icon="report" kind="Blocker waiting on you" who={people.get(b.raised_by)!.name} text={`${b.title} · open ${daysBetween(b.opened_at, today())} days`}
              action={<form action={blockerAction}><input type="hidden" name="blockerId" value={b.id} /><input type="hidden" name="op" value={b.status === "accepted" ? "resolve" : "accept"} /><button className="btn-secondary btn-sm">{b.status === "accepted" ? "Resolve" : "Respond"}</button></form>} />
          ))}
          {atRisk.map(({ r, g }) => (
            <Item key={`r${g.id}`} icon="warning" kind="At-risk goal" who={r.p.name} text={`${g.title} · ${g.blockers.some((b) => b.status !== "resolved") ? `blocked ${g.daysBlocked} days` : g.h.reason.replace(/^[^:]+: /, "")}`}
              action={<Link href={`/one-on-ones?with=${r.p.id}`} className="btn-secondary btn-sm">Add to 1:1</Link>} />
          ))}
          {feedbackMoments.map((m) => {
            const d = JSON.parse(m.data) as { personId?: string; goalId?: number; milestone?: string };
            return <Item key={`f${m.id}`} icon="rate_review" kind="Feedback moment" who={people.get(d.personId ?? "")?.name ?? ""} text={m.body}
              action={<Link href={`/feedback?give=${d.personId}&goalId=${d.goalId ?? ""}&about=${encodeURIComponent(d.milestone ?? "")}`} className="btn-kudos btn-sm">Give quick feedback</Link>} />;
          })}
        </ul>
      </Card>
      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Card accent="violet" className="p-6">
          <CardHeader title="This week's highlights" icon="celebration" iconTone="violet" />
          <ul className="space-y-3">{highlights.map((w) => <li key={w!.id} className="flex gap-2"><Avatar name={people.get(w!.person_id)?.name ?? ""} size={26} /><div><p className="text-label-md">{w!.title}</p><p className="text-body-sm text-muted">{people.get(w!.person_id)?.name} · {fmtDate(w!.at)}</p></div></li>)}</ul>
          {highlights.length === 0 && <p className="text-body-md text-muted">No shared wins this week yet.</p>}
        </Card>
        <Card className="p-6">
          <CardHeader title="Upcoming 1:1s" icon="forum" />
          <ul className="space-y-2">
            {upcoming.map((o) => (
              <li key={o.id}><Link href={`/one-on-ones?with=${o.employee_id}`} className="flex items-center gap-2 hover:text-teal"><Avatar name={people.get(o.employee_id)?.name ?? ""} size={26} /><span className="text-label-md flex-1">{people.get(o.employee_id)?.name}</span>
                <span className="text-body-sm text-muted">{o.scheduled_at.slice(0, 10) === today() ? "Today" : fmtDate(o.scheduled_at, { weekday: "short", day: "numeric" })}, {fmtTime(o.scheduled_at)}</span></Link></li>
            ))}
          </ul>
          {upcoming.length === 0 && <p className="text-body-md text-muted">None scheduled.</p>}
        </Card>
      </div>
    </div>
  );
}

function Item({ icon, kind, who, text, action }: { icon: string; kind: string; who: string; text: string; action: React.ReactNode }) {
  return (
    <li className="py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-surface-container-low text-teal flex items-center justify-center shrink-0"><Icon name={icon} /></div>
      <div className="flex-1 min-w-0"><p className="text-label-sm text-muted uppercase tracking-wide">{kind}{who && ` · ${who}`}</p><p className="text-body-md truncate">{text}</p></div>
      {action}
    </li>
  );
}

function HealthBar({ r, className }: { r: Pick<Rollup, "on" | "risk" | "off">; className?: string }) {
  const total = Math.max(1, r.on + r.risk + r.off);
  return (
    <div className={cx("flex h-2 rounded-full overflow-hidden bg-surface-container", className)} aria-label={`${r.on} on track, ${r.risk} at risk, ${r.off} off track`}>
      <div className="bg-[#15803D]" style={{ width: `${(r.on / total) * 100}%` }} /><div className="bg-[#B45309]" style={{ width: `${(r.risk / total) * 100}%` }} /><div className="bg-[#B91C1C]" style={{ width: `${(r.off / total) * 100}%` }} />
    </div>
  );
}

function Dots({ goals }: { goals: ReturnType<typeof goalViewsFor> }) {
  return (
    <div className="flex items-center gap-1.5">
      {(["On track", "At risk", "Off track"] as const).map((h) => {
        const c = goals.filter((g) => g.h.health === h).length;
        return c ? <span key={h} className="inline-flex items-center gap-0.5 text-body-sm"><span className={cx("w-2.5 h-2.5 rounded-full", h === "On track" ? "bg-[#15803D]" : h === "At risk" ? "bg-[#B45309]" : "bg-[#B91C1C]")} />{c}</span> : null;
      })}
      {goals.length === 0 && <span className="text-body-sm text-muted">—</span>}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-muted">—</span>;
  const w = 64, h = 22;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - 1) / 4) * h}`).join(" ");
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={w} height={h} aria-label={`Weekly score trend, latest ${values[values.length - 1]} of 5`}><polyline points={pts} fill="none" stroke="#0F766E" strokeWidth="2" strokeLinejoin="round" /></svg>
      <span className="text-body-sm text-muted">{values[values.length - 1]}/5</span>
    </span>
  );
}
