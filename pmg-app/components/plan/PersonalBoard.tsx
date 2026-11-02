// A person's personal (side) goals: the same quarter → month → week tree as work goals, with no approval and
// visible only to them. Server component.
import Link from "next/link";
import { Card, CardHeader, Icon } from "@/components/ui";
import { personalGoalsFor, milestonesFor, type Person } from "@/lib/repo";
import { goalProgress } from "@/lib/logic/health";
import { fmtDay, monthOfWeek, periodOf, weekName } from "@/lib/planner";
import { PeriodFilterBar, periodFilter } from "@/components/plan/PeriodFilter";
import { GoalTree } from "@/components/plan/GoalTree";

export function PersonalBoard({ person, week, quarter, month, back }: { person: Person; week?: string; quarter?: string; month?: string; back: string }) {
  const goals = personalGoalsFor(person.id).filter((g) => g.horizon === "week" || g.horizon === "month" || g.horizon === "quarter");
  const f = periodFilter({ goals, week, quarter, month, back });
  // Done this month: weeks and months in it that reached 100%.
  const inMonth = (g: (typeof goals)[number]) => (g.horizon === "week" ? monthOfWeek(g.start_date).start : g.horizon === "month" ? g.start_date : null) === f.mStart;
  const done = goals.filter((g) => inMonth(g) && goalProgress(g, milestonesFor(g.id)) >= 1);
  const thisWeek = goals.filter((g) => g.horizon === "week" && g.start_date === f.cw);

  return (
    <div className="space-y-6">
      <PeriodFilterBar f={f} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8 min-w-0">
          <GoalTree goals={goals} kind="personal" qStart={f.qStart} mStart={f.mStart} isOwner isManager={false}
            ownerFirst={person.name.split(" ")[0]} managerFirst="" back={f.href({})} />
        </div>
        <div className="col-span-12 xl:col-span-4 space-y-6">
          <Card accent="violet" className="p-6">
            <CardHeader title="This week" icon="today" iconTone="violet" />
            {thisWeek.length === 0 ? (
              <p className="text-body-md text-muted">Nothing set for this week. <Link href={`/goals/new?kind=personal&horizon=week`} className="text-teal hover:underline">Add one</Link></p>
            ) : (
              <ul className="space-y-2">
                {thisWeek.map((g) => {
                  const p = goalProgress(g, milestonesFor(g.id));
                  return (
                    <li key={g.id} className="flex items-center gap-2">
                      <Icon name={p >= 1 ? "check_circle" : "radio_button_unchecked"} fill={p >= 1} className={p >= 1 ? "text-violet text-[20px]" : "text-muted text-[20px]"} />
                      <Link href={`/goals/${g.id}`} className="text-body-md hover:text-teal flex-1">{g.title}</Link>
                      <span className="text-body-sm text-muted">{Math.round(p * 100)}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="p-6">
            <CardHeader title={`Done in ${f.monthName}`} icon="emoji_events" iconTone="violet" />
            {done.length === 0 ? <p className="text-body-md text-muted">Personal goals you finish this month show up here.</p> : (
              <ul className="space-y-3">
                {done.map((g) => (
                  <li key={g.id}><Link href={`/goals/${g.id}`} className="text-label-md hover:text-teal">{g.title}</Link>
                    <p className="text-body-sm text-muted">{g.horizon === "week" ? weekName(g.start_date) : periodOf("month", g.start_date).label} · by {fmtDay(g.due_date)}</p></li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-6">
            <div className="flex gap-3 text-body-md text-muted"><Icon name="lock" className="text-violet" />
              <p>Personal goals are yours alone. Your manager, HR, check-ins and reviews don&apos;t see them, and they need no approval.</p></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
