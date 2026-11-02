import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { Card, Empty, Icon, PageHeader, Pill, cx, fmtDate } from "@/components/ui";
import { activeCycle, getPerson, getReview, ratingLevels, type ReviewPayload } from "@/lib/repo";
import { evidenceFor, goalViewsFor } from "@/lib/services/views";
import { aiEnabled } from "@/lib/ai";
import { daysBetween, today } from "@/lib/time";
import { draftSelfReviewAction, saveSelfReviewAction } from "@/app/actions/app";
import { CitedText } from "@/components/review/CitedText";

const KIND_ICON: Record<string, string> = { win: "emoji_events", kudos: "favorite", helped: "volunteer_activism", unplanned: "bolt", blocker: "report", feedback: "rate_review", checkin: "fact_check" };

export default async function SelfAppraisalPage({ searchParams }: { searchParams: Promise<{ cite?: string; tab?: string; submitted?: string; saved?: string }> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  const cycle = activeCycle();
  if (!cycle) return <Card><Empty title="No review cycle is running" /></Card>;
  const review = getReview(cycle.id, me.id, "self");
  const manager = me.manager_id ? getPerson(me.manager_id) : undefined;
  const levels = ratingLevels(cycle.id);
  const goals = goalViewsFor(me.id);
  const evidence = evidenceFor(me.id);
  const payload: ReviewPayload = review ? JSON.parse(review.payload) : {};
  const submitted = review?.status === "submitted";
  const cite = Number(sp.cite ?? 0) || null;
  const tab = sp.tab ?? "all";
  const allText = Object.values(payload.goals ?? {}).map((g) => g.text ?? "").join(" ") + (payload.beyond ?? "");
  const cited = new Set([...allText.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const allReviewed = goals.every((g) => payload.goals?.[String(g.id)]?.reviewed) && !!payload.beyondReviewed;
  const filtered = evidence.filter((e) => tab === "all" || (tab === "wins" ? ["win", "kudos", "helped", "unplanned"].includes(e.kind) : e.kind === tab.replace(/s$/, "")));
  const selected = cite ? evidence.find((e) => e.n === cite) : undefined;
  const counts = { wins: evidence.filter((e) => e.kind === "win").length, checkins: evidence.filter((e) => e.kind === "checkin").length, blockers: evidence.filter((e) => e.kind === "blocker").length, feedback: evidence.filter((e) => e.kind === "feedback").length };

  return (
    <div>
      <PageHeader title={`Self-appraisal · ${cycle.name}`} subtitle={`Due ${fmtDate(cycle.self_due)} · ${daysBetween(today(), cycle.self_due)} days left`}
        chip={<Pill tone={submitted ? "green" : review ? "teal" : "slate"}>{submitted ? "Submitted" : review ? "Draft" : "Not started"}</Pill>} />

      {sp.submitted && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-body-md text-green-800">Submitted to {manager?.name}. They&apos;ll see your answers with the linked evidence.</div>}

      {!review ? (
        <Card className="p-10 text-center">
          <Icon name="auto_awesome" className="text-[40px] text-teal" />
          <h2 className="text-headline-sm mt-3">Draft your self-appraisal from what you&apos;ve already recorded</h2>
          <p className="text-body-md text-muted mt-2 max-w-xl mx-auto">PMG uses your {counts.wins} wins, {counts.checkins} check-ins, {counts.blockers} blockers and {counts.feedback} pieces of feedback. Every sentence links to its source, and nothing is submitted until you say so.</p>
          <form action={draftSelfReviewAction} className="mt-6"><button className="btn-primary"><Icon name="auto_awesome" className="text-[18px]" /> Draft my self-appraisal</button></form>
          <p className="text-body-sm text-muted mt-3">{aiEnabled() ? "Drafted with Claude." : "Drafted with PMG's built-in rules (set ANTHROPIC_API_KEY to use Claude)."}</p>
        </Card>
      ) : (
        <form action={saveSelfReviewAction}>
          {!submitted && (
            <div className="mb-6 rounded-xl border border-teal/20 bg-teal-tint/30 p-4 flex items-center gap-2 text-body-md text-teal">
              <Icon name="auto_awesome" /> Drafted from {counts.wins} wins, {counts.checkins} check-ins, {counts.blockers} blockers and {counts.feedback} pieces of feedback. Every sentence links to its source. Review each section before you submit.
            </div>
          )}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7 space-y-4">
              {goals.map((g) => {
                const entry = payload.goals?.[String(g.id)] ?? {};
                return (
                  <Card key={g.id} className="p-6">
                    <input type="hidden" name="goalIds" value={g.id} />
                    <div className="flex items-start justify-between gap-3"><h2 className="text-title-md">{g.title}</h2><Pill tone="slate">{g.progressText}</Pill></div>
                    <p className="label mt-4">Self-rating</p>
                    <div className="grid grid-cols-5 gap-2">
                      {levels.map((l) => (
                        <label key={l.level} className="cursor-pointer">
                          <input type="radio" name={`rating_${g.id}`} value={l.level} defaultChecked={entry.rating === l.level} disabled={submitted} className="peer sr-only" />
                          <span className="block text-center rounded-lg border border-line px-2 py-2 text-label-sm peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal" title={l.description}>{l.level} · {l.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="label mt-4">Your answer</p>
                    <CitedText text={entry.text ?? ""} />
                    {!submitted && (
                      <details className="mt-2"><summary className="text-label-sm text-teal cursor-pointer">Edit text</summary>
                        <textarea name={`text_${g.id}`} defaultValue={entry.text} className="textarea min-h-[140px] mt-2" />
                      </details>
                    )}
                    {submitted && <input type="hidden" name={`text_${g.id}`} value={entry.text} />}
                    <label className="flex items-center gap-2 mt-3 text-body-md"><input type="checkbox" name={`reviewed_${g.id}`} defaultChecked={entry.reviewed} disabled={submitted} className="accent-teal w-4 h-4" /> I&apos;ve reviewed this section</label>
                  </Card>
                );
              })}
              <Card className="p-6">
                <h2 className="text-title-md">Beyond my goals</h2>
                <p className="text-body-sm text-muted">Unplanned work and help given to others.</p>
                <div className="mt-3"><CitedText text={payload.beyond ?? ""} /></div>
                {!submitted && <details className="mt-2"><summary className="text-label-sm text-teal cursor-pointer">Edit text</summary><textarea name="beyond" defaultValue={payload.beyond} className="textarea mt-2" /></details>}
                {submitted && <input type="hidden" name="beyond" value={payload.beyond} />}
                <label className="flex items-center gap-2 mt-3 text-body-md"><input type="checkbox" name="beyondReviewed" defaultChecked={payload.beyondReviewed} disabled={submitted} className="accent-teal w-4 h-4" /> I&apos;ve reviewed this section</label>
              </Card>
              {!submitted && (
                <div className="flex items-center gap-3">
                  <button name="op" value="save" className="btn-secondary">Save draft</button>
                  <button name="op" value="submit" className="btn-primary" disabled={!allReviewed} title={allReviewed ? "" : "Save after ticking every 'reviewed' box to enable"}>Submit to {manager?.name.split(" ")[0]}</button>
                  {!allReviewed && <span className="text-body-sm text-muted">Tick “reviewed” on every section and save to enable submit.</span>}
                </div>
              )}
              <p className="text-body-sm text-muted">PMG never submits for you. {manager?.name.split(" ")[0]} will see your answers and the linked evidence.</p>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <div className="sticky top-24 card p-5 max-h-[calc(100vh-120px)] overflow-y-auto">
                <h2 className="section-title mb-3">Evidence</h2>
                <div className="flex gap-1 mb-4 flex-wrap">
                  {[["all", "All"], ["wins", "Wins"], ["checkins", "Check-ins"], ["blockers", "Blockers"], ["feedback", "Feedback"]].map(([k, l]) => (
                    <Link key={k} href={`/reviews/self?tab=${k}${cite ? `&cite=${cite}` : ""}`} className={cx("px-3 py-1 rounded-full text-label-sm border", tab === k ? "bg-teal text-white border-teal" : "border-line")}>{l}</Link>
                  ))}
                </div>
                {selected && (
                  <div className="rounded-xl border-2 border-teal bg-teal-tint/30 p-4 mb-4">
                    <p className="text-label-sm text-teal uppercase tracking-wide">Source [{selected.n}]</p>
                    <p className="text-title-md mt-1">{selected.label}</p>
                    <p className="text-body-md text-muted mt-1">{selected.detail}</p>
                    <p className="text-body-sm text-muted mt-1">{fmtDate(selected.date)}</p>
                  </div>
                )}
                <ul className="space-y-2">
                  {filtered.map((e) => (
                    <li key={e.n} id={`ev-${e.n}`}>
                      <Link href={`/reviews/self?cite=${e.n}&tab=${tab}`} className={cx("flex items-start gap-3 rounded-lg border p-3 hover:border-teal/40", cite === e.n ? "border-teal" : "border-line")}>
                        <span className="text-label-sm text-muted w-7">[{e.n}]</span>
                        <Icon name={KIND_ICON[e.kind]} className="text-[18px] text-teal" />
                        <span className="flex-1 min-w-0"><span className="block text-body-md line-clamp-2">{e.label}</span><span className="text-body-sm text-muted">{fmtDate(e.date)}</span></span>
                        {!cited.has(e.n) && <Pill tone="slate">Not cited yet</Pill>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
