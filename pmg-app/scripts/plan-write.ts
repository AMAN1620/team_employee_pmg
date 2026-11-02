// Has Claude write the seeded people's milestones (one per task) and word their planned goals from their saved tickets and saves the result to
// lib/db/jira/plan-words.json, which the demo seed uses so a reset works offline. Run after `npm run jira:pull`
// (needs ANTHROPIC_API_KEY, or anthropic_api_key in .env). Goals whose tasks later change fall back to rules.
import fs from "node:fs";
import path from "node:path";
import { buildPlan } from "../lib/planner";
import { planRows, tasksNeedingMilestones } from "../lib/planner/store";
import { aiEnabled, writeMilestones, writePlanGoals } from "../lib/ai";
import { SEEDED_JIRA } from "../lib/connectors/seeded";
import type { WorkItem } from "../lib/repo/types";
import { today } from "../lib/time";
import saved from "../lib/db/jira/work-items.json";

async function main() {
  if (!aiEnabled()) throw new Error("Set ANTHROPIC_API_KEY (or anthropic_api_key in .env) first.");
  const people: Record<string, Record<string, { sig: string; title: string; doneWhen: string }>> = {};
  const milestones: Record<string, Record<string, { of: string; text: string }>> = {};
  for (const id of Object.keys(SEEDED_JIRA)) {
    const raw = (saved.people as Record<string, { items: Omit<WorkItem, "id" | "person_id" | "synced_at">[] }>)[id]?.items ?? [];
    const items: WorkItem[] = raw.map((i, n) => ({ ...i, id: n + 1, person_id: id, synced_at: null }));
    const tasks = tasksNeedingMilestones(buildPlan(items, today()));
    const outcomes = await writeMilestones(tasks.map(({ item, feature }) => ({ key: String(item.id), task: item.title, feature: feature.theme, epic: feature.epic })));
    milestones[id] = {};
    for (const it of items) {
      const text = outcomes.get(String(it.id));
      if (text && it.external_key) { it.outcome = text; it.outcome_of = it.title; milestones[id][it.external_key] = { of: it.title, text }; }
    }
    console.log(`${id}: wrote ${Object.keys(milestones[id]).length} of ${tasks.length} milestones`);
    const rows = planRows(buildPlan(items, today()));
    const words = await writePlanGoals(rows.map((r) => r.spec));
    people[id] = {};
    for (const r of rows) {
      const w = words.get(r.key);
      if (w && w !== r.spec.fallback) people[id][r.key] = { sig: r.sig, ...w };
    }
    console.log(`${id}: worded ${Object.keys(people[id]).length} of ${rows.length} goals`);
  }
  const file = path.join(process.cwd(), "lib", "db", "jira", "plan-words.json");
  const lines = Object.entries(people).map(([id, goals]) =>
    `  ${JSON.stringify(id)}: {\n${Object.entries(goals).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n")}\n  }`);
  const ms = Object.entries(milestones).map(([id, m]) =>
    `  ${JSON.stringify(id)}: {\n${Object.entries(m).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n")}\n  }`);
  fs.writeFileSync(file, `{\n "writtenOn": ${JSON.stringify(today())},\n "milestones": {\n${ms.join(",\n")}\n },\n "people": {\n${lines.join(",\n")}\n }\n}\n`);
  console.log(`Saved ${file}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
