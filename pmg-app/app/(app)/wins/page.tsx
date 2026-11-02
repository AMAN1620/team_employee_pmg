import Link from "next/link";
import { requirePerson } from "@/lib/session";
import { AiBox, Avatar, Card, Empty, EvidenceChip, Icon, PageHeader, Pill, Stat, cx, fmtDate } from "@/components/ui";
import { goalsFor, listPeople, parseEvidence, peopleById, winsFor, type Win } from "@/lib/repo";
import { daysBetween, today, QUARTER_START } from "@/lib/time";
import { addWinAction, giveKudosAction, preferencesAction, winAction } from "@/app/actions/app";

const KIND: Record<Win["kind"], { label: string; icon: string; tone: string }> = {
  win: { label: "Win", icon: "emoji_events", tone: "bg-violet-tint text-violet" },
  kudos: { label: "Kudos", icon: "favorite", tone: "bg-rose-100 text-rose-600" },
  helped: { label: "Helped others", icon: "volunteer_activism", tone: "bg-teal-tint text-teal" },
  unplanned: { label: "Unplanned work", icon: "bolt", tone: "bg-slate-100 text-slate-600" },
};
const VIS: Record<string, [string, string]> = { private: ["Only me", "lock"], manager: ["Manager", "supervisor_account"], team: ["Team", "group"], company: ["Company", "public"] };

/** Outcome-focused rewording, e.g. "step-2 completion went up 9% after checklist v1" → "Lifted step-2 completion by 9% …". */
function strongerWording(title: string): string | null {
  const m = title.match(/^(.*?)\s+(?:went up|up|increased|rose)\s+(?:by\s+)?(\d+(?:\.\d+)?%)(.*)$/i);
  if (m) return `Lifted ${m[1].replace(/^[A-Z]/, (c) => c.toLowerCase())} by ${m[2]}${m[3]}`;
  const d = title.match(/^(.*?)\s+(?:went down|down|dropped|fell)\s+(?:by\s+)?(\d+(?:\.\d+)?%)(.*)$/i);
  if (d) return `Cut ${d[1].replace(/^[A-Z]/, (c) => c.toLowerCase())} by ${d[2]}${d[3]}`;
  return null;
}

