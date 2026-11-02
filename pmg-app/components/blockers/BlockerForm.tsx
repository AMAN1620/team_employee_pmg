"use client";
// Raise a blocker: what kind it is decides the next question. People and dependencies asks who (people and/or
// teams, or None); every other kind asks whether to tell the manager, someone else or nobody, and leans on a
// free-text description instead of sub-categories. PMG drafts the email from what's typed, shown as you go.
import { useActionState, useMemo, useState } from "react";
import { Icon, cx } from "@/components/ui";
import { BLOCKER_CATEGORIES, CHANNEL_LABEL, draftBlockerEmail } from "@/lib/logic/blocked";
import { raiseBlockerFormAction } from "@/app/actions/blockers";

type PersonOpt = { id: string; name: string; title: string; team: string };
type TeamOpt = { id: string; name: string; head: string };
type GoalOpt = { id: number; title: string; milestones: { id: number; title: string }[] };

export function BlockerForm({ me, manager, people, teams, goals, channel, initial, cancelHref }: {
  me: string; manager: { id: string; name: string } | null; people: PersonOpt[]; teams: TeamOpt[]; goals: GoalOpt[]; channel: string;
  initial: { goalId: number | null; milestoneId: number | null; origin: string; title: string; needBy: string }; cancelHref: string;
}) {
  const [state, action, pending] = useActionState(raiseBlockerFormAction, { error: null });
  const [category, setCategory] = useState("people");
  const [picked, setPicked] = useState<string[]>([]); // "p:id" or "t:id"
  const [none, setNone] = useState(false);
  const [query, setQuery] = useState("");
  const [notify, setNotify] = useState<"manager" | "person" | "none">(manager ? "manager" : "person");
  const [notifyPerson, setNotifyPerson] = useState("");
  const [goalId, setGoalId] = useState(initial.goalId ? String(initial.goalId) : "");
  const [milestoneId, setMilestoneId] = useState(initial.milestoneId ? String(initial.milestoneId) : "");
  const [title, setTitle] = useState(initial.title);
  const [needed, setNeeded] = useState("");
  const [needBy, setNeedBy] = useState(initial.needBy);
  const [details, setDetails] = useState("");

  const isPeople = category === "people";
  const goal = goals.find((g) => String(g.id) === goalId);
  const milestone = goal?.milestones.find((m) => String(m.id) === milestoneId);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { people: [], teams: [] };
    return {
      teams: teams.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 3),
      people: people.filter((p) => `${p.name} ${p.title} ${p.team}`.toLowerCase().includes(q)).slice(0, 6),
    };
  }, [query, people, teams]);
  const label = (key: string) => (key.startsWith("t:") ? teams.find((t) => `t:${t.id}` === key)?.name : people.find((p) => `p:${p.id}` === key)?.name) ?? key;
  const toggle = (key: string) => { setNone(false); setPicked(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]); setQuery(""); };

  // Who the request goes to, for the preview: people tagged, team heads, or the person chosen to tell.
  const recipients: string[] = isPeople
    ? none ? [] : picked.map((k) => (k.startsWith("t:") ? teams.find((t) => `t:${t.id}` === k)?.head ?? "" : label(k))).filter(Boolean)
    : notify === "manager" && manager ? [manager.name] : notify === "person" && notifyPerson ? [people.find((p) => p.id === notifyPerson)?.name ?? ""] : [];
  const email = recipients[0] && title.trim().length > 2 ? draftBlockerEmail({ title, needed, details, needBy, goal: goal?.title, milestone: milestone?.title }, me, recipients[0]) : null;

  return (
    <form action={action} className="p-6 space-y-5">
      <input type="hidden" name="origin" value={initial.origin} />
      <input type="hidden" name="category" value={category} />
      {picked.map((k) => <input key={k} type="hidden" name={k.startsWith("t:") ? "team" : "person"} value={k.slice(2)} />)}

      <label className="block"><span className="label">What&apos;s stuck?</span>
        <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="e.g. Can't load-test memory lookups without staging access" /></label>

      <div>
        <span className="label">What kind of blocker is it?</span>
        <select aria-label="Blocker category" value={category} onChange={(e) => setCategory(e.target.value)} className="input">
          {BLOCKER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <p className="text-body-sm text-muted mt-1">{BLOCKER_CATEGORIES.find((c) => c.key === category)?.help}</p>
      </div>

      {isPeople ? (
        <div>
          <span className="label">Who can unblock it? People and/or teams</span>
          <div className={cx("rounded-lg border border-line p-2 bg-white", none && "opacity-60")}>
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {picked.map((k) => (
                  <span key={k} className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-label-sm", k.startsWith("t:") ? "bg-violet-tint text-violet" : "bg-teal-tint text-teal")}>
                    <Icon name={k.startsWith("t:") ? "groups" : "person"} className="text-[14px]" />{label(k)}
                    <button type="button" onClick={() => toggle(k)} aria-label={`Remove ${label(k)}`}><Icon name="close" className="text-[14px]" /></button>
                  </span>
                ))}
              </div>
            )}
            <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={none} aria-label="Search people and teams" placeholder="Type a name or a team…" className="w-full outline-none text-body-md px-1 py-1 bg-transparent" />
            {(matches.teams.length > 0 || matches.people.length > 0) && (
              <ul className="mt-1 border-t border-line pt-1 max-h-56 overflow-y-auto">
                {matches.teams.map((t) => (
                  <li key={t.id}><button type="button" onClick={() => toggle(`t:${t.id}`)} className="w-full text-left px-2 py-1.5 rounded hover:bg-canvas flex items-center gap-2 text-body-md">
                    <Icon name="groups" className="text-[18px] text-violet" /><span className="flex-1">{t.name} team</span><span className="text-body-sm text-muted">goes to {t.head}</span></button></li>
                ))}
                {matches.people.map((p) => (
                  <li key={p.id}><button type="button" onClick={() => toggle(`p:${p.id}`)} className="w-full text-left px-2 py-1.5 rounded hover:bg-canvas flex items-center gap-2 text-body-md">
                    <Icon name="person" className="text-[18px] text-teal" /><span className="flex-1">{p.name}</span><span className="text-body-sm text-muted truncate max-w-40">{p.title}</span></button></li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex items-center gap-2 mt-2 text-body-md"><input type="checkbox" name="none" checked={none} onChange={(e) => { setNone(e.target.checked); if (e.target.checked) setPicked([]); }} className="accent-teal" /> None: no one here can unblock it, just track it</label>
          {picked.some((k) => k.startsWith("t:")) && <p className="text-body-sm text-muted mt-1">A team goes to its head, who can pass it to the right person.</p>}
        </div>
      ) : (
        <div>
          <span className="label">Who should know?</span>
          <div className="space-y-2">
            {manager && <label className="flex items-center gap-2 text-body-md"><input type="radio" name="notify" value="manager" checked={notify === "manager"} onChange={() => setNotify("manager")} className="accent-teal" /> Notify my manager, {manager.name}</label>}
            <label className="flex items-center gap-2 text-body-md"><input type="radio" name="notify" value="person" checked={notify === "person"} onChange={() => setNotify("person")} className="accent-teal" /> Notify someone else</label>
            {notify === "person" && (
              <select name="notifyPerson" aria-label="Who to notify" value={notifyPerson} onChange={(e) => setNotifyPerson(e.target.value)} className="input ml-6 w-[calc(100%-1.5rem)]">
                <option value="">Pick a person…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.title}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 text-body-md"><input type="radio" name="notify" value="none" checked={notify === "none"} onChange={() => setNotify("none")} className="accent-teal" /> No one yet, just track it</label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block col-span-2"><span className="label">Which goal does it affect?</span>
          <select name="goalId" value={goalId} onChange={(e) => { setGoalId(e.target.value); setMilestoneId(""); }} className="input">
            <option value="">No specific goal</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select></label>
        {goal && goal.milestones.length > 0 && (
          <label className="block col-span-2"><span className="label">Which task or milestone? (optional)</span>
            <select name="milestoneId" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className="input">
              <option value="">The goal as a whole</option>
              {goal.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select></label>
        )}
        <label className="block col-span-2"><span className="label">What&apos;s needed?</span>
          <input name="needed" value={needed} onChange={(e) => setNeeded(e.target.value)} className="input" placeholder="e.g. Read access to the staging database" /></label>
        <label className="block"><span className="label">Needed by</span>
          <input name="needBy" type="date" value={needBy} onChange={(e) => setNeedBy(e.target.value)} className="input" /></label>
      </div>

      <label className="block"><span className="label">Describe the blocker in detail</span>
        <textarea name="details" value={details} onChange={(e) => setDetails(e.target.value)} className="textarea min-h-[90px]"
          placeholder={isPeople ? "Anything they should know: what you tried, links, who else is involved…" : "What's happening, what you've tried, and what would help. No need to pick a sub-category."} /></label>

      {email && (
        <details className="rounded-lg border border-line bg-canvas/60">
          <summary className="cursor-pointer px-3 py-2 text-label-md flex items-center gap-2"><Icon name="mail" className="text-[18px] text-teal" /> Email PMG drafted for {recipients[0].split(" ")[0]}{recipients.length > 1 ? ` (+${recipients.length - 1} more)` : ""}</summary>
          <div className="px-3 pb-3 text-body-sm">
            <p className="font-medium">{email.subject}</p>
            <pre className="whitespace-pre-wrap font-sans text-body-sm text-muted mt-1">{email.body}</pre>
          </div>
        </details>
      )}

      <div className="rounded-lg bg-teal-tint/40 border border-teal/20 p-3 text-body-sm text-ink flex gap-2">
        <Icon name="campaign" className="text-[18px] text-teal shrink-0" />
        <span>{recipients.length ? `PMG sends it to ${recipients.join(", ")} in PMG chat and on ${CHANNEL_LABEL[channel] ?? channel} (mocked in this prototype), with the email above.` : "PMG keeps track of it and counts the days you're blocked on your goal."} Reminders follow a day before and on the day it&apos;s needed.</span>
      </div>

      {state.error && <p className="text-body-sm text-rose-700">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn-primary">{pending ? "Raising…" : recipients.length ? "Raise and send" : "Raise blocker"}</button>
        <a href={cancelHref} className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
