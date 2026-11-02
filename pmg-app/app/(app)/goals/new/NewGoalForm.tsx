"use client";
// Create a goal: work or personal, for a week, a month or a quarter. A goal can sit inside a bigger one you set
// (top-down), or gather the smaller ones you already set (bottom-up). The buttons follow the approval rules:
// personal goals and weeks inside an approved goal are set at once; other work goals go to the manager.
import { useActionState, useMemo, useState } from "react";
import { Icon, cx } from "@/components/ui";
import { checkGoalQualityRules } from "@/lib/ai/fallback";
import { fitsInside, goalRange } from "@/lib/planner";
import { createOwnGoalAction } from "@/app/actions/goals";

export type FormGoal = {
  id: number; title: string; kind: "work" | "personal"; horizon: "week" | "month" | "quarter"; start_date: string;
  status: "draft" | "pending" | "changes_requested" | "approved"; parent_id: number | null;
};
type Horizon = FormGoal["horizon"];
type Option = { value: string; label: string };

const LENGTHS: { h: Horizon; label: string; icon: string; help: string }[] = [
  { h: "week", label: "A week", icon: "view_week", help: "Something you'll get done in one week. Add steps to tick off." },
  { h: "month", label: "A month", icon: "calendar_month", help: "Bigger. Its weekly goals roll up into it." },
  { h: "quarter", label: "A quarter", icon: "flag", help: "The big picture. Break it into months and weeks." },
];
const HOLDS: Record<Horizon, Horizon[]> = { week: ["month", "quarter"], month: ["quarter"], quarter: [] };
const GATHERS: Record<Horizon, Horizon | null> = { week: null, month: "week", quarter: "month" };
const NAME: Record<Horizon, string> = { week: "week", month: "month", quarter: "quarter" };

