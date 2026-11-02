import { anthropicKey } from "./key";
import { checkGoalQualityRules, draftAppraisalRules, sortCheckinRules } from "./fallback";
import type { AppraisalDraft, AppraisalGoal, CheckinContext, CheckinInput, EvidenceItem, GoalQuality, GoalText, MilestoneSpec, PlanGoalSpec, SortedItem } from "./types";

export type * from "./types";

/** True when the Claude API can be used. Set PMG_AI=rules to force the rule-based fallback. */
export function aiEnabled(): boolean {
  return !!anthropicKey() && process.env.PMG_AI !== "rules";
}

export function aiLabel(): string {
  return aiEnabled() ? "Drafted by AI" : "Drafted by PMG (rules)";
}

export async function sortCheckin(input: CheckinInput, ctx: CheckinContext): Promise<SortedItem[]> {
  if (aiEnabled()) {
    try {
      const { sortCheckinClaude } = await import("./claude");
      return await sortCheckinClaude(input, ctx);
    } catch (e) {
      console.warn("[pmg] Claude check-in sort failed, using rules:", (e as Error).message);
    }
  }
  return sortCheckinRules(input, ctx);
}

export async function draftSelfAppraisal(goals: AppraisalGoal[], evidence: EvidenceItem[]): Promise<AppraisalDraft> {
  if (aiEnabled()) {
    try {
      const { draftAppraisalClaude } = await import("./claude");
      return await draftAppraisalClaude(goals, evidence);
    } catch (e) {
      console.warn("[pmg] Claude appraisal draft failed, using rules:", (e as Error).message);
    }
  }
  return draftAppraisalRules(goals, evidence);
}

export function checkGoalQuality(goal: Parameters<typeof checkGoalQualityRules>[0]): GoalQuality {
  return checkGoalQualityRules(goal);
}

/**
 * Turns tasks into milestones: what is achieved once each is done ("Every past chat has a summary memory can draw
 * on"), keyed like the input. Tasks Claude skips, or all of them when it's off or fails, are left out; callers fall
 * back to the ticket title and try again on the next sync.
 */
export async function writeMilestones(tasks: MilestoneSpec[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (tasks.length && aiEnabled()) {
    try {
      const { writeMilestonesClaude } = await import("./claude");
      for (let i = 0; i < tasks.length; i += 40) {
        for (const [key, text] of await writeMilestonesClaude(tasks.slice(i, i + 40))) out.set(key, text);
      }
    } catch (e) {
      console.warn("[pmg] Claude milestone writing failed, keeping ticket titles:", (e as Error).message);
    }
  }
  return out;
}

/**
 * Words PMG's planned goals as outcomes ("Cross-chat memory gate working on staging"), not ticket lists. Each goal
 * keeps its rule-written text (the fallback) when Claude is off, fails, or skips it.
 */
export async function writePlanGoals(goals: PlanGoalSpec[]): Promise<Map<string, GoalText>> {
  const out = new Map(goals.map((g) => [g.key, g.fallback]));
  if (goals.length && aiEnabled()) {
    try {
      const { writePlanGoalsClaude } = await import("./claude");
      for (let i = 0; i < goals.length; i += 25) {
        for (const [key, text] of await writePlanGoalsClaude(goals.slice(i, i + 25))) out.set(key, text);
      }
    } catch (e) {
      console.warn("[pmg] Claude goal writing failed, using rules:", (e as Error).message);
    }
  }
  return out;
}
