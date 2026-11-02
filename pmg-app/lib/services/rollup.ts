import { run } from "@/lib/db";
import { getGoal, goalsInside, milestonesFor } from "@/lib/repo";
import { goalProgress } from "@/lib/logic/health";

/**
 * A goal someone set with goals inside it (a month's weeks, a quarter's months) takes their average progress, and
 * the change carries up to the goal it sits in. Goals PMG planned roll up through their tickets instead.
 */
export function rollUpProgress(goalId: number | null) {
  for (let id = goalId, hops = 0; id && hops < 3; hops++) {
    const g = getGoal(id);
    if (!g || g.source !== "manual" || !g.horizon || g.progress_mode !== "manual") return;
    const inside = goalsInside(id);
    if (!inside.length) return;
    const avg = inside.reduce((sum, k) => sum + goalProgress(k, milestonesFor(k.id)), 0) / inside.length;
    run("UPDATE goals SET manual_progress = ? WHERE id = ?", Math.round(avg * 1000) / 10, id);
    id = g.parent_id;
  }
}
