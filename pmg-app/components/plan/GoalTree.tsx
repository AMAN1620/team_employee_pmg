// The goals someone set themselves in one quarter, as a tree: quarter goals with their months and weeks inside,
// then months and weeks that aren't inside a bigger goal. The owner adds goals inside one, sends drafts to their
// manager and ticks off weeks from here; the manager opens what's waiting for them.
import Link from "next/link";
import { Card, CardHeader, Icon, Pill, ProgressBar, cx } from "@/components/ui";
import { goalProgress } from "@/lib/logic/health";
import { milestonesFor, type Goal } from "@/lib/repo";
import { monthOfWeek, periodOf, quarterOfWeek, weekName, weekRange } from "@/lib/planner";
import { goalProgressAction } from "@/app/actions/app";
import { requestApprovalAction } from "@/app/actions/work";

const ORDER = { quarter: 0, month: 1, week: 2 } as Record<string, number>;
const BELOW: Record<string, { horizon: string; label: string } | undefined> = { quarter: { horizon: "month", label: "monthly" }, month: { horizon: "week", label: "weekly" } };
const ICON: Record<string, string> = { quarter: "flag", month: "calendar_month", week: "view_week" };

export const quarterOfGoal = (g: Pick<Goal, "horizon" | "start_date">) => (g.horizon === "week" ? quarterOfWeek(g.start_date).start : periodOf("quarter", g.start_date).start);
const monthOfGoal = (g: Pick<Goal, "horizon" | "start_date">) => (g.horizon === "week" ? monthOfWeek(g.start_date).start : g.horizon === "month" ? g.start_date : null);

function periodText(g: Goal) {
  if (g.horizon === "quarter") return periodOf("quarter", g.start_date).label;
  if (g.horizon === "month") return periodOf("month", g.start_date).label;
  return `${weekName(g.start_date)} · ${weekRange(g.start_date)}`;
}

