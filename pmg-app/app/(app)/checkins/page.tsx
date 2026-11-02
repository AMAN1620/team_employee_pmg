import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Card, Icon, Pill, cx, fmtDate, PageHeader } from "@/components/ui";
import { checkinItems, checkinsFor, getBlocker, goalsFor, listPeople, pendingCheckin, type CheckinItem } from "@/lib/repo";
import { aiLabel } from "@/lib/ai";
import { weekStart, today } from "@/lib/time";
import { confirmCheckinAction, submitCheckinAction, updateCheckinItemAction } from "@/app/actions/app";

const KIND: Record<CheckinItem["kind"], { label: string; icon: string; tone: string }> = {
  progress: { label: "Progress", icon: "trending_up", tone: "bg-teal-tint text-teal" },
  win: { label: "Win", icon: "emoji_events", tone: "bg-violet-tint text-violet" },
  blocker: { label: "New blocker", icon: "report", tone: "bg-rose-100 text-rose-700" },
  existing_blocker: { label: "Existing blocker", icon: "history", tone: "bg-amber-100 text-amber-700" },
  unplanned: { label: "Unplanned work", icon: "bolt", tone: "bg-slate-100 text-slate-600" },
  next: { label: "Next step", icon: "arrow_forward", tone: "bg-slate-100 text-slate-600" },
};

