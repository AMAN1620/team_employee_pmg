import { describe, expect, it } from "vitest";
import { createCompanyGoal, createTeamGoal, sendReviewReminders, setCycleFlags, setSetting, updateRatingLevel } from "@/lib/services/mutations";
import { activeCycle, chatFor, childGoals, companyGoals, ratingLevels, setting, teamGoals } from "@/lib/repo";

describe("HR flow", () => {
  it("company goal and a team goal under it show up for the team", () => {
    const id = createCompanyGoal("neha", "Expand to two new cities", "2027-03-31");
    expect(companyGoals().map((g) => g.id)).toContain(id);
    const team = createTeamGoal("muru", id, "Launch city-specific onboarding", "2026-12-31");
    expect(childGoals(id).map((g) => g.id)).toEqual([team]);
    expect(teamGoals().filter((g) => g.team_id === "product").map((g) => g.title)).toContain("Launch city-specific onboarding");
  });

  it("rubric edits and cycle flags persist", () => {
    const cycle = activeCycle()!;
    updateRatingLevel(cycle.id, 3, "Meets", "Hit the agreed target.");
    expect(ratingLevels(cycle.id)[2].description).toBe("Hit the agreed target.");
    setCycleFlags(cycle.id, { peer_enabled: true, forced_distribution: undefined });
    expect(activeCycle()?.peer_enabled).toBe(1);
    expect(activeCycle()?.forced_distribution).toBe(0);
  });

  it("reminders go only to people who haven't submitted", () => {
    const sent = sendReviewReminders("product");
    expect(sent).toBe(3); // Muru, Anshika and Kumari; Salman and Utkarsh already submitted
    expect(chatFor("anshika").some((m) => m.body.startsWith("Reminder: your self-appraisal"))).toBe(true);
    expect(chatFor("salman").some((m) => m.body.startsWith("Reminder: your self-appraisal"))).toBe(false);
  });

  it("chat feature switches are stored", () => {
    setSetting("chat.feature.kudos", "0");
    expect(setting("chat.feature.kudos")).toBe("0");
  });
});