export function GoalTree({ goals, kind, qStart, mStart, isOwner, isManager, ownerFirst, managerFirst, back }: {
  goals: Goal[]; kind: "work" | "personal"; qStart: string; mStart: string; isOwner: boolean; isManager: boolean;
  ownerFirst: string; managerFirst: string; back: string;
}) {
  const ids = new Set(goals.map((g) => g.id));
  const inside = (id: number) => goals.filter((g) => g.parent_id === id).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const roots = goals.filter((g) => quarterOfGoal(g) === qStart && !(g.parent_id && ids.has(g.parent_id)))
    .sort((a, b) => ORDER[a.horizon!] - ORDER[b.horizon!] || a.start_date.localeCompare(b.start_date) || a.id - b.id);
  const qLabel = periodOf("quarter", qStart).label.split(" (")[0];
  const create = (horizon: string, extra = "") => `/goals/new?kind=${kind}&horizon=${horizon}${extra}`;
  const parentWaiting = (g: Goal) => { const p = g.parent_id ? goals.find((x) => x.id === g.parent_id) : undefined; return !!p && p.status !== "approved"; };

  const status = (g: Goal) => {
    if (kind === "personal") return null;
    if (g.status === "approved") return <Pill tone="green" icon="verified">Approved</Pill>;
    if (g.status === "pending") return <Pill tone="amber" icon="hourglass_top">Waiting for {managerFirst}</Pill>;
    if (g.status === "changes_requested") return <Pill tone="red" icon="edit_note">Changes asked</Pill>;
    return <Pill tone="slate" icon="edit">Draft</Pill>;
  };

  const node = (g: Goal) => {
    const ms = milestonesFor(g.id);
    const progress = goalProgress(g, ms);
    const kids = inside(g.id);
    const below = BELOW[g.horizon!];
    const here = monthOfGoal(g) === mStart;
    const tickable = isOwner && g.horizon === "week" && !ms.length && !kids.length && g.status === "approved";
    const sendable = isOwner && kind === "work" && (g.status === "draft" || g.status === "changes_requested") && !parentWaiting(g);
    const startForChild = g.horizon === "month" ? "" : `&start=${g.start_date}`;
    return (
      <li key={g.id}>
        <div className={cx("rounded-xl border p-4 bg-white", here ? "border-teal/40" : "border-line")}>
          <div className="flex items-start gap-3">
            <span className={cx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", g.horizon === "quarter" || kind === "personal" ? "bg-violet-tint text-violet" : "bg-teal-tint text-teal")}>
              <Icon name={ICON[g.horizon!]} className="text-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-label-sm text-muted">{periodText(g)}</p>
              <Link href={isManager && g.status === "pending" ? `/approvals/${g.id}` : `/goals/${g.id}`} className={cx("text-title-md hover:text-teal block", progress >= 1 && "text-muted line-through decoration-1")}>{g.title}</Link>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {status(g)}
              {tickable && (
                <form action={goalProgressAction}>
                  <input type="hidden" name="goalId" value={g.id} /><input type="hidden" name="value" value={progress >= 1 ? 0 : 100} />
                  <button className={cx("btn-sm", progress >= 1 ? "btn-ghost text-teal" : "btn-secondary")}><Icon name={progress >= 1 ? "check_circle" : "check"} className="text-[16px]" />{progress >= 1 ? "Done" : "Mark done"}</button>
                </form>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <ProgressBar value={progress * 100} tone={kind === "personal" ? "violet" : "teal"} className="flex-1" />
            <span className="text-body-sm text-muted w-28 text-right">
              {kids.length ? `${Math.round(progress * 100)}% · ${kids.length} ${below?.label ?? ""} goal${kids.length === 1 ? "" : "s"}` : ms.length ? `${ms.filter((m) => m.done_at).length} of ${ms.length} steps` : `${Math.round(progress * 100)}%`}
            </span>
          </div>
          {(sendable || (isOwner && below)) && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {isOwner && below && <Link href={create(below.horizon, `&parent=${g.id}${startForChild}`)} className="text-label-md text-teal hover:underline inline-flex items-center gap-1"><Icon name="add" className="text-[16px]" />Add a {below.label} goal</Link>}
              {sendable && (
                <form action={requestApprovalAction} className="ml-auto">
                  <input type="hidden" name="goalId" value={g.id} /><input type="hidden" name="back" value={back} />
                  <button className="btn-primary btn-sm"><Icon name="send" className="text-[16px]" />Send to {managerFirst}{kids.some((k) => k.status !== "approved") ? " with what's inside" : ""}</button>
                </form>
              )}
            </div>
          )}
        </div>
        {kids.length > 0 && <ul className="ml-4 pl-4 border-l-2 border-line mt-3 space-y-3">{kids.map(node)}</ul>}
      </li>
    );
  };

  return (
    <Card className="p-6">
      <CardHeader title={`${isOwner ? "Goals you set" : `Goals ${ownerFirst} set`} · ${qLabel}`} icon={kind === "personal" ? "self_improvement" : "account_tree"} iconTone={kind === "personal" ? "violet" : undefined}
        subtitle={kind === "personal" ? "Only you can see these. No approval needed."
          : `Quarter and month goals go to ${isOwner ? managerFirst : "you"} for approval; weeks inside an approved goal are covered by it.`}
        right={isOwner ? <Link href={create("week")} className="btn-secondary btn-sm"><Icon name="add" className="text-[16px]" /> Create a goal</Link> : undefined} />
      {roots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-6 text-center">
          <p className="text-body-md text-muted">{isOwner ? `No ${kind} goals for ${qLabel} yet. Start big and break it down, or start with this week and build up.` : `${ownerFirst} hasn't set any for ${qLabel}.`}</p>
          {isOwner && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Link href={create("quarter")} className="btn-secondary btn-sm"><Icon name="flag" className="text-[16px]" /> A quarter goal</Link>
              <Link href={create("month")} className="btn-secondary btn-sm"><Icon name="calendar_month" className="text-[16px]" /> A month goal</Link>
              <Link href={create("week")} className="btn-primary btn-sm"><Icon name="view_week" className="text-[16px]" /> A goal for this week</Link>
            </div>
          )}
        </div>
      ) : <ul className="space-y-3">{roots.map(node)}</ul>}
      {roots.length > 0 && isOwner && (
        <p className="text-body-sm text-muted mt-4">Started with weeks? Create a month goal and pick them to gather them into it.</p>
      )}
    </Card>
  );
}
