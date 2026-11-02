import { requirePerson } from "@/lib/session";
import { Card, Icon, PageHeader, Pill, cx, fmtDate } from "@/components/ui";
import { activeCycle, listTeams, ratingLevels } from "@/lib/repo";
import { cycleAction } from "@/app/actions/app";

const STEPS = ["Basics", "Participants", "Reviews and form", "Rating scale", "Schedule and launch"];

export default async function CyclesPage({ searchParams }: { searchParams: Promise<{ step?: string; saved?: string }> }) {
  await requirePerson();
  const sp = await searchParams;
  const cycle = activeCycle();
  if (!cycle) return null;
  const levels = ratingLevels(cycle.id);
  const step = Math.min(5, Math.max(1, Number(sp.step ?? 4)));
  const teams = listTeams();

  return (
    <div>
      <PageHeader title="Review cycle" subtitle={`${cycle.name} · live`} chip={<Pill tone="green" icon="play_circle">Running</Pill>} />
      <ol className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const n = i + 1;
          return (
            <li key={s} className="flex items-center gap-2 flex-1">
              <a href={`/hr/cycles?step=${n}`} className={cx("flex items-center gap-2 text-label-md", n === step ? "text-teal" : n < step ? "text-ink" : "text-muted")}>
                <span className={cx("w-7 h-7 rounded-full flex items-center justify-center text-label-sm", n < step ? "bg-teal text-white" : n === step ? "border-2 border-teal text-teal" : "border border-line")}>{n < step ? <Icon name="check" className="text-[16px]" /> : n}</span>{s}
              </a>
              {n < STEPS.length && <span className="flex-1 h-px bg-line" />}
            </li>
          );
        })}
      </ol>
      {sp.saved && <div className="mb-6 rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">Saved. Goal cards show the updated rubric right away.</div>}

      <form action={cycleAction} className="grid grid-cols-12 gap-6">
        <input type="hidden" name="nextStep" value={step} />
        <input type="hidden" name="flags" value={step === 4 ? "show_rubric,require_comment,forced_distribution" : step === 3 ? "peer_enabled" : ""} />
        <Card className="col-span-12 lg:col-span-8 p-6">
          {step === 4 && (
            <>
              <h2 className="section-title">Rating scale and rubric</h2>
              <p className="text-body-md text-muted mb-5">Employees see this on every goal card from day one, not just at review time.</p>
              <div className="space-y-3">
                {levels.map((l) => (
                  <div key={l.level} className="grid grid-cols-[40px_200px_1fr] gap-3 items-center">
                    <span className="w-9 h-9 rounded-full bg-teal-tint text-teal flex items-center justify-center text-title-md">{l.level}</span>
                    <input name={`label_${l.level}`} defaultValue={l.label} className="input" />
                    <input name={`desc_${l.level}`} defaultValue={l.description} className="input" />
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3 border-t border-line pt-5">
                <Toggle name="show_rubric" label="Show the rubric on goal cards" on={!!cycle.show_rubric} />
                <Toggle name="require_comment" label="Require a comment for ratings 1 and 5" on={!!cycle.require_comment} />
                <Toggle name="forced_distribution" label="Use a forced distribution (bell curve)" on={!!cycle.forced_distribution} note="Off by default. PMG shows the rating spread for calibration instead." />
              </div>
            </>
          )}
          {step === 1 && <Summary rows={[["Name", cycle.name], ["Type", "Mid-year review"], ["Covers", "1 Apr – 30 Sep 2026 goals, plus Q3 progress"]]} />}
          {step === 2 && <Summary rows={[["Participants", `${cycle.participants} employees`], ...teams.map((t) => [t.name, `${t.headcount} people`] as [string, string])]} />}
          {step === 3 && (
            <>
              <h2 className="section-title mb-4">Reviews and form</h2>
              <div className="space-y-3">
                <Toggle name="self" label="Self-appraisal (AI drafts from the employee's own evidence)" on disabled />
                <Toggle name="manager" label="Manager review with evidence beside the rating" on disabled />
                <Toggle name="peer_enabled" label="Peer reviews" on={!!cycle.peer_enabled} />
              </div>
              <p className="text-body-md text-muted mt-4">Form: one section per goal (rating + comment), plus “Beyond my goals” and an overall comment.</p>
            </>
          )}
          {step === 5 && <Summary rows={[["Self-appraisals due", fmtDate(cycle.self_due, { day: "numeric", month: "long", year: "numeric" })], ["Manager reviews due", fmtDate(cycle.manager_due, { day: "numeric", month: "long", year: "numeric" })], ["Reminders", "In chat, 3 days and 1 day before each deadline"], ["Status", "Launched 2 Nov 2026"]]} />}
        </Card>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="p-6">
            <p className="label">Summary</p>
            <dl className="space-y-2 text-body-md">
              <div><dt className="text-muted">Name</dt><dd>{cycle.name}</dd></div>
              <div><dt className="text-muted">Participants</dt><dd>{cycle.participants} employees · {teams.length} teams</dd></div>
              <div><dt className="text-muted">Reviews</dt><dd>Self ✓ · Manager ✓ · Peer: {cycle.peer_enabled ? "on" : "off"}</dd></div>
              <div><dt className="text-muted">Form</dt><dd>Standard goal review</dd></div>
            </dl>
          </Card>
          <Card className="p-6">
            <p className="label">How employees will see it</p>
            <div className="rounded-lg border border-line p-3">
              <p className="text-label-md">Reduce onboarding drop-off from 38% to 25%</p>
              {levels.slice(1, 4).map((l) => <p key={l.level} className="text-body-sm mt-1"><b>{l.label}:</b> <span className="text-muted">{l.description}</span></p>)}
            </div>
          </Card>
          <div className="flex gap-2">
            {step > 1 && <a href={`/hr/cycles?step=${step - 1}`} className="btn-secondary">Back</a>}
            {(step === 3 || step === 4) && <button className="btn-secondary">Save</button>}
            {step < 5 && <a href={`/hr/cycles?step=${step + 1}`} className="btn-primary">Next: {STEPS[step]}</a>}
          </div>
        </div>
      </form>
    </div>
  );
}

function Toggle({ name, label, on, note, disabled }: { name: string; label: string; on: boolean; note?: string; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={on} disabled={disabled} className="peer sr-only" />
      <span className="mt-0.5 w-10 h-6 rounded-full bg-slate-200 relative transition-colors peer-checked:bg-teal after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
      <span><span className="text-body-md">{label}</span>{note && <span className="block text-body-sm text-muted">{note}</span>}</span>
    </label>
  );
}

function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => <div key={k} className="py-3 grid grid-cols-[220px_1fr]"><dt className="text-label-md">{k}</dt><dd className="text-body-md">{v}</dd></div>)}
    </dl>
  );
}
