import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { AiBox, Avatar, BlockerPill, Card, Icon, Pill, cx, fmtDate } from "@/components/ui";
import { activeCycle, feedbackTo, getPerson, getReview, parseRubric, peopleById, ratingLevels, winsFor, type ReviewPayload } from "@/lib/repo";
import { evidenceFor, goalViewsFor } from "@/lib/services/views";
import { blockerDays, displayStatus } from "@/lib/logic/blocked";
import { canSeeWin } from "@/lib/logic/permissions";
import { today } from "@/lib/time";
import { saveManagerReviewAction } from "@/app/actions/app";
import { CitedText } from "@/components/review/CitedText";

export default async function ManagerReviewPage({ params, searchParams }: { params: Promise<{ personId: string }>; searchParams: Promise<{ tab?: string; cite?: string; saved?: string }> }) {
  const me = await requirePerson();
  const { personId } = await params;
  const sp = await searchParams;
  const p = getPerson(personId);
  if (!p || p.manager_id !== me.id) notFound();
  const cycle = activeCycle()!;
  const levels = ratingLevels(cycle.id);
  const people = peopleById();
  const goals = goalViewsFor(p.id);
  const evidence = evidenceFor(p.id);
  const self = getReview(cycle.id, p.id, "self");
  const selfPayload: ReviewPayload = self?.status === "submitted" ? JSON.parse(self.payload) : {};
  const mine = getReview(cycle.id, p.id, "manager");
  const payload: ReviewPayload = mine ? JSON.parse(mine.payload) : {};
  const submitted = mine?.status === "submitted";
  const rated = goals.filter((g) => payload.goals?.[String(g.id)]?.rating).length;
  const tab = sp.tab ?? "blockers";
  const base = `/reviews/manager/${p.id}?tab=${tab}`;
  const blockers = goals.flatMap((g) => g.blockers.filter((b) => b.raised_by === p.id));
  const totalBlocked = goals.reduce((n, g) => n + g.daysBlocked, 0);
  const wins = winsFor(p.id).filter((w) => canSeeWin(me, p, w));
  const kudos = wins.filter((w) => w.kind === "kudos");
  const cite = Number(sp.cite ?? 0);
  const selected = evidence.find((e) => e.n === cite);

  return (
    <form action={saveManagerReviewAction}>
      <input type="hidden" name="personId" value={p.id} /><input type="hidden" name="tab" value={tab} />
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Avatar name={p.name} size={44} />
        <div><h1 className="text-headline-md">{p.name}</h1><p className="text-body-md text-muted">Manager review · {cycle.name} · due {fmtDate(cycle.manager_due)}</p></div>
        <Pill tone="slate" className="ml-2">{rated} of {goals.length} goals rated</Pill>
        <div className="ml-auto flex gap-2">
          {!submitted && <button name="op" value="save" className="btn-secondary">Save draft</button>}
          {!submitted && <button name="op" value="submit" className="btn-primary" disabled={rated < goals.length} title={rated < goals.length ? "Rate every goal and save first" : ""}>Submit review</button>}
          {submitted && <Pill tone="green" icon="check">Submitted</Pill>}
        </div>
      </div>
      <p className="mb-6 text-body-sm text-muted flex items-center gap-1"><Icon name="info" className="text-[16px]" /> AI can summarize the evidence. Ratings are always yours.{sp.saved && <span className="text-teal ml-2">Saved.</span>}</p>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {goals.map((g) => {
            const entry = payload.goals?.[String(g.id)] ?? {};
            const selfEntry = selfPayload.goals?.[String(g.id)];
            const rubric = parseRubric(g);
            const ev = evidence.filter((e) => e.goalId === g.id);
            return (
              <Card key={g.id} className="p-6">
                <input type="hidden" name="goalIds" value={g.id} />
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-title-md">{g.title}</h2>
                  {entry.rating ? <Pill tone="green">Rated: {entry.rating} {levels[entry.rating - 1]?.label}</Pill> : <Pill tone="slate">{g.progressText}</Pill>}
                </div>
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {levels.map((l) => (
                    <label key={l.level} className="cursor-pointer">
                      <input type="radio" name={`rating_${g.id}`} value={l.level} defaultChecked={entry.rating === l.level} disabled={submitted} className="peer sr-only" />
                      <span className="relative block h-full rounded-lg border border-line p-2.5 peer-checked:border-teal peer-checked:bg-teal-tint/50 peer-checked:ring-1 peer-checked:ring-teal">
                        <span className="text-label-md block">{l.level} · {l.label}</span>
                        <span className="text-[11px] leading-4 text-muted block mt-1">{l.level === 2 ? rubric.partial || l.description : l.level === 3 ? rubric.meets || l.description : l.level === 4 ? rubric.exceeds || l.description : l.description}</span>
                        {selfEntry?.rating === l.level && <span className="absolute -top-2 right-2 px-1.5 rounded bg-violet text-white text-[10px] font-semibold">{p.name.split(" ")[0]}&apos;s self-rating</span>}
                      </span>
                    </label>
                  ))}
                </div>
                {ev.length > 0 && (
                  <AiBox title="Evidence summary · Drafted by PMG" className="mt-4 p-3">
                    <ul className="space-y-1 text-body-md">
                      {ev.slice(0, 4).map((e) => <li key={e.n}>• <CitedText text={`${e.kind === "blocker" ? e.detail.replace(/^I was|^Progress slowed while I/, (m) => (m.startsWith("I") ? `${p.name.split(" ")[0]} was` : `Progress slowed while ${p.name.split(" ")[0]}`)) + ", outside their control" : e.label} [${e.n}]`} base={base} /></li>)}
                    </ul>
                  </AiBox>
                )}
                {selfEntry?.text && <details className="mt-3"><summary className="text-label-sm text-teal cursor-pointer">{p.name.split(" ")[0]}&apos;s self-appraisal</summary><div className="mt-2"><CitedText text={selfEntry.text} base={base} /></div></details>}
                <label className="block mt-4"><span className="label">Your comment</span>
                  <textarea name={`comment_${g.id}`} defaultValue={entry.comment} disabled={submitted} className="textarea" placeholder="What went well, and what to focus on next" /></label>
              </Card>
            );
          })}
          <Card className="p-6">
            <label className="block"><span className="label">Overall comment</span><textarea name="overall" defaultValue={payload.overall} disabled={submitted} className="textarea" /></label>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="sticky top-24 card p-5 max-h-[calc(100vh-120px)] overflow-y-auto">
            <h2 className="section-title mb-3">Evidence</h2>
            <div className="flex gap-1 flex-wrap mb-4">
              {[["goals", "Goal cards"], ["wins", "Wins"], ["blockers", "Blockers"], ["feedback", "Feedback"], ["self", "Self-appraisal"]].map(([k, l]) => (
                <Link key={k} href={`/reviews/manager/${p.id}?tab=${k}`} className={cx("px-3 py-1 rounded-full text-label-sm border", tab === k ? "bg-teal text-white border-teal" : "border-line")}>{l}</Link>
              ))}
            </div>
            {selected && <div className="rounded-xl border-2 border-teal bg-teal-tint/30 p-4 mb-4"><p className="text-label-sm text-teal">Source [{selected.n}]</p><p className="text-title-md">{selected.label}</p><p className="text-body-md text-muted">{selected.detail}</p></div>}
            {tab === "blockers" && (
              <>
                <div className="rounded-xl bg-canvas p-4 mb-4"><p className="text-display-lg">{totalBlocked} days</p><p className="text-body-md text-muted">blocked this cycle · delays outside the employee&apos;s control</p></div>
                <ul className="space-y-2">{blockers.map((b) => (
                  <li key={b.id} className="rounded-lg border border-line p-3"><div className="flex justify-between gap-2"><span className="text-label-md">{b.title}</span><BlockerPill status={displayStatus(b, today())} /></div>
                    <p className="text-body-sm text-muted">{fmtDate(b.opened_at)} – {b.resolved_at ? fmtDate(b.resolved_at) : "now"} · {blockerDays(b, today())} days · {b.status === "resolved" ? "resolved by" : "waiting on"} {people.get(b.owner_id)?.name}</p></li>
                ))}</ul>
              </>
            )}
            {tab === "wins" && <ul className="space-y-2">{wins.map((w) => <li key={w.id} className={cx("rounded-lg p-3", w.kind === "kudos" ? "bg-violet-tint/50" : "border border-line")}><p className="text-label-md">{w.kind === "kudos" ? `${people.get(w.from_id!)?.name}: “${w.title}”` : w.title}</p><p className="text-body-sm text-muted">{w.kind} · {fmtDate(w.at)}</p></li>)}</ul>}
            {tab === "feedback" && <ul className="space-y-2">{feedbackTo(p.id).map((f) => <li key={f.id} className="rounded-lg border border-line p-3"><p className="text-label-md">{people.get(f.from_id)?.name} on {f.about}</p><p className="text-body-md">Keep: {f.keep}</p>{f.improve && <p className="text-body-md">Improve: {f.improve}</p>}</li>)}</ul>}
            {tab === "goals" && <ul className="space-y-2">{goals.map((g) => <li key={g.id} className="rounded-lg border border-line p-3"><p className="text-label-md">{g.title}</p><p className="text-body-sm text-muted">{g.h.reason}</p></li>)}</ul>}
            {tab === "self" && (self?.status === "submitted"
              ? <div className="space-y-3">{goals.map((g) => <div key={g.id}><p className="text-label-md">{g.title}</p><CitedText text={selfPayload.goals?.[String(g.id)]?.text ?? ""} base={base} /></div>)}</div>
              : <p className="text-body-md text-muted">{p.name.split(" ")[0]} hasn&apos;t submitted a self-appraisal yet.</p>)}
            {tab !== "wins" && kudos.length > 0 && (
              <div className="mt-5"><p className="label">Kudos from others ({kudos.length})</p>
                {kudos.slice(0, 2).map((k) => <p key={k.id} className="rounded-lg bg-violet-tint/50 p-3 text-body-md italic mb-2">“{k.title}” <span className="not-italic text-muted">· {people.get(k.from_id!)?.name}</span></p>)}</div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
