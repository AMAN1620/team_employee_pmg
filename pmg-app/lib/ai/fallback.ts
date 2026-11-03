// Rule-based versions of the AI features, used when no ANTHROPIC_API_KEY is set or a model call fails.
import { addDays, daysBetween } from "@/lib/time";
import { capitalize, overlap, sentences, tokens } from "@/lib/logic/text";
import type {
  AppraisalDraft, AppraisalGoal, CheckinContext, CheckinInput, EvidenceItem, GoalQuality, MilestoneGoal, SortedItem, SuggestedMilestone,
} from "./types";

const UNPLANNED = /\b(covered|outage|escalation|firefight|on[- ]call|incident|helped|training|support rota|unplanned)\b/i;
const IMPROVEMENT = /\b(went up|increased|improved|grew|lifted|rose|up \d+(\.\d+)?%|down \d+(\.\d+)?%|reduced|cut|dropped|decreased|saved)\b/i;

function bestGoal(text: string, ctx: CheckinContext, prefer?: "metric"): number | null {
  let best: { id: number; score: number } | null = null;
  for (const g of ctx.goals) {
    const score = overlap(text, g.title) * 2 + overlap(text, g.measure ?? "") + overlap(text, g.milestones.join(" "));
    if (score > 0 && (!best || score > best.score)) best = { id: g.id, score };
  }
  if (best) return best.id;
  if (prefer === "metric") return ctx.goals.find((g) => /%/.test(g.title))?.id ?? null;
  return null;
}

/** Who a blocker is waiting on: a named person, else the person whose title or team is named most specifically. */
export function findOwner(text: string, ctx: CheckinContext): string | null {
  const lower = text.toLowerCase();
  const has = (phrase: string) => phrase.length > 3 && new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower);
  const byName = ctx.people.find((p) => lower.includes(p.name.toLowerCase()) || has(p.name.split(" ")[0].toLowerCase()));
  if (byName) return byName.id;
  // Title without seniority words: "AVP - Customer Success" → "customer success", "Lead Backend" → "backend".
  const core = (title: string) => title.toLowerCase().replace(/\b(sr|senior|associate|assistant|asst|avp|vp|head of|lead|manager|engineer|national|regional)\b\.?/g, "").replace(/[^a-z& ]+/g, " ").replace(/\s+/g, " ").trim();
  // A title match beats a team match, and a lead beats someone who isn't one.
  const candidates = ctx.people
    .map((p) => ({ p, score: (has(core(p.title)) ? 20 : 0) + (has(p.teamName.toLowerCase()) ? 10 : 0) + (p.isLead ? 5 : 0) }))
    .filter((c) => c.score >= 10)
    .sort((a, b) => b.score - a.score);
  // On a tie, pick the hands-on lead rather than their own manager (Poonam, AVP Customer Success, over the VP).
  const top = candidates.filter((c) => c.score === candidates[0]?.score);
  const nearest = top.find((c) => top.some((o) => o.p.id === c.p.managerId));
  if (nearest) return nearest.p.id;
  return candidates[0]?.p.id ?? null;
}

