import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Avatar, BlockerPill, Card, Empty, Icon, PageHeader, Pill, Stat, Tabs, cx, fmtDate } from "@/components/ui";
import { all, get } from "@/lib/db";
import { blockersOwnedBy, blockersRaisedBy, getGoal, goalsFor, isClosedPlan, isFuturePlan, listPeople, listTeams, milestonesFor, peopleById, winsFor, type Blocker, type Person } from "@/lib/repo";
import { CHANNEL_LABEL, blockerDays, blockerReminders, categoryOf, daysOverdue, displayStatus, shouldSuggestEscalation } from "@/lib/logic/blocked";
import { notifyChannel, outboxFor, teamsWithHeads } from "@/lib/services/blockers";
import { addDays, addWorkdays, today } from "@/lib/time";
import { blockerAction } from "@/app/actions/app";
import { BlockerForm } from "@/components/blockers/BlockerForm";
import { BlockerPrompts } from "@/components/blockers/BlockerPrompts";

const ORIGIN: Record<string, string> = { goal: "from a goal", milestone: "from a milestone", overdue_task: "from an overdue task", nudge: "after PMG's nudge", checkin: "from a check-in", agent: "from a chat with the goal agent" };
const CHANNEL_ICON: Record<string, string> = { slack: "tag", google_chat: "forum", email: "mail", calendar: "calendar_month" };

type SP = { tab?: string; drawer?: string; goalId?: string; milestoneId?: string; origin?: string; raised?: string; open?: string };

