"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePerson } from "@/lib/session";
import { addManualItem, approveAddition, assignWeekGoal, editPlannedGoal, markTaskDone, requestApproval, setManualStatus, syncConnections } from "@/lib/services/work";
import { decideGoal } from "@/lib/services/mutations";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
/** Back to the page the form was on (a same-site path only). */
const back = (f: FormData, fallback: string, note: string) => {
  const to = s(f, "back").startsWith("/") && !s(f, "back").startsWith("//") ? s(f, "back") : fallback;
  revalidatePath("/", "layout");
  redirect(`${to}${to.includes("?") ? "&" : "?"}done=${note}`);
};

export async function syncNowAction() {
  const me = await requirePerson();
  const [r] = await syncConnections(me.id);
  revalidatePath("/", "layout");
  redirect(r ? (r.ok ? `/work?synced=${r.items}&drafted=${r.drafted}` : `/work?error=${encodeURIComponent(r.error ?? "Sync failed")}`) : "/work");
}

export async function addWorkAction(f: FormData) {
  const me = await requirePerson();
  const drafted = await addManualItem(me.id, { title: s(f, "title"), size: s(f, "size"), due: s(f, "due") || null, started: f.get("started") === "on" });
  revalidatePath("/", "layout");
  redirect(`/work?added=1&drafted=${drafted.length}`);
}

export async function workStatusAction(f: FormData) {
  const me = await requirePerson();
  await setManualStatus(Number(s(f, "itemId")), me.id, s(f, "status") as "todo" | "in_progress" | "done");
  revalidatePath("/", "layout");
  redirect("/work");
}

/** The employee ticks (or unticks) a task's milestone on their plan. */
export async function tickTaskAction(f: FormData) {
  const me = await requirePerson();
  const weeks = await markTaskDone(Number(s(f, "itemId")), me.id, f.get("done") === "1");
  const to = new URL(s(f, "back").startsWith("/") && !s(f, "back").startsWith("//") ? s(f, "back") : "/goals?tab=weekly", "http://pmg");
  const week = s(f, "week");
  // On the plan, follow the task when it left the week it was ticked in (done today counts in this week).
  if (week && weeks.length && !weeks.includes(week)) {
    to.searchParams.delete("q"); to.searchParams.delete("m"); to.searchParams.set("week", weeks[weeks.length - 1]);
  }
  to.searchParams.set("done", f.get("done") === "1" ? "ticked" : "unticked");
  revalidatePath("/", "layout");
  redirect(`${to.pathname}${to.search}${week ? "#week" : ""}`);
}

/** The employee asks their manager to approve one drafted week, or every drafted week (goalIds). */
export async function requestApprovalAction(f: FormData) {
  const me = await requirePerson();
  for (const id of f.getAll("goalId")) requestApproval(Number(id), me.id);
  back(f, "/goals?tab=weekly", "requested");
}

export async function approvePlanAction(f: FormData) {
  const me = await requirePerson();
  decideGoal(Number(s(f, "goalId")), me.id, "approve", "");
  back(f, "/approvals", "approved");
}

export async function editPlanAction(f: FormData) {
  const me = await requirePerson();
  editPlannedGoal(Number(s(f, "goalId")), me.id, { title: s(f, "title"), doneWhen: s(f, "doneWhen") }, f.get("approve") === "1");
  back(f, "/approvals", f.get("approve") === "1" ? "approved" : "edited");
}

export async function approveAdditionAction(f: FormData) {
  const me = await requirePerson();
  approveAddition(Number(s(f, "milestoneId")), me.id);
  back(f, "/approvals", "added");
}

export async function assignWeekAction(f: FormData) {
  const me = await requirePerson();
  assignWeekGoal(me.id, s(f, "personId"), { week: s(f, "week"), title: s(f, "title"), doneWhen: s(f, "doneWhen"), itemIds: f.getAll("itemId").map(Number) });
  back(f, `/team/${s(f, "personId")}`, "assigned");
}
