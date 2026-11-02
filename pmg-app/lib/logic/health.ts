import type { Blocker, Goal, Milestone } from "@/lib/repo/types";
import { QUARTER_END, QUARTER_START, daysBetween, elapsedFraction } from "@/lib/time";

export type Health = "On track" | "At risk" | "Off track";

/** Progress toward target as 0..1, using whichever measure the goal tracks. */
export function goalProgress(goal: Goal, milestones: Milestone[] = []): number {
  switch (goal.progress_mode) {
    case "metric": {
      const { baseline, target, current } = goal;
      if (baseline == null || target == null || current == null || baseline === target) return 0;
      return clamp((current - baseline) / (target - baseline));
    }
    case "count":
      return goal.count_total ? clamp((goal.count_done ?? 0) / goal.count_total) : 0;
    case "milestones":
      return milestones.length ? milestones.filter((m) => m.done_at).length / milestones.length : 0;
    default:
      return clamp((goal.manual_progress ?? 0) / 100);
  }
}

export function progressLabel(goal: Goal, milestones: Milestone[] = []): string {
  if (goal.progress_mode === "count") return `${goal.count_done ?? 0} of ${goal.count_total ?? 0}`;
  if (goal.progress_mode === "milestones") return `${milestones.filter((m) => m.done_at).length} of ${milestones.length} milestones`;
  if (goal.progress_mode === "metric") return `${goal.current}${goal.unit ?? ""} now · target ${goal.target}${goal.unit ?? ""}`;
  return `${Math.round(goalProgress(goal))}%`;
}

export type HealthResult = { health: Health; progress: number; expected: number; reason: string; quarterGone: number };

/**
 * On track when progress keeps pace with time (within 15 points), At risk within 35 points,
 * Off track beyond that. An open blocker older than 5 days on a behind-pace goal makes it At risk at least.
 */
export function goalHealth(goal: Goal, milestones: Milestone[], blockers: Blocker[], today: string): HealthResult {
  const progress = goalProgress(goal, milestones);
  const expected = elapsedFraction(goal.start_date, goal.due_date, today);
  const quarterGone = elapsedFraction(QUARTER_START, QUARTER_END, today);
  const gap = expected - progress;
  let health: Health = gap <= 0.15 ? "On track" : gap <= 0.35 ? "At risk" : "Off track";

  const open = blockers.filter((b) => b.status !== "resolved");
  const oldest = open.reduce((max, b) => Math.max(max, daysBetween(b.opened_at, today)), 0);
  if (health === "On track" && gap > 0.1 && oldest > 5) health = "At risk";

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const done = goal.progress_mode === "metric"
    ? `now at ${goal.current}${goal.unit ?? ""}, ${pct(progress)} of the way to target`
    : `${pct(progress)} done`;
  let reason = `${health}: ${done}, with ${pct(quarterGone)} of the quarter gone.`;
  if (open.length) reason += ` ${open.length} blocker${open.length > 1 ? "s" : ""} open${oldest ? ` for ${oldest} day${oldest > 1 ? "s" : ""}` : ""}.`;
  return { health, progress, expected, reason, quarterGone };
}

function clamp(x: number) {
  return Math.max(0, Math.min(1, x));
}
