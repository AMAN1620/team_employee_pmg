// Claude-backed versions of the AI features. Only used when ANTHROPIC_API_KEY is set; callers fall back to rules on any error.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropicKey } from "./key";
import { findOwner } from "./fallback";
import type { AppraisalDraft, AppraisalGoal, CheckinContext, CheckinInput, EvidenceItem, GoalText, MilestoneSpec, PlanGoalSpec, SortedItem } from "./types";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: anthropicKey() });
  return client;
}

const SortedSchema = z.object({
  items: z.array(z.object({
    kind: z.enum(["progress", "win", "blocker", "existing_blocker", "unplanned"]),
    text: z.string(),
    goal_id: z.number().nullable(),
    owner_id: z.string().nullable(),
    existing_blocker_id: z.number().nullable(),
    tag: z.string().nullable(),
  })),
});

export async function sortCheckinClaude(input: CheckinInput, ctx: CheckinContext): Promise<SortedItem[]> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(SortedSchema) },
    system:
      "You sort an employee's weekly check-in into items for a performance tool. Item kinds: progress (work moved on a goal), " +
      "win (a measurable result worth recording), blocker (something stuck on another person or team), existing_blocker " +
      "(the employee is still stuck on one of their open blockers), unplanned (work outside their goals such as support or firefighting). " +
      "Use only goal, person and blocker ids from the context; use null when nothing fits. Keep each text short and in the employee's words. " +
      "A blocker's owner is the person named, or else the most hands-on person in the team named: when a team lead and their own " +
      "manager both fit, pick the team lead, not the manager above them. " +
      "Don't invent items the employee didn't mention.",
    messages: [{
      role: "user",
      content: `Context:\n${JSON.stringify(ctx)}\n\nCheck-in:\nWhat moved? ${input.moved}\nWhat's stuck? ${input.stuck}\nWhat's next? ${input.next}`,
    }],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) throw new Error(`check-in sort stopped: ${response.stop_reason}`);

  const goalIds = new Set(ctx.goals.map((g) => g.id));
  const people = new Set(ctx.people.map((p) => p.id));
  const blockers = new Map(ctx.openBlockers.map((b) => [b.id, b]));
  const goal = (id: number | null) => (id != null && goalIds.has(id) ? id : null);

  return response.parsed_output.items.flatMap<SortedItem>((it) => {
    switch (it.kind) {
      case "progress": case "win":
        return [{ kind: it.kind, text: it.text, goalId: goal(it.goal_id) }];
      case "unplanned":
        return [{ kind: "unplanned", text: it.text, goalId: null, tag: it.tag ?? "Unplanned" }];
      case "existing_blocker": {
        const b = it.existing_blocker_id != null ? blockers.get(it.existing_blocker_id) : undefined;
        return b ? [{ kind: "existing_blocker", text: b.title, goalId: b.goalId, blockerId: b.id }] : [];
      }
      case "blocker": {
        const needBy = new Date(Date.parse(ctx.today + "T00:00:00Z") + 5 * 86_400_000).toISOString().slice(0, 10);
        return [{ kind: "blocker", text: it.text, goalId: goal(it.goal_id), ownerId: it.owner_id && people.has(it.owner_id) ? it.owner_id : findOwner(it.text, ctx), needBy }];
      }
    }
  });
}

const DraftSchema = z.object({
  goals: z.array(z.object({ goal_id: z.number(), text: z.string() })),
  beyond: z.string(),
});

export async function draftAppraisalClaude(goals: AppraisalGoal[], evidence: EvidenceItem[]): Promise<AppraisalDraft> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(DraftSchema) },
    system:
      "You draft an employee's self-appraisal in the first person from their own confirmed evidence. For each goal write 2-4 plain sentences. " +
      "End every sentence that states a fact with the bracketed number of the evidence it comes from, e.g. [3]. Use only the numbered evidence; " +
      "never add achievements, numbers or praise that aren't in it. Mention days blocked by others factually. 'beyond' covers unplanned work " +
      "and help given to others, with citations.",
    messages: [{ role: "user", content: `Goals:\n${JSON.stringify(goals)}\n\nEvidence:\n${JSON.stringify(evidence)}` }],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) throw new Error(`appraisal draft stopped: ${response.stop_reason}`);

  // Drop citations that don't point at real evidence.
  const valid = new Set(evidence.map((e) => e.n));
  const clean = (t: string) => t.replace(/\[(\d+)\]/g, (m, n) => (valid.has(Number(n)) ? m : ""));
  const out: Record<string, string> = {};
  for (const g of response.parsed_output.goals) if (goals.some((x) => x.id === g.goal_id)) out[String(g.goal_id)] = clean(g.text);
  return { goals: out, beyond: clean(response.parsed_output.beyond), source: "ai" };
}

