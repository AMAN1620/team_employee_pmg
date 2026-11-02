import { requirePerson } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { getPerson, ownPlanGoals, teamGoals } from "@/lib/repo";
import { goalPeriods, periodOf, weekName, weekRange } from "@/lib/planner";
import { today } from "@/lib/time";
import { NewGoalForm, type FormGoal } from "./NewGoalForm";

export default async function NewGoalPage({ searchParams }: { searchParams: Promise<{ kind?: string; horizon?: string; start?: string; parent?: string }> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  const manager = me.manager_id ? getPerson(me.manager_id) : undefined;
  const periods = goalPeriods(today());
  const options = {
    week: periods.week.map((w, i) => ({ value: w, label: `${i === 0 ? "This week · " : i === 1 ? "Next week · " : ""}${weekName(w)} · ${weekRange(w)}` })),
    month: periods.month.map((m, i) => ({ value: m, label: `${periodOf("month", m).label}${i === 0 ? " · this month" : ""}` })),
    quarter: periods.quarter.map((q, i) => ({ value: q, label: `${periodOf("quarter", q).label}${i === 0 ? " · this quarter" : ""}` })),
  };
  const own: FormGoal[] = ownPlanGoals(me.id).map((g) => ({ id: g.id, title: g.title, kind: g.kind, horizon: g.horizon as FormGoal["horizon"], start_date: g.start_date, status: g.status, parent_id: g.parent_id }));
  const parent = own.find((g) => g.id === Number(sp.parent));
  const kind = parent?.kind ?? (sp.kind === "personal" ? "personal" : "work");
  const horizon = (["week", "month", "quarter"].includes(sp.horizon ?? "") ? sp.horizon : parent ? (parent.horizon === "quarter" ? "month" : "week") : "week") as FormGoal["horizon"];
  const team = teamGoals().filter((g) => g.team_id === me.team_id).map((g) => ({ id: g.id, title: g.title }));
  const managerFirst = manager?.name.split(" ")[0] ?? "your manager";
  return (
    <div>
      <PageHeader title="Create a goal" subtitle={`Set it for a week, a month or a quarter. Work goals go to ${managerFirst} for approval; personal goals are just for you.`} />
      <NewGoalForm options={options} own={own} teamGoals={team} managerFirst={managerFirst}
        initial={{ kind, horizon, start: sp.start ?? "", parentId: parent?.id ?? null }} />
    </div>
  );
}
