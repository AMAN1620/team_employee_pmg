import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Avatar, Card, Empty, Icon, PageHeader, Pill, Tabs, fmtDate } from "@/components/ui";
import { feedbackFrom, feedbackRequestsBy, feedbackRequestsFor, feedbackTo, getPerson, goalsFor, listPeople, peopleById, type Feedback } from "@/lib/repo";
import { addDays, today } from "@/lib/time";
import { addAiActionAction, giveFeedbackAction, requestFeedbackAction } from "@/app/actions/app";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ tab?: string; give?: string; goalId?: string; about?: string; requestId?: string; sent?: string }> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  const people = peopleById();
  const tab = sp.give ? "give" : sp.tab ?? "received";
  const received = feedbackTo(me.id);
  const given = feedbackFrom(me.id);
  const requested = feedbackRequestsBy(me.id);
  const forMe = feedbackRequestsFor(me.id);
  const goals = goalsFor(me.id).filter((g) => g.status === "approved");
  const giveTo = sp.give ? getPerson(sp.give) : undefined;
  const giveGoals = giveTo ? goalsFor(giveTo.id).filter((g) => g.status === "approved") : [];
  const request = sp.requestId ? forMe.find((r) => r.id === Number(sp.requestId)) : undefined;

  return (
    <div>
      <PageHeader title="Feedback" subtitle="Ask for feedback on specific work, and give it while it's still useful."
        right={<><a href="#ask" className="btn-primary"><Icon name="rate_review" className="text-[18px]" /> Ask for feedback</a><Link href={`/feedback?give=${me.manager_id ?? ""}`} className="btn-secondary">Give feedback</Link></>} />
      {sp.sent && <div className="mb-6 rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">Sent. They&apos;ll get it in chat.</div>}

      {forMe.length > 0 && !sp.give && (
        <Card className="p-5 mb-6 border-amber-200 bg-amber-50/50">
          <p className="text-title-md mb-2">Waiting for your feedback</p>
          {forMe.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2">
              <Avatar name={people.get(r.requester_id)?.name ?? ""} size={28} />
              <span className="flex-1 text-body-md"><b>{people.get(r.requester_id)?.name}</b>: “{r.about}”{r.due && <span className="text-muted"> · by {fmtDate(r.due)}</span>}</span>
              <Link href={`/feedback?give=${r.requester_id}&requestId=${r.id}&about=${encodeURIComponent(r.about)}&goalId=${r.goal_id ?? ""}`} className="btn-primary btn-sm">Give feedback</Link>
            </div>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          {giveTo ? (
            <Card className="p-6">
              <h2 className="section-title mb-1">Feedback for {giveTo.name}</h2>
              <p className="text-body-md text-muted mb-4">Specific and kind beats long. One thing to keep, one thing to improve, one next step.</p>
              <form action={giveFeedbackAction} className="space-y-4">
                <input type="hidden" name="toId" value={giveTo.id} /><input type="hidden" name="requestId" value={request?.id ?? sp.requestId ?? ""} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <label><span className="label">About</span><input name="about" required defaultValue={request?.about ?? sp.about ?? ""} className="input" placeholder="e.g. Checklist v1 launch" /></label>
                  <label><span className="label">Goal</span><select name="goalId" defaultValue={sp.goalId ?? request?.goal_id ?? ""} className="input"><option value="">No goal</option>{giveGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
                </div>
                <label className="block"><span className="label">Keep doing</span><textarea name="keep" required className="textarea min-h-[64px]" /></label>
                <label className="block"><span className="label">Improve</span><textarea name="improve" className="textarea min-h-[64px]" /></label>
                <label className="block"><span className="label">Next action</span><input name="nextAction" className="input" placeholder="What, who, by when" /></label>
                <div className="flex gap-2"><button className="btn-primary">Send feedback</button><Link href="/feedback" className="btn-secondary">Cancel</Link></div>
              </form>
            </Card>
          ) : (
            <>
              <Tabs active={tab} tabs={[
                { key: "received", label: `Received (${received.length})`, href: "/feedback?tab=received" },
                { key: "requested", label: `Requested (${requested.length})`, href: "/feedback?tab=requested" },
                { key: "given", label: `Given (${given.length})`, href: "/feedback?tab=given" },
              ]} />
              <div className="space-y-4">
                {tab === "received" && (received.length ? received.map((f) => <FeedbackCard key={f.id} f={f} name={people.get(f.from_id)?.name ?? ""} actionable={me.id === f.to_id} />) : <Card><Empty title="No feedback yet" /></Card>)}
                {tab === "given" && (given.length ? given.map((f) => <FeedbackCard key={f.id} f={f} name={`To ${people.get(f.to_id)?.name ?? ""}`} />) : <Card><Empty title="You haven't given feedback yet" /></Card>)}
                {tab === "requested" && (requested.length ? requested.map((r) => (
                  <Card key={r.id} className="p-5 flex items-center gap-3">
                    <Avatar name={people.get(r.reviewer_id)?.name ?? ""} size={32} />
                    <div className="flex-1"><p className="text-title-md">{r.about}</p><p className="text-body-sm text-muted">Asked {people.get(r.reviewer_id)?.name} · {r.kind === "detailed" ? "detailed review" : "quick reaction"}{r.due && ` · due ${fmtDate(r.due)}`}</p></div>
                    <Pill tone={r.status === "answered" ? "green" : "amber"}>{r.status === "answered" ? "Answered" : "Waiting"}</Pill>
                  </Card>
                )) : <Card><Empty title="No requests yet" /></Card>)}
              </div>
            </>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4" id="ask">
          <Card className="p-6">
            <h2 className="section-title mb-3">Ask for feedback</h2>
            <form action={requestFeedbackAction} className="space-y-3">
              <label className="block"><span className="label">What should they look at?</span><input name="about" required className="input" placeholder="e.g. Review my drop-off analysis deck" /></label>
              <label className="block"><span className="label">Goal</span><select name="goalId" className="input"><option value="">No goal</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
              <fieldset><legend className="label">Who?</legend>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {listPeople().filter((p) => p.id !== me.id && p.id !== "neha").map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-body-md"><input type="checkbox" name="reviewerId" value={p.id} defaultChecked={p.id === me.manager_id} className="accent-teal" /> {p.name}</label>
                  ))}
                </div>
              </fieldset>
              <label className="block"><span className="label">By when?</span><input name="due" type="date" defaultValue={addDays(today(), 2)} className="input" /></label>
              <div className="flex gap-2">
                {[["quick", "Quick reaction"], ["detailed", "Detailed review"]].map(([v, l]) => (
                  <label key={v} className="cursor-pointer"><input type="radio" name="kind" value={v} defaultChecked={v === "quick"} className="peer sr-only" />
                    <span className="block px-3 py-1.5 rounded-full border border-line text-label-sm peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal">{l}</span></label>
                ))}
              </div>
              <button className="btn-primary w-full"><Icon name="send" className="text-[18px]" /> Send in chat</button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FeedbackCard({ f, name, actionable }: { f: Feedback; name: string; actionable?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={name.replace(/^To /, "")} size={32} />
        <div className="flex-1"><p className="text-title-md">{name}</p><p className="text-body-sm text-muted">on “{f.about}” · {fmtDate(f.at)}</p></div>
      </div>
      <dl className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-green-50 p-3"><dt className="text-label-sm text-green-800 uppercase">Keep doing</dt><dd className="text-body-md mt-1">{f.keep ?? "—"}</dd></div>
        <div className="rounded-lg bg-amber-50 p-3"><dt className="text-label-sm text-amber-800 uppercase">Improve</dt><dd className="text-body-md mt-1">{f.improve ?? "—"}</dd></div>
        <div className="rounded-lg bg-teal-tint/40 p-3"><dt className="text-label-sm text-teal uppercase">Next action</dt><dd className="text-body-md mt-1">{f.next_action ?? "—"}</dd>
          {actionable && f.next_action && (
            <form action={addAiActionAction} className="mt-2"><input type="hidden" name="text" value={f.next_action.split(" · ")[0]} /><input type="hidden" name="goalId" value={f.goal_id ?? ""} /><button className="text-label-sm text-teal hover:underline">Add to my actions</button></form>
          )}</div>
      </dl>
    </Card>
  );
}