export default async function CheckinsPage({ searchParams }: { searchParams: Promise<{ confirmed?: string; new?: string }> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  const pending = pendingCheckin(me.id);
  if (pending && !sp.new) return <Review me={me} checkinId={pending.id} />;

  const history = checkinsFor(me.id).filter((c) => c.status === "confirmed");
  return (
    <div>
      <PageHeader title="Weekly check-in" subtitle="Three quick questions. PMG turns your answer into goal progress, wins and blockers, and you confirm before anything is shared." />
      {sp.confirmed && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3 text-green-800">
          <Icon name="check_circle" className="text-[22px]" fill />
          <span className="text-body-md">Check-in confirmed. Goals, wins and blockers are updated; anyone you&apos;re waiting on got a message in chat.</span>
          <Link href="/blockers" className="ml-auto text-label-md underline">See blockers</Link>
        </div>
      )}
      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-8 p-6">
          <form action={submitCheckinAction} className="space-y-5">
            <p className="text-label-sm text-muted uppercase tracking-wide">Week of {fmtDate(weekStart(today()), { day: "numeric", month: "short" })}</p>
            {[
              ["moved", "What moved?", "e.g. Checklist v1 is live for 20% of new accounts and step-2 completion went up 9%."],
              ["stuck", "What's stuck?", "e.g. Still waiting on the backend team for dashboard access."],
              ["next", "What's next?", "e.g. Run the A/B test on step 3."],
            ].map(([name, label, ph]) => (
              <div key={name}>
                <label className="text-title-md block mb-2" htmlFor={name}>{label}</label>
                <textarea id={name} name={name} className="textarea" placeholder={ph} required={name === "moved"} />
              </div>
            ))}
            <div>
              <p className="text-title-md mb-2">How was your week?</p>
              <div className="flex gap-2">
                {[["1", "Rough"], ["2", "Meh"], ["3", "Okay"], ["4", "Good"], ["5", "Great"]].map(([v, l]) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="mood" value={v} className="peer sr-only" defaultChecked={v === "4"} />
                    <span className="block px-4 py-2 rounded-lg border border-line text-label-md peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal">{v} · {l}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button className="btn-primary"><Icon name="auto_awesome" className="text-[18px]" /> Sort my check-in</button>
              <span className="text-body-sm text-muted">Nothing is saved or shared until you confirm.</span>
            </div>
          </form>
        </Card>
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="p-6">
            <p className="text-title-md flex items-center gap-2"><Icon name="chat" className="text-teal" /> Prefer chat?</p>
            <p className="text-body-md text-muted mt-1">PMG asks these questions in chat every Thursday at 10:00 AM. Reply there and it shows up here for you to confirm.</p>
            <Link href="/chat" className="btn-secondary mt-4 w-full">Open chat</Link>
          </Card>
          <Card className="p-6">
            <p className="text-title-md mb-3">Past check-ins</p>
            <ul className="space-y-3">
              {history.slice(0, 6).map((c) => (
                <li key={c.id} className="border-l-2 border-teal/40 pl-3">
                  <p className="text-label-sm text-muted">Week of {fmtDate(c.week_of)} · mood {c.mood ?? "–"}/5</p>
                  <p className="text-body-md line-clamp-2">{c.moved}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Review({ me, checkinId }: { me: { id: string; name: string }; checkinId: number }) {
  const checkin = checkinsFor(me.id).find((c) => c.id === checkinId)!;
  const items = checkinItems(checkinId);
  const goals = goalsFor(me.id).filter((g) => g.status === "approved");
  const people = listPeople().filter((p) => p.id !== me.id);
  const live = items.filter((i) => i.state !== "removed");
  const confirmed = live.filter((i) => i.state === "confirmed").length;
  const goalTitle = (id: number | null) => goals.find((g) => g.id === id)?.title;

  return (
    <div className="pb-24">
      <PageHeader title={`Check-in · Week of ${fmtDate(checkin.week_of)}`} chip={<Pill tone="amber" icon="pending">Waiting for your confirmation</Pill>}
        right={<Link href="/checkins?new=1" className="btn-ghost">Rewrite answer</Link>} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-title-md">Your reply</p>
              <span className="text-body-sm text-muted inline-flex items-center gap-1"><Icon name={checkin.source === "chat" ? "chat" : "edit_note"} className="text-[16px]" /> Sent from {checkin.source} · {fmtDate(checkin.submitted_at, { weekday: "short", day: "numeric", month: "short" })}, {checkin.submitted_at.slice(11)}</span>
            </div>
            {[["What moved?", checkin.moved], ["What's stuck?", checkin.stuck], ["What's next?", checkin.next]].map(([q, a]) => (
              <div key={q} className="mb-3">
                <p className="text-label-sm text-muted uppercase tracking-wide">{q}</p>
                <blockquote className="mt-1 border-l-2 border-line pl-3 text-body-md text-on-surface-variant">{a || "—"}</blockquote>
              </div>
            ))}
            {checkin.mood && <p className="text-body-sm text-muted">How was your week? <b className="text-ink">{checkin.mood}/5</b></p>}
          </Card>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="auto_awesome" className="text-teal" />
              <h2 className="section-title">Here&apos;s what we found</h2>
              <Pill tone="teal">{aiLabel()}</Pill>
            </div>
            <div className="space-y-3">
              {items.map((it) => {
                const k = KIND[it.kind];
                const data = JSON.parse(it.data) as Record<string, string>;
                const removed = it.state === "removed";
                const blocker = it.kind === "existing_blocker" ? getBlocker(Number(data.blockerId)) : undefined;
                return (
                  <div key={it.id} className={cx("card p-4", it.state === "confirmed" && "border-green-300 bg-green-50/30", removed && "opacity-50")}>
                    <div className="flex items-start gap-3">
                      <div className={cx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", k.tone)}><Icon name={k.icon} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-label-sm uppercase tracking-wide text-muted">{k.label}</span>
                          {it.state === "confirmed" && <Pill tone="green" icon="check">Confirmed</Pill>}
                          {removed && <Pill tone="slate">Removed</Pill>}
                        </div>
                        <p className={cx("text-title-md mt-0.5", removed && "line-through")}>{it.kind === "existing_blocker" ? `Matches your open blocker: ${it.text}` : it.text}</p>
                        <p className="text-body-sm text-muted mt-1 flex flex-wrap gap-x-3">
                          {it.goal_id && <span>Goal: {goalTitle(it.goal_id)}</span>}
                          {it.kind === "blocker" && <span>Waiting on: {people.find((p) => p.id === data.ownerId)?.name ?? "pick someone"}</span>}
                          {it.kind === "blocker" && data.needBy && <span>Need by {fmtDate(data.needBy)}</span>}
                          {it.kind === "win" && <span>Visible to: {data.visibility}</span>}
                          {it.kind === "unplanned" && <span>Tag: {data.tag}</span>}
                          {blocker && <span>Waiting on {people.find((p) => p.id === blocker.owner_id)?.name} · {data.action === "resolved" ? "will mark resolved" : "will nudge"}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!removed && it.state !== "confirmed" && (
                          <form action={updateCheckinItemAction}><input type="hidden" name="itemId" value={it.id} /><input type="hidden" name="state" value="confirmed" />
                            <button className="btn-secondary btn-sm"><Icon name="check" className="text-[16px]" /> Looks right</button></form>
                        )}
                        <form action={updateCheckinItemAction}><input type="hidden" name="itemId" value={it.id} /><input type="hidden" name="state" value={removed ? "suggested" : "removed"} />
                          <button className="btn-ghost btn-sm">{removed ? "Undo" : "Remove"}</button></form>
                      </div>
                    </div>
                    {!removed && (
                      <details className="mt-3 ml-12">
                        <summary className="cursor-pointer text-label-sm text-teal">Edit</summary>
                        <form action={updateCheckinItemAction} className="grid sm:grid-cols-2 gap-3 mt-3">
                          <input type="hidden" name="itemId" value={it.id} />
                          {it.kind !== "existing_blocker" && <label className="sm:col-span-2"><span className="label">Text</span><input name="text" defaultValue={it.text} className="input" /></label>}
                          {it.kind !== "unplanned" && it.kind !== "existing_blocker" && (
                            <label><span className="label">Goal</span>
                              <select name="goalId" defaultValue={it.goal_id ?? ""} className="input"><option value="">No goal</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
                          )}
                          {it.kind === "blocker" && <>
                            <label><span className="label">Who can unblock this?</span>
                              <select name="ownerId" defaultValue={data.ownerId ?? ""} className="input">{people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}</select></label>
                            <label><span className="label">Need by</span><input type="date" name="needBy" defaultValue={data.needBy} className="input" /></label>
                          </>}
                          {it.kind === "win" && <>
                            <label><span className="label">Visible to</span>
                              <select name="visibility" defaultValue={data.visibility} className="input">{["private", "manager", "team", "company"].map((v) => <option key={v} value={v}>{v === "private" ? "Only me" : v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
                            <label><span className="label">Evidence link</span><input name="link" defaultValue={data.link} placeholder="https://…" className="input" /></label>
                          </>}
                          {it.kind === "existing_blocker" && (
                            <label><span className="label">What should happen?</span>
                              <select name="action" defaultValue={data.action} className="input"><option value="nudge">Nudge {people.find((p) => p.id === blocker?.owner_id)?.name.split(" ")[0]}</option><option value="resolved">It&apos;s resolved now</option></select></label>
                          )}
                          <div className="sm:col-span-2"><button className="btn-primary btn-sm">Save</button></div>
                        </form>
                      </details>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && <Card className="p-6 text-body-md text-muted">PMG didn&apos;t find anything to record. Rewrite your answer or confirm to close the check-in.</Card>}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="p-6">
            <p className="text-title-md mb-3">Where this goes</p>
            <ul className="space-y-3 text-body-md">
              {[["trending_up", "Goal progress updates"], ["report", "Blocker requests go to the person in chat"], ["emoji_events", "Wins go into your journal"], ["forum", `Items show up in your 1:1 agenda`], ["workspace_premium", "Everything is saved for your self-appraisal"]].map(([i, t]) => (
                <li key={t} className="flex items-center gap-2"><Icon name={i} className="text-[18px] text-teal" /> {t}</li>
              ))}
            </ul>
          </Card>
          <div className="rounded-xl border border-line bg-white p-4 flex gap-2 text-body-sm text-muted">
            <Icon name="lock" className="text-[18px]" /> Your manager sees confirmed items only. HR never sees your replies.
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-[248px] right-0 bg-white border-t border-line px-8 py-3 flex items-center justify-between z-30">
        <span className="text-body-md text-muted">{live.length} items · {confirmed} confirmed</span>
        <div className="flex items-center gap-2">
          <Link href="/home" className="btn-secondary">Save for later</Link>
          <form action={confirmCheckinAction}><input type="hidden" name="checkinId" value={checkinId} />
            <button className="btn-primary"><Icon name="done_all" className="text-[18px]" /> Confirm all</button></form>
        </div>
      </div>
    </div>
  );
}
