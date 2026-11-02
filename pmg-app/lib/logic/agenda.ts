import type { ActionItem, AgendaTopic, Blocker, Win } from "@/lib/repo/types";
import { daysBetween } from "@/lib/time";

export type AgendaItem = {
  key: string;
  source: "blocker" | "at_risk" | "win" | "topic" | "action";
  label: string;
  text: string;
  authorId?: string;
};

/**
 * The 1:1 agenda builds itself from what's already in PMG: open blockers, goals at risk,
 * recent wins and overdue actions, then the topics either person added.
 */
export function buildAgenda(input: {
  today: string;
  employeeName: string;
  managerName: string;
  openBlockers: (Blocker & { ownerName: string })[];
  atRiskGoals: { id: number; title: string; reason: string }[];
  recentWins: Win[];
  actions: ActionItem[];
  topics: AgendaTopic[];
}): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const b of input.openBlockers) {
    items.push({ key: `b${b.id}`, source: "blocker", label: "Blocker", text: `${b.title}: waiting on ${b.ownerName}, open ${daysBetween(b.opened_at, input.today)} days` });
  }
  for (const g of input.atRiskGoals) items.push({ key: `g${g.id}`, source: "at_risk", label: "At-risk goal", text: `${g.title}: ${g.reason.replace(/^At risk: /, "")}` });
  for (const w of input.recentWins.filter((w) => daysBetween(w.at, input.today) <= 14).slice(0, 2)) {
    items.push({ key: `w${w.id}`, source: "win", label: w.kind === "kudos" ? "Kudos" : "Win", text: w.title });
  }
  for (const a of input.actions.filter((a) => !a.done_at && a.due && a.due < input.today)) {
    items.push({ key: `a${a.id}`, source: "action", label: "Overdue action", text: a.text });
  }
  for (const t of input.topics) {
    items.push({ key: `t${t.id}`, source: "topic", label: "Topic", text: t.text, authorId: t.author_id });
  }
  return items;
}
