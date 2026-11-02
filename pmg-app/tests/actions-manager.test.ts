import { describe, expect, it } from "vitest";
import { createGoal, decideGoal, editGoal, saveReview, submitReview } from "@/lib/services/mutations";
import { activeCycle, chatFor, getGoal, getReview, goalChanges, goalsFor, pendingApprovals } from "@/lib/repo";

describe("manager flow", () => {
  it("requesting changes and resubmitting keeps a change log, then approval clears the queue", () => {
    createGoal("utkarsh", {
      title: "Increase activation email click rate to 12%", parentId: null, measure: "Click-through rate", baseline: 7, target: 12, unit: "%",
      dueDate: "2026-12-31", rubric: { partial: "8–9%", meets: "12%", exceeds: "12%" }, dependencies: null, milestones: [],
    }, true);
    const [goal] = pendingApprovals("muru");
    expect(goal.title).toMatch(/activation email/);
    expect(() => decideGoal(goal.id, "priyadarshini", "approve", "")).toThrow();

    decideGoal(goal.id, "muru", "changes", "Let's make 10% Meets and 12% Exceeds.");
    expect(getGoal(goal.id)?.status).toBe("changes_requested");
    expect(chatFor("utkarsh").some((m) => m.kind === "approval_result" && m.body.includes("asked for changes"))).toBe(true);

    editGoal(goal.id, "utkarsh", { rubric: { partial: "8–9%", meets: "10%", exceeds: "12%" } }, "Updated per Muru");
    expect(getGoal(goal.id)?.status).toBe("pending");
    decideGoal(goal.id, "muru", "approve", "");
    expect(getGoal(goal.id)?.status).toBe("approved");
    expect(pendingApprovals("muru")).toHaveLength(0);
    expect(goalChanges(goal.id).map((c) => c.summary)).toEqual(expect.arrayContaining(["Changes requested", "Rubric updated", "Goal approved"]));
  });

  it("manager review saves ratings and submits", () => {
    const cycle = activeCycle()!;
    const goal = String(goalsFor("anshika")[0].id);
    saveReview("anshika", "muru", "manager", { goals: { [goal]: { rating: 3, comment: "23 of 26 Phase 3 issues released" } } });
    expect(JSON.parse(getReview(cycle.id, "anshika", "manager")!.payload).goals[goal].rating).toBe(3);
    submitReview("anshika", "muru", "manager");
    expect(getReview(cycle.id, "anshika", "manager")?.status).toBe("submitted");
    expect(chatFor("anshika").some((m) => m.body.includes("submitted your manager review"))).toBe(true);
  });
});
