import { describe, expect, it } from "vitest";
import { handleButton, handleCheckinReply, handleTypedMessage, parseCommand, resolveMention } from "@/lib/chat/commands";
import { blockersOwnedBy, chatFor, getPerson, pendingCheckin, winsFor } from "@/lib/repo";
import { setSetting } from "@/lib/services/mutations";

describe("chat commands (6)", () => {
  it("parses /kudos and /blocker", () => {
    expect(parseCommand("/kudos @anshika for the crisp walkthrough")).toEqual({ type: "kudos", to: "anshika", message: "The crisp walkthrough" });
    expect(parseCommand("/blocker @poonam need the ticket export")).toEqual({ type: "blocker", owner: "poonam", title: "Need the ticket export" });
    expect(parseCommand("hello").type).toBe("text");
    expect(resolveMention("@Anshika")?.id).toBe("anshika");
    expect(resolveMention("nobody")).toBeUndefined();
  });

  it("/kudos from chat lands in the journal; /blocker sends a request with buttons", () => {
    const aman = getPerson("aman")!;
    handleTypedMessage(aman, "/kudos @anshika for the crisp walkthrough");
    expect(winsFor("anshika").some((w) => w.kind === "kudos" && w.from_id === "aman" && w.source === "chat")).toBe(true);
    handleTypedMessage(getPerson("anshika")!, "/blocker @aman need staging credentials");
    expect(blockersOwnedBy("aman").some((b) => b.title === "Need staging credentials")).toBe(true);
  });

  it("check-in reply in chat → sorted card → Looks right confirms it", async () => {
    const anshika = getPerson("anshika")!;
    await handleCheckinReply(anshika, { moved: "The Dream Sports B2B instance is live.", stuck: "Nothing.", next: "", mood: 4 });
    expect(pendingCheckin("anshika")).toBeDefined();
    const card = chatFor("anshika").find((m) => m.kind === "checkin_sorted")!;
    handleButton(anshika, card, "confirm");
    expect(pendingCheckin("anshika")).toBeUndefined();
    expect(() => handleButton(getPerson("muru")!, card, "confirm")).toThrow();
  });

  it("Accept on a blocker request updates the blocker and tells the raiser", () => {
    const kanav = getPerson("kanav")!;
    handleTypedMessage(getPerson("anshika")!, "/blocker @kanav need the events schema doc");
    const req = chatFor("kanav").filter((m) => m.kind === "blocker_request").pop()!;
    handleButton(kanav, req, "accept");
    expect(chatFor("anshika").some((m) => m.body.startsWith("Kanav Anand accepted your blocker"))).toBe(true);
  });

  it("respects HR's chat switches", () => {
    setSetting("chat.feature.kudos", "0");
    const before = chatFor("anshika").filter((m) => m.kind === "kudos_notice").length;
    handleTypedMessage(getPerson("salman")!, "/kudos @anshika for the review");
    expect(chatFor("anshika").filter((m) => m.kind === "kudos_notice").length).toBe(before);
    setSetting("chat.feature.kudos", "1");
  });
});
