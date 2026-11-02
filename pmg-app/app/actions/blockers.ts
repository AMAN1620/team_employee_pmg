"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { dismissNudge, raiseBlockerFor } from "@/lib/services/blockers";

export type RaiseState = { error: string | null };

/** Raises a blocker from the form; errors come back to show under it. */
export async function raiseBlockerFormAction(_prev: RaiseState, f: FormData): Promise<RaiseState> {
  const me = await requirePerson();
  const str = (k: string) => String(f.get(k) ?? "").trim();
  const num = (k: string) => (str(k) ? Number(str(k)) || null : null);
  let ids: number[];
  try {
    ids = raiseBlockerFor(me.id, {
      title: str("title"), category: str("category"), people: f.getAll("person").map(String), teams: f.getAll("team").map(String), none: f.get("none") === "on",
      notify: (["manager", "person", "none"].includes(str("notify")) ? str("notify") : "manager") as "manager" | "person" | "none", notifyPerson: str("notifyPerson") || null,
      goalId: num("goalId"), milestoneId: num("milestoneId"), needed: str("needed"), needBy: str("needBy") || null, details: str("details"), origin: str("origin"),
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/", "layout");
  redirect(`/blockers?raised=${ids.length}&open=${ids[0]}#b${ids[0]}`);
}

/** "Not blocked" on PMG's nudge about a goal that's behind. */
export async function dismissNudgeAction(f: FormData) {
  const me = await requirePerson();
  dismissNudge(me.id, Number(f.get("goalId")));
  revalidatePath("/", "layout");
}
