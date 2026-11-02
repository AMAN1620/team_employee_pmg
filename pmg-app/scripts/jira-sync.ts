// Syncs every connected person from Jira into data/pmg.db and replans their goals, once.
// The running app does the same every 15 minutes (instrumentation.ts). Run with `npm run jira:sync`.
import { syncConnections } from "../lib/services/work";

syncConnections().then((results) => {
  for (const r of results) console.log(r.ok ? `${r.personId}: ${r.items} tickets (${r.added} new), ${r.drafted} goals drafted` : `${r.personId}: ${r.error}`);
  if (results.some((r) => !r.ok)) process.exit(1);
});
