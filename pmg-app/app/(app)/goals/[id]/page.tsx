import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { AiBox, Avatar, BlockerPill, Card, EvidenceChip, HealthPill, Icon, Pill, ProgressBar, cx, fmtDate, healthTone } from "@/components/ui";
import { commentsFor, goalsInside, milestonesFor, getGoal, getPerson, getWorkItem, isInLine, goalChanges, parseEvidence, parseRubric, peopleById, winsForGoal, activeCycle, ratingLevels } from "@/lib/repo";
import { fmtDay, planLabel } from "@/lib/planner";
import { goalView } from "@/lib/services/views";
import { blockerDays, displayStatus } from "@/lib/logic/blocked";
import { canSeeWin } from "@/lib/logic/permissions";
import { today } from "@/lib/time";
import { capitalize, overlap } from "@/lib/logic/text";
import { addAiActionAction, goalProgressAction, toggleMilestoneAction } from "@/app/actions/app";
import { requestApprovalAction } from "@/app/actions/work";
import { editOwnGoalAction } from "@/app/actions/goals";
import { goalProgress } from "@/lib/logic/health";
import { TaskBox } from "@/components/plan/PlanBoard";
import { CommentBox } from "@/components/plan/CommentBox";
import { addCommentAction, deleteCommentAction } from "@/app/actions/comments";
import { MAX_FILES, MAX_FILE_BYTES, canSeeGoal } from "@/lib/services/comments";