export default async function WinsPage({ searchParams }: { searchParams: Promise<{ filter?: string; add?: string; kudos?: string; added?: string; sent?: string }> }) {
  const me = await requirePerson();
  const sp = await searchParams;
  const people = peopleById();
  const all = winsFor(me.id);
  const quarter = all.filter((w) => w.at >= QUARTER_START);
  const filter = sp.filter ?? "all";
  const shown = all.filter((w) => filter === "all" || (filter === "wins" ? w.kind === "win" : w.kind === filter));
  const goals = goalsFor(me.id).filter((g) => g.status === "approved");
  const thisWeek = shown.filter((w) => daysBetween(w.at, today()) < 7);
  const earlier = shown.filter((w) => daysBetween(w.at, today()) >= 7);
  const highlights = quarter.filter((w) => w.kind === "win" && w.at.slice(0, 7) === today().slice(0, 7)).slice(0, 3);

  return (
    <div>
      <PageHeader title="Wins journal" subtitle="Your record of what you've achieved. Private unless you share it."
        right={<><Link href="/wins?add=1" className="btn-primary"><Icon name="add" className="text-[18px]" /> Add a win</Link><Link href="/wins?kudos=1" className="btn-kudos"><Icon name="favorite" className="text-[18px]" /> Give kudos</Link></>} />
      {sp.added && <Banner>Win saved to your journal.</Banner>}
      {sp.sent && <Banner>Kudos sent. It&apos;s in their wins journal and they got a message in chat.</Banner>}

      {(sp.add || sp.kudos) && (
        <Card className="p-6 mb-6">
          {sp.add ? (
            <form action={addWinAction} className="grid md:grid-cols-2 gap-4">
              <label className="md:col-span-2"><span className="label">What did you achieve?</span><input name="title" required className="input" placeholder="e.g. Shipped checklist v1 to 20% of new accounts" /></label>
              <label><span className="label">Goal</span><select name="goalId" className="input"><option value="">Not linked to a goal</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
              <label><span className="label">Type</span><select name="kind" className="input"><option value="win">Win</option><option value="unplanned">Unplanned / support work</option></select></label>
              <label><span className="label">Evidence link</span><input name="link" className="input" placeholder="Jira, doc or dashboard link" /></label>
              <label><span className="label">Who can see it?</span><select name="visibility" defaultValue={me.default_visibility} className="input">{Object.entries(VIS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <div className="md:col-span-2 flex gap-2"><button className="btn-primary">Save win</button><Link href="/wins" className="btn-secondary">Cancel</Link></div>
            </form>
          ) : (
            <form action={giveKudosAction} className="grid md:grid-cols-[260px_1fr_auto] gap-4 items-end">
              <input type="hidden" name="back" value="/wins?sent=1" />
              <label><span className="label">Who?</span><select name="toId" className="input">{listPeople().filter((p) => p.id !== me.id && p.id !== "neha").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label><span className="label">For…</span><input name="message" required className="input" placeholder="e.g. unblocking the release so fast" /></label>
              <div className="flex gap-2"><button className="btn-kudos">Send kudos</button><Link href="/wins" className="btn-secondary">Cancel</Link></div>
            </form>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {[["all", "All"], ["wins", "Wins"], ["kudos", "Kudos received"], ["helped", "Helped others"], ["unplanned", "Unplanned work"]].map(([k, l]) => (
          <Link key={k} href={`/wins?filter=${k}`} className={cx("px-3 py-1.5 rounded-full text-label-md border", filter === k ? "bg-violet text-white border-violet" : "bg-white border-line text-on-surface-variant hover:border-violet")}>{l}</Link>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-line text-label-md"><Icon name="calendar_today" className="text-[16px]" /> Q3 FY27</span>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <Stat label="Wins this quarter" value={quarter.filter((w) => w.kind === "win").length} tone="violet" />
        <Stat label="Kudos received" value={quarter.filter((w) => w.kind === "kudos").length} tone="violet" />
        <Stat label="Blockers cleared for others" value={quarter.filter((w) => w.kind === "helped").length} tone="violet" />
        <Stat label="Unplanned work logged" value={quarter.filter((w) => w.kind === "unplanned").length} tone="violet" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {shown.length === 0 && <Card><Empty icon="celebration" title="No entries yet">Add a win or confirm a check-in to start your journal.</Empty></Card>}
          {[["This week", thisWeek], ["Earlier this quarter", earlier]].map(([label, list]) => (list as Win[]).length > 0 && (
            <section key={label as string}>
              <h2 className="text-label-sm text-muted uppercase tracking-wide mb-3">{label as string}</h2>
              <div className="space-y-3">
                {(list as Win[]).map((w) => {
                  const k = KIND[w.kind];
                  const better = w.kind === "win" ? strongerWording(w.title) : null;
                  return (
                    <Card key={w.id} className={cx("p-5", w.kind === "kudos" && "border-t-[3px] border-t-violet")}>
                      <div className="flex items-start gap-3">
                        <div className={cx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", k.tone)}><Icon name={k.icon} fill={w.kind === "kudos"} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap"><span className="text-label-sm uppercase tracking-wide text-muted">{k.label}</span>{w.tag && <Pill tone="slate">{w.tag}</Pill>}<span className="text-body-sm text-muted">· {fmtDate(w.at)}</span></div>
                          {w.kind === "kudos" ? (
                            <p className="text-title-md mt-1 flex items-center gap-2"><Avatar name={people.get(w.from_id!)?.name ?? ""} size={24} /> {people.get(w.from_id!)?.name}: <span className="font-normal italic">“{w.title}”</span></p>
                          ) : <p className="text-title-md mt-1">{w.title}</p>}
                          {w.body && <p className="text-body-md text-muted mt-1">{w.body}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {w.goal_id && <Pill tone="teal" icon="flag">{goals.find((g) => g.id === w.goal_id)?.title}</Pill>}
                            {parseEvidence(w).map((e) => <EvidenceChip key={e.label} kind={e.kind} label={e.label} href={e.url} />)}
                            {w.source === "chat" && <span className="text-body-sm text-muted">via chat</span>}
                            {w.source === "auto" && <span className="text-body-sm text-muted">Added automatically when you cleared a blocker</span>}
                          </div>
                          {better && better !== w.title && (
                            <AiBox title="Stronger wording · Drafted by PMG" tone="violet" className="mt-3 p-3">
                              <p className="text-body-md">{better}</p>
                              <form action={winAction} className="mt-2 flex gap-2"><input type="hidden" name="winId" value={w.id} /><input type="hidden" name="op" value="reword" /><input type="hidden" name="title" value={better} /><button className="btn-kudos btn-sm">Use</button></form>
                            </AiBox>
                          )}
                        </div>
                        <form action={winAction} className="shrink-0">
                          <input type="hidden" name="winId" value={w.id} /><input type="hidden" name="op" value="visibility" />
                          <select name="visibility" defaultValue={w.visibility} className="input h-8 text-body-sm w-32" aria-label="Who can see this">
                            {Object.entries(VIS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <button className="text-label-sm text-teal mt-1 w-full text-right">Update</button>
                        </form>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card accent="violet" className="p-6">
            <h2 className="section-title">{new Date(today()).toLocaleDateString("en-GB", { month: "long" })} highlights</h2>
            <p className="text-body-md text-muted mt-1">Your top wins this month, ready to share before your 1:1.</p>
            <ul className="mt-3 space-y-2">{highlights.map((w) => <li key={w.id} className="text-body-md flex gap-2"><Icon name="star" className="text-[18px] text-violet" fill /> {w.title}</li>)}</ul>
            <Link href="/one-on-ones" className="btn-kudos w-full mt-4">Add to my 1:1 with {people.get(me.manager_id ?? "")?.name.split(" ")[0]}</Link>
          </Card>
          <Card className="p-6">
            <h2 className="section-title mb-3">How do you like to be recognized?</h2>
            <form action={preferencesAction} className="space-y-2">
              {[["private", "Privately with my manager"], ["team", "In front of my team"], ["company", "Company-wide"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-body-md"><input type="radio" name="recognition" value={v} defaultChecked={me.recognition_pref === v} className="accent-teal" /> {l}</label>
              ))}
              <button className="btn-secondary btn-sm mt-2">Save</button>
            </form>
            <p className="text-body-sm text-muted mt-3">Kudos people give you follow this setting.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 rounded-xl border border-violet/30 bg-violet-tint/50 p-4 text-body-md text-violet">{children}</div>;
}
