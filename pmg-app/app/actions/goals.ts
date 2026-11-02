"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { createOwnGoal, editOwnGoal, type OwnHorizon } from "@/lib/services/goals";

export type CreateGoalState = { error: string | null };

/** Creates a week, month or quarter goal from the Create a goal form, then opens it. */
export async function createOwnGoalAction(_prev: CreateGoalState, f: FormData): Promise<CreateGoalState> {
  const me = await requirePerson();
  const num = (k: string) => (f.get(k) ? Number(f.get(k)) || null : null);
  let id: number;
  try {
    id = createOwnGoal(me.id, {
      kind: String(f.get("kind")) === "personal" ? "personal" : "work",
      horizon: String(f.get("horizon")) as OwnHorizon,
      start: String(f.get("start") ?? ""),
      title: String(f.get("title") ?? ""),
      steps: f.getAll("steps").map(String),
      parentId: num("parentId"),
      teamGoalId: num("teamGoalId"),
      childIds: f.getAll("childId").map(Number).filter(Boolean),
      send: String(f.get("send")) === "1",
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/", "layout");
  redirect(`/goals/${id}?created=1`);
}

export async function editOwnGoalAction(f: FormData) {
  const me = await requirePerson();
  const id = Number(f.get("goalId"));
  editOwnGoal(id, me.id, String(f.get("title") ?? ""));
  revalidatePath("/", "layout");
  redirect(`/goals/${id}`);
}
