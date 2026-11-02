import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { AiBox, Avatar, Card, HealthPill, Icon, Pill, fmtDate } from "@/components/ui";
import { getGoal, getPerson, goalComments, milestonesFor, parseRubric, peopleById } from "@/lib/repo";
import { goalViewsFor } from "@/lib/services/views";
import { checkGoalQuality } from "@/lib/ai";
import { planLabel } from "@/lib/planner";
import { goalsBelow } from "@/lib/services/goals";
import { decideGoalAction, goalCommentAction } from "@/app/actions/app";

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerson();
  const { id } = await params;
  const g = getGoal(Number(id));
  if (!g) notFound();
  const owner = getPerson(g.owner_id)!;
  if (owner.manager_id !== me.id) notFound();
  const people = peopleById();
  const parent = g.parent_id ? getGoal(g.parent_id) : undefined;
  const rubric = parseRubric(g);
  const comments = goalComments(g.id);
  // Planned weeks are checked against their tickets instead of a target and rubric.
  const quality = g.horizon ? { ok: true, issues: [], suggestion: null } : checkGoalQuality({ title: g.title, target: g.target != null ? String(g.target) : null, dueDate: g.due_date, meets: rubric.meets, exceeds: rubric.exceeds });
  const milestones = milestonesFor(g.id);
  const others = goalViewsFor(owner.id).filter((x) => x.id !== g.id);
  const inside = g.source === "manual" && g.horizon ? goalsBelow(g.id) : [];
  const fields: [string, string, string | null][] = [
    ["title", "Outcome", g.title], ["parent", g.horizon ? "Part of" : "Linked team goal", parent?.title ?? null], ["measure", g.horizon ? "Done when" : "Measure", g.measure],
    ["baseline", "Baseline", g.baseline != null ? `${g.baseline}${g.unit ?? ""}` : null], ["target", "Target", g.target != null ? `${g.target}${g.unit ?? ""}` : null],
    ["deadline", "Deadline", fmtDate(g.due_date, { day: "numeric", month: "short", year: "numeric" })], ["dependencies", "Dependencies", g.dependencies],
  ].filter(([, , v]) => !g.horizon || v) as [string, string, string | null][]; // week, month and quarter goals skip the empty review-cycle fields

  return (
    <div className="space-y-6">
      <nav className="text-body-sm text-muted"><Link href="/approvals" className="hover:text-teal">Approvals</Link> / {owner.name}</nav>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={owner.name} size={44} />
        <div><h1 className="text-headline-md">{g.horizon ? `${owner.name}'s goal for ${planLabel(g)}` : `${owner.name} proposed a goal`}</h1><p className="text-body-md text-muted">{g.source === "ai" ? "Planned by PMG from their tickets · " : ""}Submitted {fmtDate(g.submitted_at)}{g.source === "ai" && g.horizon === "week" && <> · <Link href={`/team/${owner.id}?week=${g.start_date}#week`} className="text-teal hover:underline">Edit the wording on their plan</Link></>}</p></div>
        <Pill tone={g.status === "pending" ? "amber" : g.status === "approved" ? "green" : "rose"} className="ml-2">{g.status === "pending" ? "Waiting for you" : g.status === "approved" ? "Approved" : "Changes requested"}</Pill>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Card className="p-6">
            <dl className="divide-y divide-line">
              {fields.map(([key, label, value]) => {
                const thread = comments.filter((c) => c.field === key);
                return (
                  <div key={key} className="py-3">
                    <div className="grid grid-cols-[180px_1fr_auto] gap-3 items-start">
                      <dt className="label mb-0 pt-0.5">{label}</dt><dd className="text-body-md">{value || "—"}</dd>
                      <details className="relative">
                        <summary className="list-none cursor-pointer text-muted hover:text-teal" aria-label={`Comment on ${label}`}><Icon name="add_comment" className="text-[18px]" /></summary>
                        <form action={goalCommentAction} className="absolute right-0 mt-2 w-72 card shadow-pop p-3 z-10 space-y-2">
                          <input type="hidden" name="goalId" value={g.id} /><input type="hidden" name="field" value={key} />
                          <textarea name="body" required className="textarea min-h-[60px]" placeholder={`Comment on ${label.toLowerCase()}…`} /><button className="btn-primary btn-sm">Comment</button>
                        </form>
                      </details>
                    </div>
                    {thread.map((c) => (
                      <div key={c.id} className="ml-[180px] mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
                        <Avatar name={people.get(c.author_id)?.name ?? ""} size={24} /><div><p className="text-label-md">{people.get(c.author_id)?.name}</p><p className="text-body-md">{c.body}</p></div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </dl>
            {!g.horizon && <div className="mt-4 rounded-xl border border-line overflow-hidden">
              <div className="px-4 py-2 bg-canvas text-label-sm text-muted uppercase tracking-wide">Rubric</div>
              {[["Partially meets", rubric.partial], ["Meets", rubric.meets], ["Exceeds", rubric.exceeds]].map(([l, t]) => (
                <div key={l} className="px-4 py-3 border-t border-line grid grid-cols-[140px_1fr]"><span className="text-label-md">{l}</span><span className="text-body-md">{t || "—"}</span></div>
              ))}
            </div>}
            {inside.length > 0 && (
              <div className="mt-4">
                <p className="label">Goals inside it{inside.some((k) => k.status !== "approved") ? " · approving this approves the ones waiting too" : ""}</p>
                <ul className="divide-y divide-line">
                  {inside.map((k) => (
                    <li key={k.id} className="py-2 flex flex-wrap items-center gap-3">
                      <span className="text-body-sm text-muted w-44">{planLabel(k)}</span>
                      <span className="flex-1 text-body-md">{k.title}</span>
                      <Pill tone={k.status === "approved" ? "green" : "amber"}>{k.status === "approved" ? "Approved" : "Waiting"}</Pill>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {milestones.length > 0 && (
              <div className="mt-4"><p className="label">Milestones</p><ul className="space-y-1">{milestones.map((m) => <li key={m.id} className="text-body-md flex justify-between"><span>{m.title}</span><span className="text-muted">{fmtDate(m.due_date)}</span></li>)}</ul></div>
            )}
          </Card>
          <AiBox title="Goal check · Drafted by PMG" tone={quality.ok ? "teal" : "amber"}>
            <p className="text-body-md">{quality.ok ? "Measurable and time-bound." : `Measurable and time-bound. ${quality.issues.length === 1 ? "One issue" : "Issues"}: ${quality.issues.join(" ")}`}</p>
          </AiBox>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            {g.status === "pending" ? (
              <Card className="p-6">
                <h2 className="section-title mb-3">Your decision</h2>
                <form action={decideGoalAction} className="space-y-3">
                  <input type="hidden" name="goalId" value={g.id} />
                  {[["approve", "Approve"], ["approve_edits", "Approve with edits"], ["changes", "Request changes"]].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 text-body-md"><input type="radio" name="decision" value={v} defaultChecked={v === (quality.ok ? "approve" : "changes")} className="accent-teal" /> {l}</label>
                  ))}
                  <label className="block"><span className="label">Message to {owner.name.split(" ")[0]}</span>
                    <textarea name="message" className="textarea" defaultValue={quality.ok ? "" : "Let's make 10% Meets and 12% Exceeds. Can you update the rubric?"} /></label>
                  <button className="btn-primary w-full">Send</button>
                  <p className="text-body-sm text-muted">{owner.name.split(" ")[0]} gets this in chat. Every change is kept in the goal&apos;s change log.</p>
                </form>
              </Card>
            ) : <Card className="p-6 text-body-md">This goal has been {g.status === "approved" ? "approved" : "sent back for changes"}.</Card>}
            <Card className="p-6">
              <h2 className="section-title mb-3">{owner.name.split(" ")[0]}&apos;s other goals</h2>
              <ul className="space-y-2">{others.map((o) => <li key={o.id} className="flex items-center justify-between gap-2 text-body-md"><span className="truncate">{o.title}</span><HealthPill health={o.h.health} /></li>)}</ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
