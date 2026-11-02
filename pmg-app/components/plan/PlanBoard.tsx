// A person's work goals for one month: a quarter and month filter, the month's weeks on top (plus earlier weeks
// that still have open work), the goals they set themselves, then the month and quarter PMG planned, with what was
// accomplished that month on the side. The employee sends drafts for approval; their manager approves, edits, sets
// week goals and accepts tickets that joined an approved week. Server component: filters are links, forms post actions.
import Link from "next/link";
import { Card, CardHeader, Icon, Pill, ProgressBar, cx, fmtDate } from "@/components/ui";
import { getPerson, goalsFor, milestonesFor, workItemsFor, type Goal, type Milestone, type Person, type WorkItem } from "@/lib/repo";
import { fmtDay, periodOf, themeName, weekName, weekNumber, weekRange, weeksOfMonth } from "@/lib/planner";
import { PeriodFilterBar, periodFilter } from "@/components/plan/PeriodFilter";
import { GoalTree } from "@/components/plan/GoalTree";
import { CONNECTORS } from "@/lib/connectors";
import { today, weekStart } from "@/lib/time";
import { approveAdditionAction, approvePlanAction, assignWeekAction, editPlanAction, requestApprovalAction, tickTaskAction } from "@/app/actions/work";
import { toggleMilestoneAction } from "@/app/actions/app";

type WeekState = "Done" | "Done late" | "In progress" | "Due" | "Yet to start" | "Nothing planned";
const STATE_STYLE: Record<WeekState, { pill: "green" | "teal" | "amber" | "slate"; icon: string; bar: "teal" | "amber" | "violet" }> = {
  Done: { pill: "green", icon: "check_circle", bar: "teal" },
  "Done late": { pill: "slate", icon: "task_alt", bar: "teal" },
  "In progress": { pill: "teal", icon: "play_circle", bar: "teal" },
  Due: { pill: "amber", icon: "schedule", bar: "amber" },
  "Yet to start": { pill: "slate", icon: "event_upcoming", bar: "violet" },
  "Nothing planned": { pill: "slate", icon: "remove", bar: "teal" },
};

const doneOf = (ms: Milestone[]) => ms.filter((m) => m.done_at).length;
const finishedOn = (ms: Milestone[]) => ms.map((m) => m.done_at ?? "").sort().pop() ?? "";
/**
 * Past weeks are Due while one of their tickets is still open, and "Done late" once those got finished afterwards.
 * A goal someone set without steps counts as one item, done when it's marked done.
 */
function weekState(ws: string, gs: Goal[], msOf: Map<number, Milestone[]>, items: Map<number, WorkItem>): WeekState {
  const cw = weekStart(today());
  if (!gs.length) return ws > cw ? "Yet to start" : "Nothing planned";
  const ms = gs.flatMap((g) => msOf.get(g.id) ?? []);
  const loose = gs.filter((g) => !msOf.get(g.id)?.length);
  if (doneOf(ms) === ms.length && loose.every((g) => (g.manual_progress ?? 0) >= 100)) return "Done";
  if (ws > cw) return "Yet to start";
  if (ws === cw) return "In progress";
  const open = loose.some((g) => (g.manual_progress ?? 0) < 100) || ms.some((m) => {
    const i = m.work_item_id ? items.get(m.work_item_id) : undefined;
    return !m.done_at && (!i || (i.status !== "done" && i.status !== "on_hold" && !i.marked_done_at));
  });
  return open ? "Due" : "Done late";
}

