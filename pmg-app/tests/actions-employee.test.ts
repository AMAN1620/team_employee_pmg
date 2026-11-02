import { describe, expect, it } from "vitest";
import {
  confirmCheckin, giveKudos, raiseBlocker, resolveBlocker, respondToBlocker, submitCheckin, updateCheckinItem, draftSelfReview,
  saveReview, submitReview, escalateBlocker,
} from "@/lib/services/mutations";
import { activeCycle, blockersOwnedBy, blockersRaisedBy, chatFor, checkinItems, getReview, pendingCheckin, winsFor } from "@/lib/repo";

const DEMO_REPLY = {
  moved: "The Dream Sports B2B instance is live with all 3 domains and CleverTap events now carry company_id, which improved B2B tracking. Also helped Venkatesh pull cohort data for user calling.",
  stuck: "Still waiting on Kanav for the B2B dashboard data pipeline. I also need the support-ticket export from Customer Success to plan the next Simkey release.",
  next: "Start the B2B pilot dashboard once the pipeline is ready.",
  mood: 4,
};

describe("employee demo flow", () => {
  it("check-in reply → AI-sorted items → confirmed into blockers and a win", async () => {
    const id = await submitCheckin("anshika", DEMO_REPLY, "chat");
    expect(pendingCheckin("anshika")?.id).toBe(id);
    const items = checkinItems(id);
    expect(items).toHaveLength(5);
    expect(chatFor("anshika").find((m) => m.kind === "checkin_prompt")?.handled).toBe("answered");

    // Remove the unplanned item to prove removed items are dropped.
    const unplanned = items.find((i) => i.kind === "unplanned")!;
    updateCheckinItem(unplanned.id, { state: "removed" });
    const winsBefore = winsFor("anshika").length;
    confirmCheckin(id);

    expect(blockersOwnedBy("poonam").some((b) => b.title.startsWith("Need the support-ticket export"))).toBe(true);
    expect(chatFor("poonam").some((m) => m.kind === "blocker_request")).toBe(true);
    expect(chatFor("kanav").some((m) => m.kind === "blocker_request" && m.body.includes("B2B dashboard data pipeline"))).toBe(true);
    const wins = winsFor("anshika");
    expect(wins.length).toBe(winsBefore + 1);
    expect(wins.some((w) => w.kind === "unplanned" && w.title.includes("cohort data"))).toBe(false);
  });

  it("resolving someone else's blocker credits the resolver and notifies the raiser", () => {
    const id = raiseBlocker("anshika", { title: "Need staging credentials", ownerId: "aman", goalId: null, needBy: "2026-11-21", details: null });
    respondToBlocker(id, "aman", "accept", "Sending today");
    expect(blockersRaisedBy("anshika").find((b) => b.id === id)?.status).toBe("accepted");
    resolveBlocker(id, "aman");
    expect(winsFor("aman").some((w) => w.kind === "helped" && w.title.includes("Anshika"))).toBe(true);
    expect(chatFor("anshika").some((m) => m.body.includes("resolved your blocker"))).toBe(true);
  });

  it("escalation goes to the raiser's manager", () => {
    const held = blockersRaisedBy("suchitra").find((b) => b.title === "Mobile Number Onboarding")!;
    escalateBlocker(held.id, "suchitra");
    expect(chatFor("muru").some((m) => m.kind === "escalation" && m.body.includes("Mobile Number Onboarding") && m.body.includes("Kumari Akriti"))).toBe(true);
  });

  it("kudos follow the recipient's recognition preference", () => {
    giveKudos("salman", "anshika", "Thanks for the crisp funnel walkthrough", "chat");
    const k = winsFor("anshika").find((w) => w.title === "Thanks for the crisp funnel walkthrough")!;
    expect(k.visibility).toBe("team");
    expect(() => giveKudos("anshika", "anshika", "me", "web")).toThrow();
  });

  it("self-appraisal: draft, save, submit, and the manager is told", async () => {
    const source = await draftSelfReview("anshika");
    expect(source).toBe("rules");
    const cycle = activeCycle()!;
    const draft = getReview(cycle.id, "anshika", "self")!;
    const payload = JSON.parse(draft.payload);
    expect(Object.values(payload.goals).every((g) => (g as { text: string }).text.includes("["))).toBe(true);
    saveReview("anshika", "anshika", "self", payload);
    submitReview("anshika", "anshika", "self");
    expect(getReview(cycle.id, "anshika", "self")?.status).toBe("submitted");
    expect(chatFor("muru").some((m) => m.body.includes("submitted their self-appraisal"))).toBe(true);
    expect(() => saveReview("anshika", "anshika", "self", payload)).toThrow();
  });
});
