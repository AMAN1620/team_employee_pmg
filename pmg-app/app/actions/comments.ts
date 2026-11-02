"use server";

import { revalidatePath } from "next/cache";
import { requirePerson } from "@/lib/session";
import { addGoalComment, deleteGoalComment } from "@/lib/services/comments";

export type CommentState = { ok: boolean; error: string | null; at: number };

/** Posts a comment (and files) on a goal. Returns an error to show under the box instead of throwing. */
export async function addCommentAction(_prev: CommentState, f: FormData): Promise<CommentState> {
  const me = await requirePerson();
  const goalId = Number(f.get("goalId"));
  try {
    await addGoalComment(goalId, me.id, String(f.get("body") ?? ""), f.getAll("files").filter((x): x is File => typeof x === "object"));
  } catch (e) {
    return { ok: false, error: (e as Error).message, at: Date.now() };
  }
  revalidatePath(`/goals/${goalId}`);
  return { ok: true, error: null, at: Date.now() };
}

export async function deleteCommentAction(f: FormData) {
  const me = await requirePerson();
  deleteGoalComment(Number(f.get("commentId")), me.id);
  revalidatePath(`/goals/${Number(f.get("goalId"))}`);
}
