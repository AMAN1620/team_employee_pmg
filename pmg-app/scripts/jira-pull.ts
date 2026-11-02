// Saves the seeded people's Jira tickets to lib/db/jira/work-items.json, which the demo seed loads.
// Run with `npm run jira:pull` (needs JIRA_EMAIL and JIRA_API_TOKEN, see lib/connectors/jira.ts).
import fs from "node:fs";
import path from "node:path";
import { fetchJiraWork, jiraConfig } from "../lib/connectors/jira";
import { SEEDED_JIRA } from "../lib/connectors/seeded";

async function main() {
  const cfg = jiraConfig();
  if (!cfg) throw new Error("Set JIRA_EMAIL and JIRA_API_TOKEN (or jira_email / jira_token in .env) first.");
  const people: Record<string, unknown> = {};
  for (const [id, { accountId }] of Object.entries(SEEDED_JIRA)) {
    const items = await fetchJiraWork(cfg, accountId);
    people[id] = { accountId, items };
    console.log(`${id}: ${items.length} tickets`);
  }
  const file = path.join(process.cwd(), "lib", "db", "jira", "work-items.json");
  const lines = Object.entries(people).map(([id, p]) => {
    const { accountId, items } = p as { accountId: string; items: unknown[] };
    return `  ${JSON.stringify(id)}: {"accountId": ${JSON.stringify(accountId)}, "items": [\n${items.map((i) => `    ${JSON.stringify(i)}`).join(",\n")}\n  ]}`;
  });
  fs.writeFileSync(file, `{\n "pulledOn": ${JSON.stringify(new Date().toISOString().slice(0, 10))},\n "people": {\n${lines.join(",\n")}\n }\n}\n`);
  console.log(`Saved ${file}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
