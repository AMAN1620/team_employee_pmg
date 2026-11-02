import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Avatar, BlockerPill, Card, CardHeader, EvidenceChip, HealthPill, Icon, Pill, ProgressBar, fmtDate, fmtTime, healthTone } from "@/components/ui";
import { activeCycle, blockersOwnedBy, blockersRaisedBy, chatFor, feedbackTo, getReview, lastConfirmedCheckin, parseEvidence, peopleById, pendingCheckin, winsFor, checkinItems } from "@/lib/repo";
import { agendaFor, goalViewsFor } from "@/lib/services/views";
import { displayStatus } from "@/lib/logic/blocked";
import { daysBetween, today } from "@/lib/time";
import { blockerAction } from "@/app/actions/app";

export default async function HomePage() {
  const me = await requirePerson();
  const people = peopleById();
  const goals = goalViewsFor(me.id);
  const pending = pendingCheckin(me.id);
  const prompt = chatFor(me.id).find((m) => m.kind === "checkin_prompt" && !m.handled);
  const last = lastConfirmedCheckin(me.id);
  const raised = blockersRaisedBy(me.id).filter((b) => b.status !== "resolved");
  const waitingOnMe = blockersOwnedBy(me.id).filter((b) => b.status !== "resolved");
  const wins = winsFor(me.id).slice(0, 3);
  const cycle = activeCycle();
  const self = cycle ? getReview(cycle.id, me.id, "self") : undefined;
  const feedback = feedbackTo(me.id).filter((f) => f.at.slice(0, 7) === today().slice(0, 7));
  const one = me.manager_id ? agendaFor(me.id, me.manager_id) : null;
  const overdue = one?.actions.filter((a) => !a.done_at && a.due && a.due < today()).length ?? 0;
  const quarterGone = goals[0]?.h.quarterGone ?? 0;
  const dateLabel = new Date(today() + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Good afternoon, {me.name.split(" ")[0]}</h1>
          <p className="text-body-md text-muted mt-1">Acme Labs · {me.title} · {dateLabel}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-label-sm text-on-surface-variant">
          <Icon name="calendar_today" className="text-[16px] text-teal" /> Q3 FY27 · {Math.round(quarterGone * 100)}% of the quarter gone
        </span>
      </div>

      {/* Check-in banner */}
      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-tint text-teal flex items-center justify-center shrink-0"><Icon name="smart_toy" className="text-[22px]" /></div>
          <div className="min-w-0">
            {pending ? (
              <>
                <p className="text-title-md">Your check-in is in <Pill tone="teal" className="ml-2">{checkinItems(pending.id).length} items sorted</Pill></p>
                <p className="text-body-md text-muted">PMG sorted your reply into goal progress, wins and blockers. Confirm them in about a minute.</p>
              </>
            ) : prompt ? (
              <>
                <p className="text-title-md">Your weekly check-in is ready</p>
                <p className="text-body-md text-muted">Answer in chat or here. It takes about 2 minutes.</p>
              </>
            ) : (
              <>
                <p className="text-title-md">You&apos;re all checked in</p>
                <p className="text-body-md text-muted">Your next check-in arrives in chat on Thursday.</p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {last && <span className="text-body-sm text-muted">Last confirmed: {fmtDate(last.submitted_at, { weekday: "short", day: "numeric", month: "short" })}</span>}
          {pending ? (
            <Link href="/checkins" className="btn-primary">Review check-in <Icon name="arrow_forward" className="text-[18px]" /></Link>
          ) : prompt ? (
            <>
              <Link href="/chat" className="btn-secondary"><Icon name="chat" className="text-[18px]" /> Open in chat</Link>
              <Link href="/checkins" className="btn-primary">Check in now</Link>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Goals */}
        <Card className="col-span-12 lg:col-span-8 p-6">
          <CardHeader title={<>My goals <Pill tone="slate" className="ml-1 align-middle">{goals.length} active</Pill></>} subtitle="Aligned to Q3 company objectives" right={<Link href="/goals/new" className="text-label-md text-teal hover:underline inline-flex items-center gap-1">New goal <Icon name="add" className="text-[18px]" /></Link>} />
          <div className="divide-y divide-line">
            {goals.map((g) => {
              const open = g.blockers.filter((b) => b.status !== "resolved");
              return (
                <Link key={g.id} href={`/goals/${g.id}`} className="block py-4 group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-title-md group-hover:text-teal">{g.title}</span>
                        <HealthPill health={g.h.health} />
                      </div>
                      <p className="text-body-sm text-muted mt-0.5 flex items-center gap-1"><Icon name="account_tree" className="text-[14px]" /> Product team · Cut time-to-value from 14 to 5 days</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-title-md">{Math.round(g.h.progress * 100)}%</div>
                      <div className="text-body-sm text-muted">Due {fmtDate(g.due_date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <ProgressBar value={g.h.progress * 100} tone={healthTone(g.h.health)} className="flex-1" />
                    <span className="text-body-sm text-muted w-44 text-right">{g.progressText}</span>
                  </div>
                  {open.length > 0 && g.h.health !== "On track" && (
                    <p className="mt-2 text-body-sm"><Pill tone="rose" icon="error">{open.length} blocker open for {daysBetween(open[open.length - 1].opened_at, today())} days</Pill></p>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="mt-2 pt-4 border-t border-line flex items-center justify-between text-body-sm text-muted">
            <span className="inline-flex items-center gap-1"><Icon name="donut_large" className="text-[16px]" /> Q3 FY27 · {Math.round(quarterGone * 100)}% of the quarter gone</span>
            <Link href="/goals" className="text-label-md text-teal hover:underline">View all goals →</Link>
          </div>
        </Card>

        {/* Next 1:1 */}
        <Card className="col-span-12 lg:col-span-4 p-6 flex flex-col">
          <CardHeader title="Next 1:1" right={overdue > 0 ? <Pill tone="amber" icon="schedule">{overdue} action overdue</Pill> : undefined} />
          {one?.oneOnOne ? (
            <>
              <div className="rounded-xl bg-surface-container-low p-4 flex items-center gap-3">
                <Avatar name={one.manager.name} size={44} />
                <div>
                  <p className="text-title-md">{one.manager.name}</p>
                  <p className="text-body-sm text-muted inline-flex items-center gap-1"><Icon name="schedule" className="text-[14px]" />
                    {one.oneOnOne.scheduled_at.slice(0, 10) === today() ? "Today" : fmtDate(one.oneOnOne.scheduled_at)}, {fmtTime(one.oneOnOne.scheduled_at)} (30 min)</p>
                </div>
              </div>
              <p className="text-label-sm text-muted uppercase tracking-wide mt-5 mb-2">Agenda ({one.items.length})</p>
              <ul className="space-y-2 flex-1">
                {one.items.slice(0, 3).map((it) => (
                  <li key={it.key} className="flex items-start gap-2 rounded-lg border border-line p-3">
                    <Icon name={it.source === "blocker" ? "error" : it.source === "at_risk" ? "warning" : it.source === "win" ? "celebration" : "chat"} className={`text-[18px] ${it.source === "blocker" ? "text-rose-600" : it.source === "at_risk" ? "text-amber-600" : it.source === "win" ? "text-violet" : "text-teal"}`} />
                    <span className="text-body-md line-clamp-2">{it.text}</span>
                  </li>
                ))}
              </ul>
              <Link href="/one-on-ones" className="btn-secondary mt-4"><Icon name="forum" className="text-[18px]" /> Open agenda</Link>
            </>
          ) : <p className="text-body-md text-muted">No 1:1 scheduled.</p>}
        </Card>

        {/* Blockers */}
        <Card className="col-span-12 md:col-span-6 lg:col-span-4 p-6 flex flex-col">
          <CardHeader title="Blockers" icon="report" iconTone="rose" right={<Pill tone="rose">{raised.length} open</Pill>} />
          <div className="space-y-3 flex-1">
            {raised.slice(0, 1).map((b) => (
              <div key={b.id} className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-title-md">{b.title}</p>
                  <BlockerPill status={displayStatus(b, today())} />
                </div>
                <p className="text-body-sm text-muted mt-1">Waiting on {people.get(b.owner_id)?.name}, {people.get(b.owner_id)?.title}</p>
                <p className="text-body-sm mt-2 flex items-center justify-between"><span className="text-rose-700 inline-flex items-center gap-1"><Icon name="hourglass_top" className="text-[14px]" /> Open {daysBetween(b.opened_at, today())} days</span>
                  {raised.length > 1 && <Link href="/blockers" className="text-teal">+{raised.length - 1} more</Link>}</p>
              </div>
            ))}
            {waitingOnMe.length > 0 && (
              <>
                <p className="text-label-sm text-muted uppercase tracking-wide inline-flex items-center gap-1 pt-2"><Icon name="assignment_late" className="text-[16px] text-rose-600" /> Waiting on you</p>
                {waitingOnMe.slice(0, 1).map((b) => (
                  <div key={b.id} className="rounded-xl border border-line p-4">
                    <p className="text-body-md"><b>{people.get(b.raised_by)?.name}</b> needs: {b.title.toLowerCase()}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-body-sm text-rose-700">Need by {fmtDate(b.need_by)}</span>
                      <form action={blockerAction}>
                        <input type="hidden" name="blockerId" value={b.id} />
                        <input type="hidden" name="op" value={b.status === "accepted" ? "resolve" : "accept"} />
                        <button className="btn-primary btn-sm">{b.status === "accepted" ? "Mark resolved" : "Accept"}</button>
                      </form>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          <Link href="/blockers" className="text-label-md text-teal hover:underline mt-4">Manage all blockers →</Link>
        </Card>

        {/* Wins */}
        <Card accent="violet" className="col-span-12 md:col-span-6 lg:col-span-4 p-6 flex flex-col">
          <CardHeader title="Recent wins & kudos" icon="military_tech" iconTone="violet" />
          <div className="space-y-3 flex-1">
            {wins.map((w) => (
              <div key={w.id} className={`rounded-xl p-4 ${w.kind === "kudos" ? "bg-violet-tint/50" : "border border-line"}`}>
                {w.kind === "kudos" ? (
                  <>
                    <div className="flex items-center gap-2"><Avatar name={people.get(w.from_id!)?.name ?? ""} size={28} /><span className="text-label-md">{people.get(w.from_id!)?.name}</span><Icon name="favorite" className="text-[16px] text-violet ml-auto" fill /></div>
                    <p className="text-body-md italic mt-2">“{w.title}”</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-label-md">{w.title}</p>
                      {parseEvidence(w).slice(0, 1).map((e) => <EvidenceChip key={e.label} kind={e.kind} label={e.label} />)}
                    </div>
                    {w.kind === "helped" && <p className="text-body-sm text-muted mt-1">Added automatically</p>}
                  </>
                )}
              </div>
            ))}
          </div>
          <Link href="/wins" className="text-label-md text-violet hover:underline mt-4">Open wins journal →</Link>
        </Card>

        {/* Coming up */}
        <Card className="col-span-12 lg:col-span-4 p-6 flex flex-col">
          <CardHeader title="Coming up" icon="event_upcoming" iconTone="teal" />
          {cycle && (
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-title-md">Mid-year review</p>
                <Pill tone={self?.status === "submitted" ? "green" : self ? "teal" : "amber"}>{self?.status === "submitted" ? "Submitted" : self ? "Draft" : "Not started"}</Pill>
              </div>
              <p className="text-body-sm text-muted mt-1">Self-appraisal due {fmtDate(cycle.self_due)} ({daysBetween(today(), cycle.self_due)} days)</p>
              <Link href="/reviews/self" className="btn-primary w-full mt-4"><Icon name="auto_awesome" className="text-[18px]" /> {self ? "Open my self-appraisal" : "Draft my self-appraisal"}</Link>
            </div>
          )}
          <div className="rounded-xl border border-line p-4 mt-3 flex-1">
            <p className="text-title-md flex items-center justify-between">Feedback this month <Pill tone="teal">{feedback.length} received</Pill></p>
            {feedback[0] && <p className="text-body-sm italic text-on-surface-variant mt-2">“{feedback[0].keep}” <span className="not-italic text-muted">· {people.get(feedback[0].from_id)?.name}</span></p>}
          </div>
          <Link href="/feedback" className="text-label-md text-teal hover:underline mt-4">View reviews & feedback →</Link>
        </Card>
      </div>
    </div>
  );
}