const PlanSchema = z.object({ goals: z.array(z.object({ key: z.string(), title: z.string(), done_when: z.string() })) });

const MilestoneSchema = z.object({ milestones: z.array(z.object({ key: z.string(), text: z.string() })) });

export async function writeMilestonesClaude(tasks: MilestoneSpec[]): Promise<Map<string, string>> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(MilestoneSchema) },
    system:
      "You turn an engineer's Jira tasks into the milestones on their goal plan. For each task write one milestone: the result that is " +
      "true once the task is complete, as an achieved state a manager can check (for 'Backfill chat summaries for un-summarised chats': " +
      "'Every past chat has a summary memory can draw on'). Don't restate the task as an action or reuse its wording; say what it achieves " +
      "for its feature. Under 80 characters, plain words a manager outside the team understands, no ticket keys. Use only what the task, " +
      "feature and epic names say: no invented metrics, numbers or scope. Return one entry per input, with its key.",
    messages: [{ role: "user", content: JSON.stringify(tasks) }],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) throw new Error(`milestone writing stopped: ${response.stop_reason}`);
  const keys = new Set(tasks.map((t) => t.key));
  const out = new Map<string, string>();
  for (const m of response.parsed_output.milestones) {
    const text = m.text.trim().replace(/\.$/, "");
    if (keys.has(m.key) && text && text.length <= 120 && !/\b[A-Z][A-Z0-9]+-\d+\b/.test(text)) out.set(m.key, text);
  }
  return out;
}

export async function writePlanGoalsClaude(goals: PlanGoalSpec[]): Promise<Map<string, GoalText>> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(PlanSchema) },
    system:
      "You write the goals in an engineer's performance plan. PMG has already scheduled their Jira tasks (1 story point = 2 working days; " +
      "a feature is due on its Jira date or when its tasks add up to), so every date and task is given. Each input is one goal: a week, " +
      "a month, a quarter, or a feature, with the tasks planned to finish in it.\n" +
      "For each goal write:\n" +
      "- title: a goal the person can achieve in that period, written as the state reached once its tasks are done: what will " +
      "work or exist that doesn't now, in words a manager outside the team understands. Each task comes with its milestone (what is " +
      "true once it's done); build the goal from those. Don't restate a task or milestone in other words: with one task, say what it " +
      "makes possible for its feature. Under 90 characters. No ticket keys, task counts or 'Ship N tickets'.\n" +
      "- done_when: one sentence a manager can check at the end, naming the concrete results from the tasks that prove it.\n" +
      "Week: what that week's tasks achieve together. Feature: its result for users or the product. Month and quarter: the main outcomes " +
      "across their features, most important first. If tasks were carried over or the feature is past its deadline, the goal is to " +
      "finish them; don't hide it. Use only what the task and feature names say: no invented metrics, numbers, dates or scope. " +
      "Return one entry per input, with its key.",
    messages: [{ role: "user", content: JSON.stringify(goals.map(({ fallback: _, ...g }) => g)) }],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) throw new Error(`goal writing stopped: ${response.stop_reason}`);
  const keys = new Set(goals.map((g) => g.key));
  const out = new Map<string, GoalText>();
  for (const g of response.parsed_output.goals) {
    const title = g.title.trim().replace(/\.$/, "");
    if (keys.has(g.key) && title && title.length <= 120 && !/\b[A-Z][A-Z0-9]+-\d+\b/.test(title)) out.set(g.key, { title, doneWhen: g.done_when.trim() });
  }
  return out;
}