export function PlanBoard({ person, viewer, week, quarter: qParam, month: mParam, back }: {
  person: Person; viewer: Person; week?: string; quarter?: string; month?: string; back: string;
}) {
  const t = today();
  const cw = weekStart(t);
  const goals = goalsFor(person.id).filter((g) => g.horizon);
  const ms = new Map(goals.map((g) => [g.id, milestonesFor(g.id)]));
  const isOwner = viewer.id === person.id;
  const isManager = person.manager_id === viewer.id;
  const manager = person.manager_id ? getPerson(person.manager_id) : undefined;
  const managerFirst = manager?.name.split(" ")[0] ?? "your manager";
  const items = workItemsFor(person.id);
  const byItem = new Map(items.map((i) => [i.id, i]));
  const sources = [...new Set(items.map((i) => (i.source === "manual" ? "your own list" : CONNECTORS[i.source]?.label ?? i.source)))].join(" and ");

  const f = periodFilter({ goals, week, quarter: qParam, month: mParam, back });
  const { cm, cq, qStart, months, mStart, mPeriod, monthName, href } = f;
  const own = goals.filter((g) => g.source === "manual" && (g.horizon === "week" || g.horizon === "month" || g.horizon === "quarter"));
  const hasPlan = goals.some((g) => g.source === "ai");

  const weekGoals = goals.filter((g) => g.horizon === "week");
  const goalsOn = (ws: string) => weekGoals.filter((g) => g.start_date === ws);
  const stateOf = (ws: string) => weekState(ws, goalsOn(ws), ms, byItem);
  const monthWeeks = weeksOfMonth(mStart);
  // In the current month, earlier weeks whose tickets are still open come first, so nothing due gets lost.
  const carried = mStart === cm ? [...new Set(weekGoals.map((g) => g.start_date))].filter((ws) => ws < monthWeeks[0] && stateOf(ws) === "Due").sort() : [];
  const selected = f.week && [...carried, ...monthWeeks].includes(f.week) ? f.week : monthWeeks.includes(cw) ? cw : monthWeeks[0];
  const drafts = weekGoals.filter((g) => g.source === "ai" && (g.status === "draft" || g.status === "changes_requested") && g.due_date >= t);

  const month = goals.find((g) => g.plan_key === `month:${mStart}`);
  const quarter = goals.find((g) => g.plan_key === `quarter:${qStart}`);
  const features = goals.filter((g) => g.horizon === "feature");
  const finishedOf = (g: Goal) => { const m = ms.get(g.id)!; return m.length && doneOf(m) === m.length ? finishedOn(m) : null; };
  const featuresIn = (g?: Goal) => {
    if (!g) return [];
    const ids = new Set(ms.get(g.id)!.map((m) => m.work_item_id));
    return features.filter((f) => ms.get(f.id)!.some((m) => ids.has(m.work_item_id)))
      .sort((a, b) => Number(!!finishedOf(a)) - Number(!!finishedOf(b)) || (a.expected_date ?? a.due_date).localeCompare(b.expected_date ?? b.due_date));
  };
  const accomplished = goals.filter((g) => (g.horizon === "feature" || g.horizon === "week") && finishedOf(g) && finishedOf(g)! >= mStart && finishedOf(g)! <= mPeriod.end)
    .sort((a, b) => finishedOf(b)!.localeCompare(finishedOf(a)!)).slice(0, 8);

  const weekCard = (ws: string, early: boolean) => {
    const gs = goalsOn(ws);
    const wms = gs.flatMap((g) => ms.get(g.id)!);
    const state = stateOf(ws);
    const style = STATE_STYLE[state];
    const main = gs.find((g) => g.source === "ai") ?? gs[0];
    return (
      <Link key={ws} href={`${href({ week: ws })}#week`} scroll={false}
        className={cx("flex-1 basis-0 min-w-[150px] rounded-xl border p-4 flex flex-col gap-2 transition-colors",
          ws === selected ? "border-teal ring-2 ring-teal/20 bg-white" : early ? "border-dashed border-amber-300 bg-amber-50/40 hover:border-amber-400" : "border-line bg-white hover:border-teal/50",
          ws === cw && ws !== selected && "border-teal/60")}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-title-md">{early ? weekName(ws) : `Week ${weekNumber(ws)}`}</span>
          {ws === cw && <span className="text-label-sm text-teal">This week</span>}
        </div>
        <span className="text-body-sm text-muted -mt-1.5">{weekRange(ws)}</span>
        <Pill tone={style.pill} icon={style.icon} className="self-start">{state}</Pill>
        <p className={cx("text-body-md line-clamp-3 min-h-[66px]", !main && "text-muted")}>{main ? main.title : ws > cw ? "Nothing planned yet" : "No planned work"}</p>
        {wms.length > 0 && <>
          <ProgressBar value={(doneOf(wms) / wms.length) * 100} tone={style.bar} />
          <div className="flex items-center justify-between gap-2 text-body-sm text-muted">
            <span>{doneOf(wms)} of {wms.length} done</span>
            {main && <ApprovalMark goal={main} manager={managerFirst} compact />}
          </div>
        </>}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <PeriodFilterBar f={f} />

      <Card className="p-6">
        <CardHeader title={`Weeks of ${mPeriod.label}`} icon="view_week" subtitle={`${hasPlan ? `Planned by PMG from ${sources || "your work"}` : "Week goals"}, approved week by week by ${managerFirst}`}
          right={isOwner && drafts.length > 1 && mStart >= cm ? (
            <form action={requestApprovalAction}>
              {drafts.map((d) => <input key={d.id} type="hidden" name="goalId" value={d.id} />)}
              <input type="hidden" name="back" value={href({})} />
              <button className="btn-secondary btn-sm"><Icon name="send" className="text-[16px]" /> Send all {drafts.length} drafts to {managerFirst}</button>
            </form>
          ) : undefined} />
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {carried.length > 0 && <>
            <div className="flex flex-col gap-2 min-w-0" style={{ flex: `${carried.length} 1 0` }}>
              <span className="text-label-sm text-amber-700 inline-flex items-center gap-1"><Icon name="history" className="text-[14px]" />Still due from earlier</span>
              <div className="flex gap-3 flex-1">{carried.map((ws) => weekCard(ws, true))}</div>
            </div>
            <div className="w-px bg-line shrink-0" />
          </>}
          <div className="flex flex-col gap-2 min-w-0" style={{ flex: `${monthWeeks.length} 1 0` }}>
            {carried.length > 0 && <span className="text-label-sm text-muted">{monthName}</span>}
            <div className="flex gap-3 flex-1">{monthWeeks.map((ws) => weekCard(ws, false))}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8 space-y-6 min-w-0">
          <WeekDetail ws={selected} early={carried.includes(selected)} goals={goalsOn(selected)} ms={ms} person={person} isOwner={isOwner} isManager={isManager}
            managerFirst={managerFirst} items={items} byItem={byItem} back={href({ week: selected })} />

          <GoalTree goals={own} kind="work" qStart={qStart} mStart={mStart} isOwner={isOwner} isManager={isManager}
            ownerFirst={person.name.split(" ")[0]} managerFirst={managerFirst} back={href({})} />

          {hasPlan && <>
          <Card className="p-6">
            <CardHeader title={mPeriod.label} icon="calendar_month" subtitle={`${mStart === cm ? "This month" : mStart > cm ? "Coming up" : "Past month"} · planned by PMG`} />
            {month ? <Rollup goal={month} ms={ms.get(month.id)!} /> : <p className="text-body-md text-muted">Nothing planned for {monthName} yet.</p>}
            <ul className="mt-5 space-y-3">
              {featuresIn(month).map((f) => <FeatureRow key={f.id} goal={f} ms={ms.get(f.id)!} />)}
            </ul>
          </Card>

          <Card className="p-6">
            <CardHeader title={periodOf("quarter", qStart).label} icon="flag" subtitle={`${qStart === cq ? "This quarter" : qStart > cq ? "Coming up" : "Past quarter"} · planned by PMG`} />
            {quarter ? <Rollup goal={quarter} ms={ms.get(quarter.id)!} /> : <p className="text-body-md text-muted">Nothing planned this quarter yet.</p>}
            <div className="grid grid-cols-3 gap-3 mt-5">
              {months.map((start) => {
                const m = goals.find((g) => g.plan_key === `month:${start}`);
                const mms = m ? ms.get(m.id)! : [];
                return (
                  <Link key={start} href={href({ m: start, week: "" })}
                    className={cx("rounded-lg border p-3 transition-colors", start === mStart ? "border-teal ring-2 ring-teal/20" : "border-line hover:border-teal/50")}>
                    <p className="text-label-md">{fmtDate(start, { month: "long" })}</p>
                    <p className="text-body-sm text-muted">{mms.length ? `${doneOf(mms)} of ${mms.length} tasks done` : "Not planned yet"}</p>
                    {mms.length > 0 && <ProgressBar value={(doneOf(mms) / mms.length) * 100} className="mt-2" />}
                  </Link>
                );
              })}
            </div>
            <ul className="mt-5 divide-y divide-line">
              {featuresIn(quarter).map((f) => {
                const fms = ms.get(f.id)!;
                const done = finishedOf(f);
                const late = !done && (f.expected_date ?? f.due_date) > f.due_date;
                return (
                  <li key={f.id} className="py-2.5 flex items-center gap-3">
                    <Icon name={done ? "check_circle" : late ? "schedule" : "radio_button_unchecked"} fill={!!done} className={cx("text-[20px]", done ? "text-teal" : late ? "text-amber-600" : "text-muted")} />
                    <Link href={`/goals/${f.id}`} className="flex-1 text-body-md hover:text-teal">{f.title}</Link>
                    <span className="text-body-sm text-muted">{done ? `Done ${fmtDay(done)}` : `${doneOf(fms)} of ${fms.length} · due ${fmtDay(f.due_date)}`}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
          </>}
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-6">
          <Card accent="violet" className="p-6">
            <CardHeader title={`Accomplished in ${monthName}`} icon="emoji_events" iconTone="violet" />
            {accomplished.length === 0 ? <p className="text-body-md text-muted">{mStart > cm ? "Nothing yet; this month hasn't started." : `Weeks and features finished in ${monthName} show up here.`}</p> : (
              <ol className="relative border-l border-line ml-3 space-y-5">
                {accomplished.map((g) => {
                  const gms = ms.get(g.id)!;
                  return (
                    <li key={g.id} className="ml-5">
                      <span className={cx("absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center", g.horizon === "feature" ? "bg-violet text-white" : "bg-teal-tint text-teal")}>
                        <Icon name={g.horizon === "feature" ? "rocket_launch" : "task_alt"} className="text-[14px]" />
                      </span>
                      <Link href={`/goals/${g.id}`} className="text-label-md hover:text-teal block">{g.title}</Link>
                      <p className="text-body-sm text-muted">
                        {g.horizon === "feature" ? `Feature · ${gms.length} task${gms.length === 1 ? "" : "s"}` : `${weekName(g.start_date)} · all ${gms.length} done`} · {fmtDay(finishedOf(g)!)}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ApprovalMark({ goal, manager, compact }: { goal: Goal; manager: string; compact?: boolean }) {
  if (goal.source === "manager") return <span className="inline-flex items-center gap-1 text-violet"><Icon name="person" className="text-[14px]" />{compact ? "Set by manager" : `Set by ${manager}`}</span>;
  if (goal.status === "approved") return goal.approved_by ? <span className="inline-flex items-center gap-1 text-teal"><Icon name="verified" className="text-[14px]" />Approved</span> : null;
  if (goal.status === "pending") return <span className="inline-flex items-center gap-1 text-amber-700"><Icon name="hourglass_top" className="text-[14px]" />{compact ? "Sent" : `Waiting for ${manager}`}</span>;
  if (goal.status === "changes_requested") return <span className="inline-flex items-center gap-1 text-rose-700"><Icon name="edit_note" className="text-[14px]" />Changes asked</span>;
  return <span className="inline-flex items-center gap-1 text-muted"><Icon name="edit" className="text-[14px]" />Draft</span>;
}

function WeekDetail({ ws, early, goals, ms, person, isOwner, isManager, managerFirst, items, byItem, back }: {
  ws: string; early: boolean; goals: Goal[]; ms: Map<number, Milestone[]>; person: Person; isOwner: boolean; isManager: boolean; managerFirst: string;
  items: WorkItem[]; byItem: Map<number, WorkItem>; back: string;
}) {
  const cw = weekStart(today());
  const state = weekState(ws, goals, ms, byItem);
  const parents = new Set(items.map((i) => i.parent_key).filter(Boolean));
  const open = items.filter((i) => i.status !== "done" && i.status !== "on_hold" && !(i.external_key && parents.has(i.external_key)));
  return (
    <Card className="p-6" >
      <div id="week" className="scroll-mt-24" />
      <CardHeader title={`${early ? weekName(ws) : `Week ${weekNumber(ws)}`} · ${weekRange(ws)}`} icon="today" subtitle={ws === cw ? "This week" : ws > cw ? "Coming up" : early ? "Earlier week with open tickets" : "Past week"}
        right={<Pill tone={STATE_STYLE[state].pill} icon={STATE_STYLE[state].icon}>{state}</Pill>} />
      {goals.length === 0 && <p className="text-body-md text-muted">{ws > cw ? "Nothing planned for this week yet. New tickets show up after the next sync." : "No planned work this week."}</p>}
      <div className="space-y-6">
        {goals.map((g) => {
          const gms = ms.get(g.id)!;
          const editable = isManager && g.source === "ai";
          return (
            <div key={g.id} className="rounded-xl border border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-label-sm text-muted">
                    {g.source === "ai" ? <><Icon name="auto_awesome" className="text-[14px] text-violet" />Planned by PMG</>
                      : g.source === "manager" ? <><Icon name="person" className="text-[14px] text-violet" />Set by {managerFirst}</>
                      : <><Icon name="edit_note" className="text-[14px] text-teal" />Set by {isOwner ? "you" : person.name.split(" ")[0]}</>}
                    <span>·</span><ApprovalMark goal={g} manager={managerFirst} />
                  </div>
                  <Link href={`/goals/${g.id}`} className="text-headline-sm hover:text-teal block mt-1">{g.title}</Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isOwner && g.source !== "manager" && (g.status === "draft" || g.status === "changes_requested") && g.due_date >= today() && (g.source === "ai" || !g.parent_id) && (
                    <form action={requestApprovalAction}><input type="hidden" name="goalId" value={g.id} /><input type="hidden" name="back" value={back} />
                      <button className="btn-primary btn-sm"><Icon name="send" className="text-[16px]" /> Ask {managerFirst} to approve</button></form>
                  )}
                  {isManager && g.status !== "approved" && (
                    <form action={approvePlanAction}><input type="hidden" name="goalId" value={g.id} /><input type="hidden" name="back" value={back} />
                      <button className="btn-primary btn-sm"><Icon name="check" className="text-[16px]" /> Approve</button></form>
                  )}
                </div>
              </div>
              {editable && (
                <details className="mt-3 group">
                  <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-label-md text-teal"><Icon name="edit" className="text-[16px]" />{g.status === "approved" ? "Edit goal" : "Edit and approve"}</summary>
                  <form action={editPlanAction} className="mt-3 grid gap-3 rounded-lg bg-canvas p-4">
                    <input type="hidden" name="goalId" value={g.id} /><input type="hidden" name="back" value={back} />
                    <label><span className="label">Goal</span><input name="title" defaultValue={g.title} required className="input" /></label>
                    <input type="hidden" name="doneWhen" value={g.measure ?? ""} />
                    <div className="flex gap-2">
                      {g.status !== "approved" && <button name="approve" value="1" className="btn-primary btn-sm">Save and approve</button>}
                      <button name="approve" value="0" className="btn-secondary btn-sm">Save</button>
                    </div>
                    <p className="text-body-sm text-muted">PMG keeps your wording from now on; tickets still sync.</p>
                  </form>
                </details>
              )}
              {gms.length > 0 && (
                <>
                  <div className="flex items-center gap-3 mt-4">
                    <ProgressBar value={(doneOf(gms) / gms.length) * 100} tone={STATE_STYLE[state].bar} className="flex-1" />
                    <span className="text-body-sm text-muted">{doneOf(gms)} of {gms.length} done</span>
                  </div>
                  <ul className="mt-3 divide-y divide-line">
                    {gms.map((m) => {
                      const item = m.work_item_id ? byItem.get(m.work_item_id) : undefined;
                      const ticket = item?.external_key && item.source !== "manual" ? item : undefined;
                      const ticked = !!item?.marked_done_at && item.status !== "done";
                      const meta = [item?.parent_title && themeName(item.parent_title), item?.size ? `${item.size} pt` : null,
                        ticked ? `ticked by ${isOwner ? "you" : person.name.split(" ")[0]}; ${SOURCE_NAME[item!.source] ?? item!.source} says ${item!.status_label}` : item && !m.done_at ? item.status_label : null].filter(Boolean).join(" · ");
                      return (
                        <li key={m.id} className="py-2.5 flex flex-wrap items-center gap-3">
                          <TaskBox milestone={m} item={item} canTick={isOwner} back={back} week={ws} />
                          <div className="flex-1 min-w-56">
                            <p className={cx("text-body-md", m.done_at && "text-muted")}>{m.title}</p>
                            <p className="text-body-sm text-muted">
                              {ticket && <a href={ticket.url ?? undefined} target="_blank" rel="noreferrer" title={`Jira: ${ticket.title}`} className="text-teal hover:underline">{ticket.external_key}</a>}
                              {ticket && meta && " · "}{meta}
                              {m.note && <span className="text-amber-700">{ticket || meta ? " · " : ""}{m.note}</span>}
                            </p>
                            {m.pending_since && (
                              <div className="text-body-sm text-violet mt-0.5 flex items-center gap-2">
                                <Icon name="hourglass_top" className="text-[14px]" /> Joined after approval; waiting for {managerFirst}
                                {isManager && <form action={approveAdditionAction} className="inline"><input type="hidden" name="milestoneId" value={m.id} /><input type="hidden" name="back" value={back} /><button className="btn-ghost btn-sm text-teal">Approve</button></form>}
                              </div>
                            )}
                          </div>
                          {isOwner && !m.done_at && ws >= cw && !(item && (item.status === "done" || item.marked_done_at)) && (
                            <Link href={`/blockers?drawer=1&goalId=${g.id}&milestoneId=${m.id}&origin=milestone`} className="text-body-sm text-muted hover:text-rose-700 inline-flex items-center gap-0.5" title="Raise a blocker on this task"><Icon name="report" className="text-[16px]" />Blocked?</Link>
                          )}
                          <span className="text-body-sm text-muted w-28 text-right">{m.done_at ? `Done ${fmtDay(m.done_at)}` : m.due_date ? `Planned ${fmtDay(m.due_date)}` : ""}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          );
        })}
        {isManager && ws >= cw && (
          <details className="rounded-xl border border-dashed border-line p-4">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-label-md text-teal"><Icon name="add" className="text-[18px]" /> Set a goal for {person.name.split(" ")[0]} this week</summary>
            <form action={assignWeekAction} className="mt-3 grid gap-3">
              <input type="hidden" name="personId" value={person.id} /><input type="hidden" name="week" value={ws} /><input type="hidden" name="back" value={back} />
              <label><span className="label">Goal</span><input name="title" required className="input" placeholder="e.g. Write the cross-chat memory design note and review it with the team" /></label>
              <input type="hidden" name="doneWhen" value="" />
              {open.length > 0 && (
                <fieldset><legend className="label">Tied to tickets (optional; progress follows them)</legend>
                  <div className="grid sm:grid-cols-2 gap-1">
                    {open.map((i) => <label key={i.id} className="flex items-center gap-2 text-body-sm"><input type="checkbox" name="itemId" value={i.id} className="accent-teal" /> <span className="truncate">{i.external_key && i.source !== "manual" ? `${i.external_key} · ` : ""}{i.title}</span></label>)}
                  </div>
                </fieldset>
              )}
              <div><button className="btn-primary btn-sm">Set goal</button> <span className="text-body-sm text-muted ml-2">It&apos;s approved as you set it; {person.name.split(" ")[0]} gets it in chat.</span></div>
            </form>
          </details>
        )}
      </div>
    </Card>
  );
}

const SOURCE_NAME: Record<string, string> = { jira: "Jira", manual: "your list" };

/**
 * A task's checkbox: ticked wherever the task is done, lighter where it was done after that week. The owner ticks a
 * task off here (it counts as done from today) or unticks one they ticked; a task done in Jira stays done.
 */
export function TaskBox({ milestone: m, item, canTick, back, week, size = "sm" }: {
  milestone: Milestone; item?: WorkItem; canTick: boolean; back: string; week?: string; size?: "sm" | "md";
}) {
  const done = !!m.done_at || (!!item && (item.status === "done" || !!item.marked_done_at));
  const late = done && !m.done_at;
  const box = cx("rounded-md border flex items-center justify-center shrink-0 transition-colors", size === "md" ? "w-6 h-6" : "w-5 h-5",
    !done ? "border-slate-300 bg-white" : late ? "bg-teal/45 border-transparent text-white" : "bg-teal border-teal text-white");
  const check = done && <Icon name="check" className={size === "md" ? "text-[16px]" : "text-[14px]"} />;
  if (!item) {
    // A step on a goal someone set: its owner ticks it here.
    if (!canTick) return <span className={box}>{check}</span>;
    return (
      <form action={toggleMilestoneAction}>
        <input type="hidden" name="milestoneId" value={m.id} />
        <button className={cx(box, "cursor-pointer", done ? "hover:opacity-80" : "hover:border-teal hover:bg-teal-tint")} aria-label={done ? "Mark not done" : "Mark done"}>{check}</button>
      </form>
    );
  }
  const inJira = item.status === "done" && item.source !== "manual";
  if (!canTick || inJira) {
    return <span className={cx(box, "cursor-not-allowed")} title={inJira ? `Done in ${SOURCE_NAME[item.source] ?? item.source}` : "Only the owner ticks this off"}>{check}</span>;
  }
  return (
    <form action={tickTaskAction}>
      <input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="done" value={done ? "0" : "1"} /><input type="hidden" name="back" value={back} />
      {week && <input type="hidden" name="week" value={week} />}
      <button className={cx(box, "cursor-pointer", done ? "hover:opacity-80" : "hover:border-teal hover:bg-teal-tint")} aria-label={done ? "Mark not done" : "Mark done"}
        title={done ? "Untick" : "Tick off: done from today"}>{check}</button>
    </form>
  );
}

function Rollup({ goal, ms }: { goal: Goal; ms: Milestone[] }) {
  const done = doneOf(ms);
  return (
    <div>
      <Link href={`/goals/${goal.id}`} className="text-headline-sm hover:text-teal">{goal.title}</Link>
      <div className="flex items-center gap-3 mt-3">
        <ProgressBar value={ms.length ? (done / ms.length) * 100 : 0} className="flex-1" />
        <span className="text-body-sm text-muted">{done} of {ms.length} tasks done</span>
      </div>
    </div>
  );
}

function FeatureRow({ goal, ms }: { goal: Goal; ms: Milestone[] }) {
  const done = doneOf(ms);
  const finished = ms.length && done === ms.length ? finishedOn(ms) : null;
  const expected = goal.expected_date ?? goal.due_date;
  const late = !finished && expected > goal.due_date;
  const key = goal.plan_key?.startsWith("feature:") && !goal.plan_key.startsWith("feature:item-") ? goal.plan_key.slice(8) : null;
  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-label-sm text-muted">Feature{key ? ` · ${key}` : ""} · {weeksBetween(goal.start_date, expected)}-week plan</p>
          <Link href={`/goals/${goal.id}`} className="text-title-md hover:text-teal">{goal.title}</Link>
        </div>
        {finished ? <Pill tone="green" icon="check_circle">Done {fmtDay(finished)}</Pill>
          : late ? <Pill tone="amber" icon="schedule">Due {fmtDay(goal.due_date)} · now {fmtDay(expected)}</Pill>
          : <Pill tone="teal" icon="event">Due {fmtDay(goal.due_date)}</Pill>}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <ProgressBar value={ms.length ? (done / ms.length) * 100 : 0} tone={late ? "amber" : "teal"} className="flex-1" />
        <span className="text-body-sm text-muted">{done} of {ms.length} tasks</span>
      </div>
    </li>
  );
}

const weeksBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(weekStart(b)) - Date.parse(weekStart(a))) / (7 * 86_400_000)) + 1);
