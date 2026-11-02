import { describe, expect, it } from "vitest";
import { blocksFor } from "@/lib/chat/slack";
import { chatFor } from "@/lib/repo";

describe("Slack Block Kit (6)", () => {
  it("blocker requests get Accept / Need info / Not me buttons carrying the message id", () => {
    const m = chatFor("anshika").find((x) => x.kind === "blocker_request")!;
    const actions = blocksFor(m).find((b) => b.type === "actions") as { elements: { action_id: string; value: string }[] };
    expect(actions.elements.map((e) => e.action_id)).toEqual(["pmg_accept", "pmg_needs_info", "pmg_not_me"]);
    expect(actions.elements.every((e) => e.value === String(m.id))).toBe(true);
  });
  it("check-in prompts open the check-in modal", () => {
    const m = chatFor("anshika").find((x) => x.kind === "checkin_prompt")!;
    expect(JSON.stringify(blocksFor(m))).toContain("pmg_checkin_open");
  });
});
