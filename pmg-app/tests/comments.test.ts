import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { uploadsDir } from "@/lib/db";
import { chatFor, commentsFor, getPerson, plannedGoal } from "@/lib/repo";
import { addGoalComment, deleteGoalComment, readAttachment } from "@/lib/services/comments";

const file = (name: string, type: string, text = "hello") => new File([text], name, { type });

describe("comments and attachments on a goal", () => {
  it("Aman comments with a file, Venkatesh hears about it in chat and can open the file; others can't", async () => {
    const week = plannedGoal("aman", "week:2026-10-26")!;
    const id = await addGoalComment(week.id, "aman", "  Backfill job is running on staging  ", [file("../../evil name.txt", "text/plain")]);
    const [c] = commentsFor(week.id);
    expect(c).toMatchObject({ id, author_id: "aman", body: "Backfill job is running on staging" });
    expect(c.attachments).toHaveLength(1);
    expect(c.attachments[0]).toMatchObject({ name: "evil name.txt", mime: "text/plain", size: 5 });
    expect(c.attachments[0].stored).not.toContain("evil");
    expect(chatFor("venkatesh").at(-1)?.body).toBe("Aman commented on the goal for Oct Week 5 · 26 Oct – 1 Nov: “Backfill job is running on staging” (1 file attached)");

    expect(readAttachment(c.attachments[0].id, week.id, getPerson("venkatesh")!)?.bytes.toString()).toBe("hello");
    expect(readAttachment(c.attachments[0].id, week.id, getPerson("tharun")!)).toBeUndefined(); // not in Aman's line
    expect(readAttachment(c.attachments[0].id, week.id + 1, getPerson("aman")!)).toBeUndefined(); // wrong goal in the link

    await expect(addGoalComment(week.id, "tharun", "hi", [])).rejects.toThrow("Goal not found");
    await expect(addGoalComment(week.id, "aman", "   ", [])).rejects.toThrow("Write a comment");
    await expect(addGoalComment(week.id, "aman", "", Array.from({ length: 6 }, (_, i) => file(`f${i}.txt`, "text/plain")))).rejects.toThrow("up to 5");

    await addGoalComment(week.id, "venkatesh", "Share the row counts when it's done", []);
    const onlyFile = await addGoalComment(week.id, "aman", "", [file("counts.csv", "text/csv", "a,b")]);
    expect(commentsFor(week.id).find((x) => x.id === onlyFile)).toMatchObject({ body: "", attachments: [{ name: "counts.csv" }] });
    deleteGoalComment(onlyFile, "aman");
    expect(chatFor("aman").at(-1)?.body).toMatch(/^Venkatesh commented on the goal for Oct Week 5/);

    expect(() => deleteGoalComment(id, "venkatesh")).toThrow();
    const stored = path.join(uploadsDir(), c.attachments[0].stored);
    expect(fs.existsSync(stored)).toBe(true);
    deleteGoalComment(id, "aman");
    expect(fs.existsSync(stored)).toBe(false);
    expect(commentsFor(week.id).map((x) => x.author_id)).toEqual(["venkatesh"]);
  });
});