function blockerTitle(sentence: string): string {
  const m = sentence.match(/\bneed(?:s|ed)?\s+(.*)$/i);
  if (m) return capitalize(`need ${m[1]}`);
  const w = sentence.match(/\bwaiting (?:on|for)\s+(.*)$/i);
  if (w) return capitalize(`waiting on ${w[1]}`);
  return capitalize(sentence.replace(/^(still|also|i'm|i am|i)\s+/i, ""));
}

export function sortCheckinRules(input: CheckinInput, ctx: CheckinContext): SortedItem[] {
  const items: SortedItem[] = [];

  for (const s of sentences(input.moved)) {
    if (UNPLANNED.test(s)) {
      items.push({ kind: "unplanned", text: capitalize(s.replace(/^(also|and)\s+/i, "")), goalId: null, tag: /support|escalation|outage|incident/i.test(s) ? "Support" : "Unplanned" });
      continue;
    }
    // "X is live ... and Y went up 9%" → progress for X, win for Y.
    for (const clause of s.split(/\s+and\s+(?=[a-z0-9-]+\s)/i).map((c) => c.trim()).filter(Boolean)) {
      if (IMPROVEMENT.test(clause)) items.push({ kind: "win", text: capitalize(clause), goalId: bestGoal(clause, ctx, "metric") });
      else items.push({ kind: "progress", text: capitalize(clause), goalId: bestGoal(clause, ctx) });
    }
  }

  for (const s of sentences(input.stuck)) {
    if (/^(nothing|none|no blockers?)\b/i.test(s)) continue;
    const match = ctx.openBlockers
      .map((b) => ({ b, score: overlap(s, b.title) }))
      .sort((a, b) => b.score - a.score)[0];
    if (match && match.score >= 2) {
      items.push({ kind: "existing_blocker", text: match.b.title, goalId: match.b.goalId, blockerId: match.b.id });
      continue;
    }
    items.push({
      kind: "blocker", text: blockerTitle(s), goalId: bestGoal(s, ctx, "metric"),
      ownerId: findOwner(s, ctx), needBy: addDays(ctx.today, 5),
    });
  }
  return items;
}

/** Self-appraisal text per goal where each sentence cites the evidence it came from as [n]. */
export function draftAppraisalRules(goals: AppraisalGoal[], evidence: EvidenceItem[]): AppraisalDraft {
  const out: Record<string, string> = {};
  for (const g of goals) {
    const ev = evidence.filter((e) => e.goalId === g.id);
    const lines: string[] = [];
    for (const e of ev.filter((x) => x.kind === "win")) lines.push(`${firstPerson(e.label)} [${e.n}].`);
    for (const e of ev.filter((x) => x.kind === "checkin").slice(0, 1)) lines.push(`Weekly check-ins kept this on track: ${lowerFirst(e.label)} [${e.n}].`);
    for (const e of ev.filter((x) => x.kind === "blocker")) lines.push(`${e.detail} [${e.n}].`);
    for (const e of ev.filter((x) => x.kind === "feedback")) lines.push(`${e.detail} [${e.n}].`);
    for (const e of ev.filter((x) => x.kind === "kudos")) lines.push(`${e.detail} [${e.n}].`);
    lines.push(`Current status: ${g.progressText} (${g.health.toLowerCase()}).`);
    out[String(g.id)] = lines.join(" ");
  }
  const beyond = evidence
    .filter((e) => e.goalId == null && (e.kind === "unplanned" || e.kind === "helped" || e.kind === "kudos"))
    .map((e) => (e.kind === "kudos" ? `${e.detail} [${e.n}].` : `${firstPerson(e.label)} [${e.n}].`))
    .join(" ");
  return { goals: out, beyond: beyond || "No work outside my goals recorded this cycle.", source: "rules" };
}

function firstPerson(label: string): string {
  const t = label.replace(/^(shipped|published|found|ran|covered|unblocked|cleared|completed|launched|baseline)/i, (m) => m.toLowerCase());
  return /^[a-z]/.test(t) && !/^baseline/.test(t) ? `I ${t}` : capitalize(t);
}

function lowerFirst(s: string) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Flags goals that can't be measured: no number, no deadline, or identical rubric levels. */
export function checkGoalQualityRules(goal: { title: string; target?: string | null; dueDate?: string | null; meets?: string | null; exceeds?: string | null; measure?: string | null }): GoalQuality {
  const issues: string[] = [];
  const hasNumber = /\d/.test(goal.title) || !!goal.target;
  if (!hasNumber) issues.push("This goal is hard to measure. Add a number to hit.");
  if (!goal.dueDate && !/\b(by|before)\b/i.test(goal.title)) issues.push("Add a deadline.");
  if (goal.meets && goal.exceeds && goal.meets.trim().toLowerCase() === goal.exceeds.trim().toLowerCase())
    issues.push("'Exceeds' is the same as 'Meets'. Make Exceeds a stretch beyond the target.");
  if (tokens(goal.title).length < 3) issues.push("Say what will change, for whom.");

  let suggestion: string | null = null;
  if (!hasNumber) {
    const t = goal.title.toLowerCase();
    if (/onboarding/.test(t)) suggestion = "Reduce onboarding drop-off from 38% to 25% by 31 Dec";
    else if (/(customer|client) satisfaction|csat/.test(t)) suggestion = "Raise CSAT from 4.1 to 4.4 by 31 Mar";
    else if (/activation|email/.test(t)) suggestion = "Increase activation email click rate from 7% to 10% by 31 Dec";
    else suggestion = `${capitalize(goal.title.replace(/^improve\s+/i, "Improve "))} from <baseline> to <target> by <date>`;
  }
  return { ok: issues.length === 0, issues, suggestion };
}

/**
 * Three milestones that split the goal's dates into plan, build and roll-out, with starter tasks for each. Generic on
 * purpose: the person renames them. Milestones the goal already has are skipped by title.
 */
export function suggestMilestonesRules(goal: MilestoneGoal): SuggestedMilestone[] {
  const span = Math.max(3, daysBetween(goal.start, goal.end) + 1);
  const cut = (n: number) => addDays(goal.start, Math.round((span * n) / 3));
  const what = goal.title.replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase());
  const phases: SuggestedMilestone[] = [
    { title: "Scope and plan", start: goal.start, end: addDays(cut(1), -1),
      tasks: [`Agree what "done" means for ${what}`, "List the work and who's needed", "Share the plan with your manager"] },
    { title: "Build the main pieces", start: cut(1), end: addDays(cut(2), -1),
      tasks: ["Deliver the first working version", "Get review feedback and fix it", "Check progress against the plan"] },
    { title: "Roll out and measure", start: cut(2), end: goal.end,
      tasks: ["Release it to the people who use it", "Measure the result", "Write up what changed and what's next"] },
  ];
  const have = new Set(goal.existing.map((t) => t.toLowerCase()));
  return phases.filter((m) => !have.has(m.title.toLowerCase()));
}

/** What the goal agent says to a question it has no rule for, when Claude is off. */
export function agentReplyRules(): string {
  return "I can raise a blocker, set up a 1:1, draft your weekly update, plan milestones for a goal, mark a task done, or tell you what's due. Try one of the buttons below, or say it in your own words.";
}
