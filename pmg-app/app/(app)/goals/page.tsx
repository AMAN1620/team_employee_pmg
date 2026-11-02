import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Card, HealthPill, Icon, PageHeader, Pill, ProgressBar, cx, fmtDate, healthTone } from "@/components/ui";
import { PlanBoard } from "@/components/plan/PlanBoard";
import { PersonalBoard } from "@/components/plan/PersonalBoard";
import { BlockerPrompts } from "@/components/blockers/BlockerPrompts";
import { MilestoneBoard } from "@/components/plan/MilestoneBoard";
import { today } from "@/lib/time";
import { getPerson, goalsFor } from "@/lib/repo";
import { goalViewsFor } from "@/lib/services/views";

const STATUS: Record<string, [string, "amber" | "slate" | "rose"]> = {
  pending: ["Waiting for approval", "amber"], draft: ["Draft", "slate"], changes_requested: ["Changes requested", "rose"],
};
const DONE_NOTE: Record<string, string> = {
  requested: "Sent. Your manager gets it in chat and can approve or edit it.",
  ticked: "Ticked off. It counts as done from today, in this week. Jira isn't changed.",
  unticked: "Unticked. PMG planned it again from today.",
};

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; m?: string; week?: string; done?: string }> }) {
  const me = await requirePerson();
  const { tab, q, m, week, done } = await searchParams;
  const personal = tab === "personal";
  // Goals from the review cycle (no week, month or quarter of their own) keep their own list under Work.
  const goals = goalViewsFor(me.id).filter((g) => !g.horizon);
  const unapproved = goalsFor(me.id).filter((g) => g.status !== "approved" && !g.horizon);
  const manager = me.manager_id ? getPerson(me.manager_id)?.name.split(" ")[0] : undefined;
  const base = personal ? "/goals?tab=personal" : "/goals";
  const tabs = (
    <div className="inline-flex rounded-lg border border-line bg-white p-1">
      <Link href="/goals" className={cx("px-3 py-1.5 rounded-md text-label-md inline-flex items-center gap-1.5", !personal ? "bg-teal text-white" : "text-muted hover:text-ink")}><Icon name="work" className="text-[16px]" />Work</Link>
      <Link href="/goals?tab=personal" className={cx("px-3 py-1.5 rounded-md text-label-md inline-flex items-center gap-1.5", personal ? "bg-violet text-white" : "text-muted hover:text-ink")}><Icon name="self_improvement" className="text-[16px]" />Personal</Link>
    </div>
  );

  // Demo: Priya's work goals are quarter milestones set by her manager (lib/demo/priya-milestones.ts).
  if (me.id === "priya" && !personal) return <MilestoneBoard today={today()} owner="you" right={tabs} />;

  return (
    <div>
      <PageHeader title="My goals"
        subtitle={personal ? "Side goals for you: set them the same way, no approval needed, and only you see them."
          : `Planned by PMG from your work and set by you. ${manager ?? "Your manager"} approves your work goals.`}
        right={<>
          {tabs}
          <Link href={`/goals/new?kind=${personal ? "personal" : "work"}`} className="btn-primary"><Icon name="add" className="text-[18px]" /> Create a goal</Link>
        </>} />

      {done && DONE_NOTE[done] && <div className="mb-6 rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">{DONE_NOTE[done]}</div>}
      {personal ? <PersonalBoard person={me} week={week} quarter={q} month={m} back={base} /> : <>
        <BlockerPrompts person={me} />
        <PlanBoard person={me} viewer={me} week={week} quarter={q} month={m} back={base} />

        {(goals.length > 0 || unapproved.length > 0) && <h2 className="section-title mt-8 mb-4">Review-cycle goals</h2>}
        {unapproved.length > 0 && (
          <Card className="p-4 mb-6">
            <p className="text-label-sm text-muted uppercase tracking-wide mb-2">Not final yet</p>
            {unapproved.map((g) => (
              <Link key={g.id} href={`/goals/${g.id}`} className="flex items-center justify-between py-2 hover:text-teal">
                <span className="text-title-md">{g.title}</span><Pill tone={STATUS[g.status][1]}>{STATUS[g.status][0]}</Pill>
              </Link>
            ))}
          </Card>
        )}
        <div className="grid gap-4">
          {goals.map((g) => (
            <Link key={g.id} href={`/goals/${g.id}`} className="card card-hover p-6 block">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-headline-sm">{g.title}</span><HealthPill health={g.h.health} /></div>
                  <p className="text-body-md text-muted mt-1">{g.h.reason}</p>
                </div>
                <div className="text-right"><div className="text-headline-sm">{Math.round(g.h.progress * 100)}%</div><div className="text-body-sm text-muted">Due {fmtDate(g.due_date)}</div></div>
              </div>
              <div className="flex items-center gap-4 mt-4"><ProgressBar value={g.h.progress * 100} tone={healthTone(g.h.health)} className="flex-1" /><span className="text-body-sm text-muted">{g.progressText}</span></div>
            </Link>
          ))}
        </div>
      </>}
    </div>
  );
}