export default async function BlockersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  const people = peopleById();
  const raised = blockersRaisedBy(me.id);
  const owned = blockersOwnedBy(me.id).filter((b) => b.raised_by !== me.id);
  const escalated = all<Blocker>("SELECT * FROM blockers WHERE escalated_to = ? AND status != 'resolved'", me.id);
  const tab = sp.tab ?? (me.role === "manager" && owned.some((b) => b.status !== "resolved") ? "waiting" : "raised");
  const t = today();

  // Blockers raised together (one per person or team tagged) show as one item.
  const groups = (list: Blocker[]) => {
    const map = new Map<string, Blocker[]>();
    for (const b of list) map.set(b.group_key ?? `b${b.id}`, [...(map.get(b.group_key ?? `b${b.id}`) ?? []), b]);
    return [...map.values()];
  };
  const openRaised = groups(raised.filter((b) => b.status !== "resolved" || raised.some((x) => x.group_key && x.group_key === b.group_key && x.status !== "resolved")));
  const waiting = [...owned.filter((b) => b.status !== "resolved"), ...escalated.filter((e) => e.owner_id !== me.id && e.raised_by !== me.id)].map((b) => [b]);
  const resolved = groups([...raised, ...owned].filter((b) => b.status === "resolved" && !raised.some((x) => x.group_key && x.group_key === b.group_key && x.status !== "resolved")))
    .sort((a, b) => (b[0].resolved_at ?? "").localeCompare(a[0].resolved_at ?? ""));
  const resolvedTimes = raised.filter((b) => b.resolved_at).map((b) => blockerDays(b, t));
  const avg = resolvedTimes.length ? (resolvedTimes.reduce((a, b) => a + b, 0) / resolvedTimes.length).toFixed(1) : "–";
  const helped = winsFor(me.id).filter((w) => w.kind === "helped").length;
  const list = tab === "waiting" ? waiting : tab === "resolved" ? resolved : openRaised;
  const tabHref = (x: string) => `/blockers?tab=${x}`;
  const teams = new Map(listTeams().map((x) => [x.id, x.name]));
  const channel = notifyChannel();

  // The form's choices: people (not me), teams with their heads, and my current goals with their milestones.
  const formGoals = goalsFor(me.id).filter((g) => !isClosedPlan(g) && !isFuturePlan(g) && g.horizon !== "month" && g.horizon !== "quarter")
    .map((g) => ({ id: g.id, title: g.title, milestones: milestonesFor(g.id).filter((m) => !m.done_at).map((m) => ({ id: m.id, title: m.title })) }));
  const manager = me.manager_id ? people.get(me.manager_id) : undefined;

  return (
    <div className={sp.drawer ? "pr-[480px]" : ""}>
      <PageHeader title="Blockers" subtitle="Get unstuck faster. Time spent blocked is recorded on your goal."
        right={<Link href={`/blockers?tab=${tab}&drawer=1`} className="btn-primary"><Icon name="add" className="text-[18px]" /> Raise a blocker</Link>} />
      {sp.raised && (
        <div className="mb-6 rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">
          {Number(sp.raised) > 1 ? `Blocker raised and sent to ${sp.raised} people.` : "Blocker raised."} It&apos;s in their PMG chat now with Accept, Need info and Not me. The {CHANNEL_LABEL[channel]} message and email are mocked: open the blocker to see what would be sent.
        </div>
      )}

      <BlockerPrompts person={me} />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Open blockers" value={openRaised.length} icon="report" />
        <Stat label="Average time to resolve" value={`${avg} days`} icon="timer" />
        <Stat label="Blockers you cleared for others" value={helped} tone="violet" icon="volunteer_activism" sub="Counts as recognized work" />
      </div>

      <Tabs active={tab} tabs={[
        { key: "raised", label: `Raised by me (${openRaised.length})`, href: tabHref("raised") },
        { key: "waiting", label: `Waiting on me (${waiting.length})`, href: tabHref("waiting") },
        { key: "resolved", label: `Resolved (${resolved.length})`, href: tabHref("resolved") },
      ]} />

      <Card className="overflow-hidden">
        {list.length === 0 && <Empty icon="task_alt" title="Nothing here">{tab === "waiting" ? "No one is waiting on you." : "No blockers."}</Empty>}
        <ul className="divide-y divide-line">
          {list.map((group) => (
            <BlockerItem key={group[0].group_key ?? group[0].id} group={group} me={me} people={people} teams={teams} open={group.some((b) => String(b.id) === sp.open)} />
          ))}
        </ul>
      </Card>

      {sp.drawer && (
        <aside className="fixed top-16 right-0 bottom-0 w-[460px] bg-white border-l border-line shadow-pop z-30 overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-line">
            <div><h2 className="section-title">Raise a blocker</h2>{sp.origin && ORIGIN[sp.origin] && <p className="text-body-sm text-muted">Raising it {ORIGIN[sp.origin]}</p>}</div>
            <Link href={`/blockers?tab=${tab}`} className="btn-ghost btn-sm" aria-label="Close"><Icon name="close" /></Link>
          </div>
          <BlockerForm me={me.name} manager={manager ? { id: manager.id, name: manager.name } : null} channel={channel}
            people={listPeople().filter((p) => p.id !== me.id).map((p) => ({ id: p.id, name: p.name, title: p.title, team: teams.get(p.team_id ?? "") ?? "" }))}
            teams={teamsWithHeads().filter((x) => x.head!.id !== me.id).map((x) => ({ id: x.id, name: x.name, head: x.head!.name }))}
            goals={formGoals} cancelHref={`/blockers?tab=${tab}`}
            initial={{
              goalId: sp.goalId ? Number(sp.goalId) : null, milestoneId: sp.milestoneId ? Number(sp.milestoneId) : null,
              origin: sp.origin ?? (sp.milestoneId ? "milestone" : sp.goalId ? "goal" : "page"), title: "", needBy: addWorkdays(addDays(t, 1), 2),
            }} />
        </aside>
      )}
    </div>
  );
}

