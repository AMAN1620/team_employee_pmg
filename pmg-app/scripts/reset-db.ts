// Re-creates data/pmg.db with the demo company. Run with `npm run db:reset`.
import { resetDb, get } from "../lib/db";

resetDb();
const people = get<{ n: number }>("SELECT COUNT(*) AS n FROM people");
const goals = get<{ n: number }>("SELECT COUNT(*) AS n FROM goals");
console.log(`Demo data ready: ${people?.n} people, ${goals?.n} goals.`);