export default async function GoalDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const me = await requirePerson();
  const { id } = await params;
  const { created } = await searchParams;
  const raw = getGoal(Number(id));
  if (!raw) notFound();
  const owner = getPerson(raw.owner_id)!;
  if (!canSeeGoal(me, raw)) notFound();
  const g = goalView(raw);
  const people = peopleById();
  const team = g.parent_id ? getGoal(g.parent_id) : undefined;
  const company = team?.parent_id ? getGoal(team.parent_id) : undefined;
  const rubric = parseRubric(g);
  const wins = winsForGoal(g.id).filter((w) => canSeeWin(me, owner, w));
  const changes = goalChanges(g.id);
  const isOwner = me.id === g.owner_id;
  const open = g.blockers.filter((b) => b.status !== "resolved");
  const cycle = activeCycle();
  const levels = cycle ? ratingLevels(cycle.id) : [];
  const suggestions = g.h.health !== "On track" ? nextSteps(g, open.map((b) => people.get(b.owner_id)?.name.split(" ")[0] ?? ""), people.get(owner.manager_id ?? "")?.name.split(" ")[0]) : [];

  const comments = commentsFor(g.id);
  const own = g.source === "manual" && (g.horizon === "week" || g.horizon === "month" || g.horizon === "quarter");
  const inside = own ? goalsInside(g.id) : [];
  const holder = own && team?.source === "manual" && team.horizon ? team : undefined; // the goal this one sits in
  const below = g.horizon === "quarter" ? { h: "month", label: "monthly" } : g.horizon === "month" ? { h: "week", label: "weekly" } : null;
  const managerFirst = people.get(owner.manager_id ?? "")?.name.split(" ")[0] ?? "your manager";
  const sendable = isOwner && g.kind === "work" && g.source !== "manager" && (g.status === "draft" || g.status === "changes_requested") && g.due_date >= today()
    && (g.source === "ai" ? g.horizon === "week" : !(holder && holder.status !== "approved"));
  // Changes people made; PMG's own bookkeeping ("Rebuilt by PMG from Jira history") stays out of the way.
  const changeLog = changes.filter((c) => c.by_id && !c.summary.startsWith("Check-in") && !c.summary.startsWith("Progress"));
  const otherFirst = (isOwner ? people.get(owner.manager_id ?? "") : owner)?.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <nav className="text-body-sm text-muted"><Link href="/goals" className="hover:text-teal">Goals</Link> / {g.title}</nav>
      {created && <div className="rounded-xl border border-teal/30 bg-teal-tint/40 p-4 text-body-md text-teal">{
        g.kind === "personal" ? "Created. It's a personal goal, so only you can see it and it needs no approval."
        : g.status === "pending" ? (holder && holder.status === "pending" ? `Created. It waits for ${managerFirst} with the goal for ${planLabel(holder)}.` : `Sent to ${people.get(owner.manager_id ?? "")?.name} for approval. They'll get it in chat.`)
        : g.status === "approved" ? `Created. It's part of your approved goal for ${holder ? planLabel(holder) : "this period"}, so it needs no separate approval.`
        : `Saved as a draft. Send it to ${managerFirst} when it's ready.`}</div>}

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-headline-md">{g.title}</h1>
              {g.kind === "personal" && <Pill tone="violet" icon="lock">Personal · only you</Pill>}
              {own && g.kind === "work" && <Pill tone="slate" icon="edit_note">Set by {isOwner ? "you" : owner.name.split(" ")[0]}</Pill>}
              {g.status === "approved" ? <HealthPill health={g.h.health} /> : <Pill tone="amber">{g.status === "pending" ? `Waiting for ${people.get(owner.manager_id ?? "")?.name.split(" ")[0] ?? "approval"}` : g.status === "draft" ? "Draft" : "Changes requested"}</Pill>}
              {g.source === "ai" && <Pill tone="violet" icon="auto_awesome">Planned by PMG</Pill>}
              {g.source === "manager" && <Pill tone="violet" icon="person">Set by {people.get(g.approved_by ?? "")?.name.split(" ")[0]}</Pill>}
              {g.horizon === "feature" && (g.expected_date ?? g.due_date) > g.due_date && g.milestones.some((m) => !m.done_at) && <Pill tone="amber" icon="schedule">Now expected {fmtDay(g.expected_date!)}</Pill>}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-body-md text-muted">
              <span className="inline-flex items-center gap-1.5"><Avatar name={owner.name} size={22} /> {owner.name}</span>
              {g.approved_by && <span className="inline-flex items-center gap-1"><Icon name="verified" className="text-[16px] text-teal" /> Approved by {people.get(g.approved_by)?.name} on {fmtDate(g.approved_at)}</span>}
              <span className="inline-flex items-center gap-1"><Icon name="event" className="text-[16px]" /> Due {fmtDate(g.due_date, { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            {g.horizon ? (
              <div className="flex flex-wrap items-center gap-2 mt-4 text-label-sm">
                {[company, team].filter((x) => x?.horizon).map((x) => (
                  <span key={x!.id} className="inline-flex items-center gap-2">
                    <Link href={`/goals/${x!.id}`} className="px-2.5 py-1 rounded-full bg-teal-tint text-teal hover:underline">{planLabel(x!)}: {x!.title}</Link>
                    <Icon name="arrow_forward" className="text-[16px] text-muted" />
                  </span>
                ))}
                <span className="px-2.5 py-1 rounded-full border border-line">{planLabel(g)}</span>
              </div>
            ) : (
            <div className="flex flex-wrap items-center gap-2 mt-4 text-label-sm">
              {company && <span className="px-2.5 py-1 rounded-full bg-teal text-white">Company: {company.title}</span>}
              {company && <Icon name="arrow_forward" className="text-[16px] text-muted" />}
              {team && <span className="px-2.5 py-1 rounded-full bg-teal-tint text-teal">Team: {team.title}</span>}
              {team && <Icon name="arrow_forward" className="text-[16px] text-muted" />}
              <span className="px-2.5 py-1 rounded-full border border-line">This goal</span>
            </div>
            )}
          </div>
          {sendable && (
            <form action={requestApprovalAction}><input type="hidden" name="goalId" value={g.id} /><input type="hidden" name="back" value={`/goals/${g.id}`} />
              <button className="btn-primary"><Icon name="send" className="text-[18px]" /> Ask {managerFirst} to approve{inside.some((k) => k.status !== "approved") ? ", with what's inside" : ""}</button></form>
          )}
          {isOwner && own && holder && holder.status !== "approved" && g.status !== "approved" && (
            <span className="text-body-sm text-muted max-w-56">Goes to {managerFirst} with the goal for {planLabel(holder)}.</span>
          )}
          {!isOwner && owner.manager_id === me.id && g.horizon === "week" && (
            <Link href={`/team/${owner.id}?week=${g.start_date}#week`} className="btn-secondary"><Icon name="edit" className="text-[18px]" /> Edit or approve on {owner.name.split(" ")[0]}&apos;s plan</Link>
          )}
          {isOwner && g.status === "approved" && (
            <div className="flex items-center gap-2">
              {g.source === "ai" ? <Link href="/work" className="btn-ghost"><Icon name="sync" className="text-[18px]" /> Progress comes from your tickets</Link>
                : inside.length ? <span className="btn-ghost pointer-events-none"><Icon name="account_tree" className="text-[18px]" /> Progress follows its {below?.label} goals</span> : (
              <details className="relative">
                <summary className="btn-primary list-none cursor-pointer">Update progress</summary>
                <form action={goalProgressAction} className="absolute right-0 mt-2 w-72 card shadow-pop p-4 z-20 space-y-2">
                  <input type="hidden" name="goalId" value={g.id} />
                  <label className="label">{g.progress_mode === "metric" ? `Current value (${g.unit ?? ""})` : g.progress_mode === "count" ? `Done (of ${g.count_total})` : g.progress_mode === "milestones" ? "Tick milestones below" : "Progress %"}</label>
                  {g.progress_mode !== "milestones" && <><input name="value" type="number" step="0.1" defaultValue={g.progress_mode === "metric" ? g.current ?? "" : g.progress_mode === "count" ? g.count_done ?? "" : g.manual_progress ?? ""} className="input" /><button className="btn-primary btn-sm w-full">Save</button></>}
                </form>
              </details>
              )}
              {g.kind === "work" && <Link href={`/blockers?drawer=1&goalId=${g.id}&origin=goal`} className="btn-secondary"><Icon name="report" className="text-[18px]" /> Raise blocker</Link>}
            </div>
          )}
        </div>
      </Card>

      {g.status === "approved" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className={cx("rounded-xl border p-5 flex gap-3", g.h.health === "On track" ? "bg-green-50 border-green-200 text-green-900" : g.h.health === "At risk" ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-red-50 border-red-200 text-red-900")}>
            <Icon name={g.h.health === "On track" ? "check_circle" : "warning"} className="text-[22px]" />
            <div><p className="text-title-md">{g.h.health}</p><p className="text-body-md">{capitalize(g.h.reason.replace(/^[^:]+: /, ""))}</p></div>
          </div>
          {suggestions.length > 0 ? (
            <AiBox title="Suggested next steps · Drafted by PMG">
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={s} className="flex items-center justify-between gap-2 text-body-md">
                    <span>{s}</span>
                    {isOwner && <form action={addAiActionAction}><input type="hidden" name="text" value={s} /><input type="hidden" name="goalId" value={g.id} /><button className="btn-ghost btn-sm text-teal">Add as action</button></form>}
                  </li>
                ))}
              </ul>
            </AiBox>
          ) : (
            <div className="rounded-xl border border-line bg-white p-5 text-body-md text-muted flex items-center gap-2"><Icon name="thumb_up" className="text-teal" /> Keeping pace. Keep logging wins as you hit milestones.</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Card className="p-6">
            <h2 className="section-title mb-4">Goal card</h2>
            <dl className="grid sm:grid-cols-2 gap-4">
              {[["Outcome", g.title], !own && [g.horizon ? "Done when" : "Measure", g.measure], g.baseline != null && ["Baseline", `${g.baseline}${g.unit ?? ""}`], g.target != null && ["Target", `${g.target}${g.unit ?? ""}`],
                own && ["For", planLabel(g)], ["Deadline", fmtDate(g.due_date, { day: "numeric", month: "short", year: "numeric" }) + (g.horizon === "feature" && g.expected_date && g.expected_date > g.due_date && g.milestones.some((m) => !m.done_at) ? ` · now expected ${fmtDay(g.expected_date)}` : "")], !own && ["Dependencies", g.dependencies]]
                .filter(Boolean).map((row) => { const [k, v] = row as [string, string]; return (
                  <div key={k}><dt className="label">{k}</dt><dd className="text-body-md">{v || "—"}</dd></div>
                ); })}
            </dl>
            {!g.horizon && <div className="mt-5 rounded-xl border border-line overflow-hidden">
              <div className="px-4 py-2 bg-canvas text-label-sm text-muted uppercase tracking-wide">What good looks like · company rubric</div>
              {[["Partially meets", rubric.partial, levels[1]], ["Meets", rubric.meets, levels[2]], ["Exceeds", rubric.exceeds, levels[3]]].map(([label, text, lvl]) => (
                <div key={label as string} className="px-4 py-3 border-t border-line grid grid-cols-[140px_1fr] gap-3">
                  <span className="text-label-md">{label as string}</span>
                  <span className="text-body-md">{(text as string) || <span className="text-muted">{(lvl as { description: string } | undefined)?.description}</span>}</span>
                </div>
              ))}
            </div>}
            {isOwner && own && (
              <details className="mt-4">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-label-md text-teal"><Icon name="edit" className="text-[16px]" /> Reword it</summary>
                <form action={editOwnGoalAction} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="goalId" value={g.id} />
                  <input name="title" defaultValue={g.title} required minLength={3} maxLength={200} className="input flex-1 min-w-64" />
                  <button className="btn-primary btn-sm">Save</button>
                  {g.kind === "work" && g.status === "approved" && g.approved_by && <p className="text-body-sm text-muted w-full">It goes back to {managerFirst} for approval.</p>}
                </form>
              </details>
            )}
          </Card>

          {own && below && (
            <Card className="p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="section-title">{below.label === "monthly" ? "Months" : "Weeks"} in this goal</h2>
                {isOwner && <Link href={`/goals/new?kind=${g.kind}&horizon=${below.h}&parent=${g.id}`} className="btn-secondary btn-sm"><Icon name="add" className="text-[16px]" /> Add a {below.label} goal</Link>}
              </div>
              {inside.length === 0 ? <p className="text-body-md text-muted">Nothing inside yet. Break it into {below.label} goals and this goal&apos;s progress follows them.</p> : (
                <ul className="divide-y divide-line">
                  {inside.map((k) => {
                    const p = goalProgress(k, milestonesFor(k.id));
                    return (
                      <li key={k.id} className="py-3 flex flex-wrap items-center gap-3">
                        <span className="text-body-sm text-muted w-44">{planLabel(k)}</span>
                        <Link href={`/goals/${k.id}`} className="flex-1 min-w-48 text-body-md hover:text-teal">{k.title}</Link>
                        {k.kind === "work" && k.status !== "approved" && <Pill tone="amber">{k.status === "pending" ? "Waiting" : k.status === "draft" ? "Draft" : "Changes asked"}</Pill>}
                        <ProgressBar value={p * 100} tone={k.kind === "personal" ? "violet" : "teal"} className="w-24" />
                        <span className="text-body-sm text-muted w-10 text-right">{Math.round(p * 100)}%</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {g.milestones.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">Milestones</h2>
                <span className="text-body-sm text-muted">{g.milestones.filter((m) => m.done_at).length} of {g.milestones.length} milestones</span>
              </div>
              <ProgressBar value={(g.milestones.filter((m) => m.done_at).length / g.milestones.length) * 100} tone={healthTone(g.h.health)} className="mb-4" />
              <ul className="divide-y divide-line">
                {g.milestones.map((m) => {
                  const blocked = !m.done_at && open.find((b) => overlap(m.title, b.title) >= 2);
                  const item = m.work_item_id ? getWorkItem(m.work_item_id) : undefined;
                  const box = cx("w-6 h-6 rounded-md border flex items-center justify-center shrink-0", m.done_at ? "bg-teal border-teal text-white" : "border-slate-300 hover:border-teal");
                  return (
                    <li key={m.id} className="py-3 flex items-center gap-3">
                      {item ? <TaskBox milestone={m} item={item} canTick={isOwner} back={`/goals/${g.id}`} size="md" /> : (
                      <form action={toggleMilestoneAction}><input type="hidden" name="milestoneId" value={m.id} />
                        <button disabled={!isOwner} className={box} aria-label={m.done_at ? "Mark not done" : "Mark done"}>
                          {m.done_at && <Icon name="check" className="text-[16px]" />}
                        </button></form>
                      )}
                      <span className={cx("flex-1 text-body-md", m.done_at && "text-muted")}>
                        {m.title}
                        {item?.external_key && item.source !== "manual" && (
                          <a href={item.url ?? undefined} target="_blank" rel="noreferrer" title={`Jira: ${item.title}`} className="ml-2 text-body-sm text-teal hover:underline">{item.external_key}</a>
                        )}
                        {m.note && <span className="block text-body-sm text-amber-700">{m.note}</span>}
                        {m.pending_since && <span className="block text-body-sm text-violet">Joined after approval; waiting for {people.get(owner.manager_id ?? "")?.name.split(" ")[0]} to approve adding it</span>}
                      </span>
                      {blocked && <Pill tone="rose" icon="block">Blocked {days(blockerDays(blocked, today()))}</Pill>}
                      {!blocked && isOwner && !m.done_at && g.kind === "work" && (
                        <Link href={`/blockers?drawer=1&goalId=${g.id}&milestoneId=${m.id}&origin=milestone`} className="text-body-sm text-muted hover:text-rose-700 inline-flex items-center gap-0.5"><Icon name="report" className="text-[16px]" />Blocked?</Link>
                      )}
                      <span className="text-body-sm text-muted w-28 text-right">{m.done_at ? `Done ${fmtDate(m.done_at)}` : `Due ${fmtDate(m.due_date)}`}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card className="p-6">
            <div id="comments" className="scroll-mt-24" />
            <div className="flex items-center gap-2 mb-4">
              <Icon name="forum" className="text-teal" /><h2 className="section-title">Comments</h2>
              {comments.length > 0 && <span className="text-body-sm text-muted">{comments.length}</span>}
            </div>
            {comments.length > 0 && (
              <ul className="space-y-5 mb-5">
                {comments.map((c) => {
                  const author = people.get(c.author_id);
                  return (
                    <li key={c.id} className="flex gap-3">
                      <Avatar name={author?.name ?? ""} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-label-md">{author?.name}</span>
                          <span className="text-body-sm text-muted">{fmtDate(c.at, { day: "numeric", month: "short" })}, {c.at.slice(11, 16)}</span>
                          {c.author_id === me.id && (
                            <form action={deleteCommentAction} className="ml-auto">
                              <input type="hidden" name="commentId" value={c.id} /><input type="hidden" name="goalId" value={g.id} />
                              <button className="text-body-sm text-muted hover:text-rose-700">Delete</button>
                            </form>
                          )}
                        </div>
                        {c.body && <p className="text-body-md whitespace-pre-wrap break-words mt-0.5">{c.field && <span className="text-label-sm text-muted mr-1.5">On {c.field}:</span>}{c.body}</p>}
                        {c.attachments.length > 0 && (
                          <div className="flex flex-wrap items-start gap-2 mt-2">
                            {c.attachments.map((a) => {
                              const href = `/goals/${g.id}/files/${a.id}`;
                              return /^image\/(png|jpeg|gif|webp)$/.test(a.mime) ? (
                                <a key={a.id} href={href} target="_blank" rel="noreferrer" title={a.name} className="block rounded-lg overflow-hidden border border-line hover:border-teal">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={href} alt={a.name} className="h-24 w-auto max-w-[220px] object-cover" />
                                </a>
                              ) : (
                                <a key={a.id} href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-body-sm hover:border-teal">
                                  <Icon name={a.mime === "application/pdf" ? "picture_as_pdf" : "description"} className="text-[16px] text-teal" />
                                  <span className="max-w-[220px] truncate">{a.name}</span>
                                  <span className="text-muted">{a.size < 1024 * 1024 ? `${Math.max(1, Math.round(a.size / 1024))} KB` : `${(a.size / 1024 / 1024).toFixed(1)} MB`}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <CommentBox goalId={g.id} action={addCommentAction} maxFiles={MAX_FILES} maxBytes={MAX_FILE_BYTES}
              placeholder={g.kind === "personal" ? "A note for yourself: progress, a link, a file…" : otherFirst ? `Add a comment for ${otherFirst}: an update, a question, a link…` : "Add a comment…"} />
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card className="p-6">
            <h2 className="section-title mb-3">Blockers on this goal</h2>
            {g.blockers.length === 0 && <p className="text-body-md text-muted">None. Nice.</p>}
            <ul className="space-y-3">
              {g.blockers.map((b) => (
                <li key={b.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-2"><span className="text-label-md">{b.title}</span><BlockerPill status={displayStatus(b, today())} /></div>
                  <p className="text-body-sm text-muted mt-1">{b.status === "resolved" ? `Resolved by ${people.get(b.owner_id)?.name} in ${days(blockerDays(b, today()))}` : `Waiting on ${people.get(b.owner_id)?.name} · ${days(blockerDays(b, today()))}`}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-headline-md">{days(g.daysBlocked)}</p>
              <p className="text-body-sm text-muted">blocked this quarter · shown to the manager at review time</p>
            </div>
          </Card>
          <Card accent="violet" className="p-6">
            <h2 className="section-title mb-3">Linked wins</h2>
            {wins.length === 0 && <p className="text-body-md text-muted">No wins linked yet.</p>}
            <ul className="space-y-3">
              {wins.map((w) => (
                <li key={w.id}><p className="text-label-md">{w.title}</p>
                  <div className="flex gap-1 mt-1">{parseEvidence(w).map((e) => <EvidenceChip key={e.label} kind={e.kind} label={e.label} href={e.url} />)}<span className="text-body-sm text-muted">{fmtDate(w.at)}</span></div></li>
              ))}
            </ul>
          </Card>
          {changeLog.length > 0 && <Card className="p-6">
            <h2 className="section-title mb-3">Change log</h2>
            <ul className="space-y-3">
              {changeLog.map((c) => (
                <li key={c.id} className="text-body-md"><p>{c.summary}</p><p className="text-body-sm text-muted">{c.reason ? `${c.reason} · ` : ""}{people.get(c.by_id ?? "")?.name} · {fmtDate(c.at)}</p></li>
              ))}
            </ul>
          </Card>}
        </div>
      </div>
    </div>
  );
}

function nextSteps(g: ReturnType<typeof goalView>, waitingOn: string[], manager?: string): string[] {
  const out: string[] = [];
  if (waitingOn.length && manager) out.push(`Ask ${manager} to escalate the request waiting on ${waitingOn[0]}`);
  const nextMilestone = g.milestones.find((m) => !m.done_at);
  if (nextMilestone) out.push(`Plan the next step for “${nextMilestone.title}” so it can start as soon as you're unblocked`);
  if (g.progress_mode === "metric") out.push("Run the analysis on last month's data export while you wait");
  return out.slice(0, 2);
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