function BlockerItem({ group, me, people, teams, open }: { group: Blocker[]; me: Person; people: Map<string, Person>; teams: Map<string, string>; open: boolean }) {
  const t = today();
  const b = group[0];
  const mine = b.raised_by === me.id;
  const goal = b.goal_id ? getGoal(b.goal_id) : undefined;
  const milestone = b.milestone_id ? get<{ title: string }>("SELECT title FROM milestones WHERE id = ?", b.milestone_id)?.title : undefined;
  const cat = categoryOf(b.category);
  const allResolved = group.every((x) => x.status === "resolved");
  const tracked = group.length === 1 && b.owner_id === b.raised_by; // "None" or "no one yet"
  const sent = outboxFor(group.map((x) => x.id));
  const reminders = blockerReminders({ ...b, owner_id: tracked ? b.raised_by : b.owner_id }, t);
  const teamMembers = (teamId: string) => [...people.values()].filter((p) => p.team_id === teamId && p.id !== me.id && p.id !== b.raised_by);

  return (
    <li id={`b${b.id}`} className="p-5 scroll-mt-24">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {cat && <Pill tone="slate" icon={cat.icon}>{cat.label}</Pill>}
            {b.origin && ORIGIN[b.origin] && <span className="text-body-sm text-muted">Raised {ORIGIN[b.origin]}</span>}
            {!mine && <span className="text-body-sm text-muted">· by {people.get(b.raised_by)?.name}</span>}
          </div>
          <p className="text-title-md mt-1">{b.title}</p>
          {goal && <p className="text-body-sm text-muted mt-0.5">Affects: <Link href={`/goals/${goal.id}`} className="hover:text-teal">{goal.title}</Link>{milestone ? ` · ${milestone}` : ""}</p>}
          {b.needed && <p className="text-body-md mt-1"><span className="text-muted">Needed:</span> {b.needed}</p>}
        </div>
        <div className="text-body-sm text-right">
          {b.need_by && <p>Needed by <b>{fmtDate(b.need_by)}</b></p>}
          <p className="text-muted">{allResolved ? `Took ${days(blockerDays({ opened_at: b.opened_at, resolved_at: group.map((x) => x.resolved_at ?? "").sort().pop() ?? null }, t))}` : `Open ${days(blockerDays(b, t))}`}</p>
        </div>
      </div>

      {/* Who it's waiting on: one row per person or team tagged. */}
      <ul className="mt-3 space-y-2">
        {group.map((x) => {
          const other = people.get(mine ? x.owner_id : x.raised_by);
          const isOwner = x.owner_id === me.id;
          return (
            <li key={x.id} className="rounded-lg border border-line px-3 py-2 flex flex-wrap items-center gap-3">
              <Avatar name={other?.name ?? ""} size={26} />
              <div className="min-w-0 flex-1">
                <p className="text-label-md">{tracked && mine ? "Tracked by you" : other?.name}
                  {x.team_id && <span className="text-body-sm text-muted font-normal"> · for the {teams.get(x.team_id)} team{x.delegated_by ? `, passed on by ${people.get(x.delegated_by)?.name.split(" ")[0]}` : ", as its head"}</span>}</p>
                <p className="text-body-sm text-muted">{tracked && mine ? "No one was asked; PMG counts the days blocked" : mine ? `Can unblock · ${other?.title}` : "Waiting on you"}{x.reply ? ` · “${x.reply}”` : ""}</p>
              </div>
              {!tracked && <BlockerPill status={displayStatus(x, t)} />}
              {x.status !== "resolved" && (
                <div className="flex flex-wrap gap-2">
                  {mine && !tracked && <Op id={x.id} op="nudge" label="Nudge" />}
                  {!tracked && (mine || isOwner) && (x.meeting_requested_at
                    ? <span className="text-body-sm text-muted inline-flex items-center gap-1"><Icon name="event_available" className="text-[16px]" />1:1 requested</span>
                    : <Op id={x.id} op="meeting" label={`Request a 1:1${mine ? "" : ` with ${other?.name.split(" ")[0]}`}`} icon="video_call" />)}
                  {isOwner && x.status !== "accepted" && <Op id={x.id} op="accept" label="Accept" />}
                  {isOwner && x.status !== "needs_info" && <Op id={x.id} op="needs_info" label="Need info" />}
                  {isOwner && x.team_id && !x.delegated_by && teamMembers(x.team_id).length > 0 && (
                    <form action={blockerAction} className="flex items-center gap-1">
                      <input type="hidden" name="blockerId" value={x.id} /><input type="hidden" name="op" value="delegate" />
                      <select name="to" aria-label="Pass it to" className="input h-8 py-0 text-body-sm w-40">{teamMembers(x.team_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                      <button className="btn-secondary btn-sm">Pass it on</button>
                    </form>
                  )}
                  {!mine && <Op id={x.id} op="resolve" label="Mark resolved" primary />}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {mine && !allResolved && (
        <div className="flex flex-wrap justify-end gap-2 mt-3">
          {!tracked && !b.escalated_at && !shouldSuggestEscalation(b, t) && <Op id={b.id} op="escalate" label="Escalate" />}
          {tracked && <Op id={b.id} op="meeting" label="Request a 1:1 with my manager" icon="video_call" />}
          <Op id={b.id} op="resolve" label={group.length > 1 ? "All resolved" : "Resolved"} primary />
        </div>
      )}
      {mine && !tracked && group.some((x) => shouldSuggestEscalation(x, t)) && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-wrap items-center gap-3 text-body-md text-amber-900">
          <Icon name="trending_up" className="text-[18px]" />
          <span className="flex-1">This is {daysOverdue(b, t)} days past the need-by date. Escalate to {people.get(me.manager_id ?? "")?.name}, your manager?</span>
          <Op id={b.id} op="escalate" label="Escalate" primary />
          <span className="text-body-sm text-amber-800">Nothing escalates without your OK.</span>
        </div>
      )}
      {b.escalated_at && !allResolved && <p className="mt-2 text-body-sm text-muted inline-flex items-center gap-1"><Icon name="trending_up" className="text-[16px]" /> Escalated to {people.get(b.escalated_to ?? "")?.name} on {fmtDate(b.escalated_at)}</p>}

      {(b.details || sent.length > 0 || reminders.length > 0) && (
        <details className="mt-3 group" open={open}>
          <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-label-md text-teal">
            <Icon name="expand_more" className="text-[18px] transition-transform group-open:rotate-180" /> Details, messages and reminders
          </summary>
          <div className="mt-3 grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {b.details && <div><p className="label">In detail</p><p className="text-body-md whitespace-pre-wrap">{b.details}</p></div>}
              {reminders.length > 0 && (
                <div>
                  <p className="label">Reminders</p>
                  <ul className="space-y-1.5">
                    {reminders.map((r) => (
                      <li key={r.kind} className="flex items-center gap-2 text-body-sm">
                        <Icon name={r.state === "sent" ? "notifications" : r.state === "skipped" ? "notifications_off" : "schedule"} className={cx("text-[16px]", r.state === "sent" ? "text-teal" : "text-muted")} />
                        <span className="flex-1">{fmtDate(r.on)} · to {r.to === "owner" ? group.map((x) => people.get(x.owner_id)?.name.split(" ")[0]).join(", ") : "you"}: {r.text}</span>
                        <span className="text-muted">{r.state === "sent" ? "sent (mock)" : r.state === "skipped" ? "not needed" : "scheduled"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {sent.length > 0 && (
              <div>
                <p className="label">Sent outside PMG <span className="normal-case tracking-normal text-muted">(mocked: nothing actually leaves the prototype)</span></p>
                <ul className="space-y-2">
                  {sent.map((m) => (
                    <li key={m.id}>
                      <details className="rounded-lg border border-line">
                        <summary className="cursor-pointer px-3 py-2 text-body-sm flex items-center gap-2">
                          <Icon name={CHANNEL_ICON[m.channel] ?? "send"} className="text-[16px] text-teal" />
                          <span className="flex-1">{CHANNEL_LABEL[m.channel] ?? m.channel} to {people.get(m.to_id)?.name}{m.kind === "blocker_email" ? " · drafted email" : m.kind === "meeting_invite" ? " · 1:1 invite" : ""}</span>
                          <span className="text-muted">{fmtDate(m.at)}</span>
                        </summary>
                        <div className="px-3 pb-3 text-body-sm">
                          {m.subject && <p className="font-medium">{m.subject}</p>}
                          <pre className="whitespace-pre-wrap font-sans text-muted mt-1">{m.body}</pre>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
    </li>
  );
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

function Op({ id, op, label, primary, icon }: { id: number; op: string; label: string; primary?: boolean; icon?: string }) {
  return (
    <form action={blockerAction}>
      <input type="hidden" name="blockerId" value={id} /><input type="hidden" name="op" value={op} />
      <button className={`${primary ? "btn-primary" : "btn-secondary"} btn-sm`}>{icon && <Icon name={icon} className="text-[16px]" />}{label}</button>
    </form>
  );
}
