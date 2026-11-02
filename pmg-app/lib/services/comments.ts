// Comments and file attachments on a goal: the owner, their managers and HR talk about it in one place.
// Files are saved under the uploads folder with random names; the original name and type stay in the database.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { get, run, tx, uploadsDir } from "@/lib/db";
import { getAttachment, getGoal, getPerson, isInLine, type Goal, type Person } from "@/lib/repo";
import { planLabel } from "@/lib/planner";
import { sendChat } from "@/lib/chat";
import { now } from "@/lib/time";

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Who may read a goal, and so comment on it and open its files: the owner, anyone above them, and HR; a personal goal only its owner. */
export function canSeeGoal(viewer: Pick<Person, "id" | "role">, goal: Pick<Goal, "owner_id" | "kind">): boolean {
  if (viewer.id === goal.owner_id) return true;
  return goal.kind !== "personal" && (viewer.role === "hr" || isInLine(viewer.id, goal.owner_id));
}

const safeName = (n: string) => (path.basename(n).replace(/[\u0000-\u001f"\\/]/g, "_").trim() || "file").slice(0, 120);
const extOf = (n: string) => (path.extname(n).toLowerCase().match(/^\.[a-z0-9]{1,8}$/)?.[0] ?? "");

/** Adds a comment with up to five files. The owner's manager hears about the owner's comments, and the owner about everyone else's. */
export async function addGoalComment(goalId: number, byId: string, body: string, files: File[]): Promise<number> {
  const goal = getGoal(goalId);
  const me = getPerson(byId);
  if (!goal || !me || !canSeeGoal(me, goal)) throw new Error("Goal not found");
  const text = body.trim().slice(0, 4000);
  const real = files.filter((f) => f && typeof f === "object" && f.size > 0);
  if (!text && !real.length) throw new Error("Write a comment or attach a file");
  if (real.length > MAX_FILES) throw new Error(`Attach up to ${MAX_FILES} files at a time`);
  const big = real.find((f) => f.size > MAX_FILE_BYTES);
  if (big) throw new Error(`${safeName(big.name)} is over ${MAX_FILE_BYTES / 1024 / 1024} MB`);

  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  const saved = await Promise.all(real.map(async (f) => {
    const stored = `${randomUUID()}${extOf(f.name)}`;
    fs.writeFileSync(path.join(dir, stored), Buffer.from(await f.arrayBuffer()));
    return { name: safeName(f.name), mime: f.type || "application/octet-stream", size: f.size, stored };
  }));
  const id = tx(() => {
    const cid = run("INSERT INTO goal_comments (goal_id,author_id,body,at) VALUES (?,?,?,?)", goalId, byId, text, now());
    for (const a of saved) run("INSERT INTO goal_attachments (comment_id,name,mime,size,stored) VALUES (?,?,?,?,?)", cid, a.name, a.mime, a.size, a.stored);
    return cid;
  });

  const to = goal.kind === "personal" ? null : byId === goal.owner_id ? getPerson(goal.owner_id)?.manager_id : goal.owner_id;
  if (to && to !== byId) {
    const what = goal.horizon ? `the goal for ${planLabel(goal)}` : `“${goal.title}”`;
    const snippet = text.length > 140 ? `${text.slice(0, 140)}…` : text;
    const extra = saved.length ? `${snippet ? " " : ""}(${saved.length} file${saved.length === 1 ? "" : "s"} attached)` : "";
    sendChat(to, "text", `${me.name.split(" ")[0]} commented on ${what}${snippet || extra ? ": " : ""}${snippet ? `“${snippet}”` : ""}${extra}`, { goalId, href: `/goals/${goalId}#comments` });
  }
  return id;
}

/** The author removes their own comment and its files. */
export function deleteGoalComment(commentId: number, byId: string) {
  const c = get<{ author_id: string }>("SELECT author_id FROM goal_comments WHERE id = ?", commentId);
  if (!c) return;
  if (c.author_id !== byId) throw new Error("Only the author removes a comment");
  const files = tx(() => {
    const stored = (get<{ s: string | null }>("SELECT group_concat(stored, '|') AS s FROM goal_attachments WHERE comment_id = ?", commentId)?.s ?? "").split("|").filter(Boolean);
    run("DELETE FROM goal_attachments WHERE comment_id = ?", commentId);
    run("DELETE FROM goal_comments WHERE id = ?", commentId);
    return stored;
  });
  for (const f of files) fs.rmSync(path.join(uploadsDir(), f), { force: true });
}

/** An attachment the viewer may open, with its bytes; undefined when it's missing or not theirs to see. */
export function readAttachment(attachmentId: number, goalId: number, viewer: Person) {
  const a = getAttachment(attachmentId);
  const goal = a && a.goal_id === goalId ? getGoal(goalId) : undefined;
  if (!a || !goal || !canSeeGoal(viewer, goal)) return undefined;
  const file = path.join(uploadsDir(), path.basename(a.stored));
  return fs.existsSync(file) ? { ...a, bytes: fs.readFileSync(file) } : undefined;
}