export function NewGoalForm({ options, own, teamGoals, managerFirst, initial }: {
  options: Record<Horizon, Option[]>; own: FormGoal[]; teamGoals: { id: number; title: string }[]; managerFirst: string;
  initial: { kind: "work" | "personal"; horizon: Horizon; start: string; parentId: number | null };
}) {
  const [state, action, pending] = useActionState(createOwnGoalAction, { error: null });
  const [kind, setKind] = useState(initial.kind);
  const [horizon, setHorizon] = useState<Horizon>(initial.horizon);
  const [parentId, setParentId] = useState<number | null>(initial.parentId);
  const [start, setStart] = useState(() => pickStart(initial.horizon, initial.start, own.find((g) => g.id === initial.parentId)));
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [dismissed, setDismissed] = useState(false);

  function pickStart(h: Horizon, wanted: string, parent?: FormGoal) {
    const fits = options[h].filter((o) => !parent || fitsInside({ horizon: h, start_date: o.value }, parent));
    return (fits.find((o) => o.value === wanted) ?? fits[0] ?? options[h][0])?.value ?? "";
  }

  const here = { horizon, start_date: start };
  const parents = useMemo(() => own.filter((g) => g.kind === kind && HOLDS[horizon].includes(g.horizon) && fitsInside(here, g)), [own, kind, horizon, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const parent = parents.find((g) => g.id === parentId);
  const gather = GATHERS[horizon];
  const loose = useMemo(() => own.filter((g) => g.kind === kind && g.horizon === gather && !g.parent_id && fitsInside(g, here)), [own, kind, gather, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const startOptions = options[horizon].filter((o) => !parent || fitsInside({ horizon, start_date: o.value }, parent));
  const end = start ? goalRange(horizon, start).end : "";
  const quality = checkGoalQualityRules({ title, dueDate: end });
  const work = kind === "work";
  const covered = work && parent?.status === "approved";
  const waits = work && parent?.status === "pending";

  const changeHorizon = (h: Horizon) => {
    setHorizon(h);
    const p = own.find((g) => g.id === parentId);
    const keep = p && HOLDS[h].includes(p.horizon) ? p : undefined;
    setParentId(keep?.id ?? null);
    setStart(pickStart(h, start, keep));
  };

  return (
    <form action={action} className="grid grid-cols-12 gap-6">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="horizon" value={horizon} />
      <div className="col-span-12 lg:col-span-8 card p-6 space-y-7">
        <Section n={1} title="Work or personal?">
          <div className="grid sm:grid-cols-2 gap-3">
            <Choice on={work} onClick={() => { setKind("work"); setParentId(null); }} icon="work" title="Work"
              help={`Something for your job. ${managerFirst} approves it.`} tone="teal" />
            <Choice on={!work} onClick={() => { setKind("personal"); setParentId(null); }} icon="self_improvement" title="Personal"
              help="A side goal just for you. No approval, and only you see it." tone="violet" />
          </div>
        </Section>

        <Section n={2} title="How long is it for?">
          <div className="grid sm:grid-cols-3 gap-3">
            {LENGTHS.map((l) => <Choice key={l.h} on={horizon === l.h} onClick={() => changeHorizon(l.h)} icon={l.icon} title={l.label} help={l.help} tone={work ? "teal" : "violet"} />)}
          </div>
          <label className="block mt-4">
            <span className="label">Which {NAME[horizon]}?</span>
            <select name="start" value={start} onChange={(e) => setStart(e.target.value)} className="input">
              {startOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {HOLDS[horizon].length > 0 && (
            <label className="block mt-4">
              <span className="label">Part of a bigger goal? (optional)</span>
              <select name="parentId" value={parent?.id ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)} className="input">
                <option value="">Not part of a bigger goal</option>
                {parents.map((g) => <option key={g.id} value={g.id}>{g.horizon === "quarter" ? "Quarter" : "Month"} · {g.title}{work && g.status !== "approved" ? ` (${g.status === "pending" ? "waiting for approval" : "draft"})` : ""}</option>)}
              </select>
              {parents.length === 0 && <span className="text-body-sm text-muted mt-1 block">No {kind} {HOLDS[horizon].join(" or ")} goal covers this {NAME[horizon]} yet.</span>}
            </label>
          )}
          {horizon === "quarter" && work && teamGoals.length > 0 && (
            <label className="block mt-4">
              <span className="label">Supports a team goal? (optional)</span>
              <select name="teamGoalId" defaultValue="" className="input">
                <option value="">No team goal</option>
                {teamGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </label>
          )}
        </Section>

        <Section n={3} title="What do you want to achieve?">
          <input name="title" required value={title} onChange={(e) => { setTitle(e.target.value); setDismissed(false); }} maxLength={200} className="input"
            placeholder={horizon === "week" ? "e.g. Write the memory gating design note and review it with the team" : horizon === "month" ? "e.g. Cross-chat memory recalls the right past chats in staging" : "e.g. Make cross-chat memory dependable for every Simkey user"} />
          {work && title.length > 5 && !dismissed && !quality.ok && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-label-sm text-amber-800 uppercase tracking-wide flex items-center gap-1"><Icon name="auto_awesome" className="text-[16px]" /> Goal check · Drafted by PMG</p>
              <ul className="text-body-md text-amber-900 mt-1 list-disc ml-5">{quality.issues.map((i) => <li key={i}>{i}</li>)}</ul>
              {quality.suggestion && <p className="text-body-md mt-2">Try: <b>{quality.suggestion}</b></p>}
              <div className="flex gap-2 mt-3">
                {quality.suggestion && <button type="button" onClick={() => setTitle(quality.suggestion!)} className="btn-primary btn-sm">Use suggestion</button>}
                <button type="button" onClick={() => setDismissed(true)} className="btn-ghost btn-sm">Dismiss</button>
              </div>
            </div>
          )}
        </Section>

        {horizon === "week" ? (
          <Section n={4} title="Steps (optional)">
            <p className="text-body-sm text-muted -mt-1 mb-2">Tick them off during the week; the goal's progress follows them.</p>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input name="steps" value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} maxLength={200} className="input" placeholder={`Step ${i + 1}`} />
                  {steps.length > 1 && <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="btn-ghost btn-sm" aria-label="Remove step"><Icon name="close" /></button>}
                </div>
              ))}
            </div>
            {steps.length < 12 && <button type="button" onClick={() => setSteps([...steps, ""])} className="btn-ghost btn-sm text-teal mt-2"><Icon name="add" className="text-[16px]" /> Add a step</button>}
          </Section>
        ) : (
          <Section n={4} title={`Bring in ${gather === "week" ? "weekly" : "monthly"} goals you already set (optional)`}>
            {loose.length === 0 ? (
              <p className="text-body-md text-muted">No {kind} {gather === "week" ? "weekly" : "monthly"} goals in this {NAME[horizon]} are waiting for a bigger goal. Ones you add inside it later count towards it too.</p>
            ) : (
              <div className="space-y-2">
                {loose.map((g) => (
                  <label key={g.id} className="flex items-center gap-3 rounded-lg border border-line p-3 hover:border-teal/50 cursor-pointer">
                    <input type="checkbox" name="childId" value={g.id} className="accent-teal w-4 h-4" />
                    <span className="flex-1 text-body-md">{g.title}</span>
                    {work && g.status !== "approved" && <span className="text-body-sm text-muted">{g.status === "pending" ? "Waiting" : "Draft"}</span>}
                  </label>
                ))}
                {work && <p className="text-body-sm text-muted">Drafts you bring in go to {managerFirst} with this goal, and are approved with it.</p>}
              </div>
            )}
          </Section>
        )}
      </div>

      <div className="col-span-12 lg:col-span-4">
        <div className="card p-6 lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center gap-2">
            <span className={cx("w-9 h-9 rounded-lg flex items-center justify-center", work ? "bg-teal-tint text-teal" : "bg-violet-tint text-violet")}><Icon name={work ? "work" : "self_improvement"} /></span>
            <div><p className="text-title-md">{work ? "Work" : "Personal"} goal for {options[horizon].find((o) => o.value === start)?.label.replace(/^(This|Next) week · /, "").replace(/ · this (month|quarter)$/, "") ?? NAME[horizon]}</p>
              {parent && <p className="text-body-sm text-muted">Inside: {parent.title}</p>}</div>
          </div>
          <p className="text-body-md text-muted">
            {!work ? "No approval needed. It's set as soon as you create it, and only you can see it."
              : covered ? `It's part of a goal ${managerFirst} already approved, so it's set straight away.`
              : waits ? `It waits for ${managerFirst} with the goal it's part of.`
              : `${managerFirst} approves it in chat or on PMG. You can also save it as a draft and send it later.`}
          </p>
          {state.error && <p className="text-body-sm text-rose-700">{state.error}</p>}
          {!work || covered || waits ? (
            <button name="send" value="0" disabled={pending} className="btn-primary w-full">{pending ? "Creating…" : "Create goal"}</button>
          ) : <>
            <button name="send" value="1" disabled={pending} className="btn-primary w-full">{pending ? "Sending…" : `Send to ${managerFirst} for approval`}</button>
            <button name="send" value="0" disabled={pending} className="btn-secondary w-full">Save as draft</button>
          </>}
        </div>
      </div>
    </form>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-title-md flex items-center gap-2 mb-3"><span className="w-6 h-6 rounded-full bg-teal-tint text-teal text-label-sm flex items-center justify-center">{n}</span>{title}</h2>
      {children}
    </section>
  );
}

function Choice({ on, onClick, icon, title, help, tone }: { on: boolean; onClick: () => void; icon: string; title: string; help: string; tone: "teal" | "violet" }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cx("text-left rounded-xl border p-4 transition-colors", on ? (tone === "teal" ? "border-teal ring-2 ring-teal/20 bg-teal-tint/30" : "border-violet ring-2 ring-violet/20 bg-violet-tint/30") : "border-line hover:border-slate-300")}>
      <span className="flex items-center gap-2 text-title-md"><Icon name={icon} className={cx("text-[20px]", on ? (tone === "teal" ? "text-teal" : "text-violet") : "text-muted")} />{title}</span>
      <span className="block text-body-sm text-muted mt-1">{help}</span>
    </button>
  );
}
