import type { DatabaseSync } from "node:sqlite";
import { QUARTER_END } from "@/lib/time";
import snapshot from "./jira/sp0-112.json";

// Jira epic SP0-112 "Simkey Phase 3" (snapshot in jira/sp0-112.json) as the Engineering and Product teams'
// goals, milestones, blockers and wins:
// - The epic is Suchitra's team goal. Progress is Done issues out of all of them, Backlog included, as Jira counts it.
// - Each engineer gets one goal; its milestones are the issues assigned to them (the Developer when unassigned).
// - Each product owner gets one goal; its milestones are the issues they're Product Owner on.
//   Backlog issues aren't committed work, so they stay out of both.
// - On Hold and With Product issues are blockers raised by the assignee and waiting on the Product Owner,
//   open since Jira moved them to that status. Issues without a Product Owner stay plain open milestones.
// - A Jira "is blocked by" link between two people is a blocker, resolved when the blocking issue was.
// - Done Features, Stories and Production Bugs are wins for the assignee; Done Features and Stories also for the Product Owner.
// Jira has no due dates on the epic, so goals use the quarter end.

export type JiraIssue = (typeof snapshot.issues)[number];

export const JIRA_BROWSE = "https://jobsforher.atlassian.net/browse/";

/** Jira display names → org chart ids. "Product Simkey" is a shared product account, so its issues have no owner. */
export const JIRA_PEOPLE: Record<string, string> = {
  "Suchitra Jampal": "suchitra", "Mohammed Bhoraniya": "mohammed", "Priya Kumari": "priya", "Rupam Mishra": "rupam",
  "Subham Das": "subham", "kanav anand": "kanav", "Athiqur Rehman K R": "athiqur", "Venkatesh TR": "venkatesh",
  "AMAN KUMAR": "aman", "Anand Babu": "anand", "Shivakumar Baragi": "shivakumar",
};
/** Jira "Product Owner" values → org chart ids. "Tech" means engineering owns it, so it maps to nobody. */
export const JIRA_PRODUCT_OWNERS: Record<string, string> = { Anshika: "anshika", Utkarsh: "utkarsh", Akriti: "kumari", Salman: "salman" };

/** Everyone whose seeded goals, blockers and wins Phase 3 replaces, even if they have no Phase 3 issues. */
export const PHASE3_PEOPLE = [...new Set([...Object.values(JIRA_PEOPLE), ...Object.values(JIRA_PRODUCT_OWNERS)])];

export const issueOwner = (i: Pick<JiraIssue, "assignee" | "developer">): string | null =>
  JIRA_PEOPLE[i.assignee ?? ""] ?? JIRA_PEOPLE[i.developer ?? ""] ?? null;
export const productOwner = (i: Pick<JiraIssue, "productOwner">): string | null => JIRA_PRODUCT_OWNERS[i.productOwner ?? ""] ?? null;

type PlanGoal = { owner: string; role: "engineer" | "product"; title: string; start: string; issues: JiraIssue[] };
type PlanBlocker = { raisedBy: string; owner: string; title: string; details: string; opened: string; resolved: string | null; key: string };
/** A "helped" win names whose blocker was cleared (`helped`); the title is finished when seeding, from the org chart name. */
type PlanWin = { person: string; kind: "win" | "helped"; title: string; at: string; key: string; helped?: string };

export type Phase3Plan = {
  team: { title: string; done: number; total: number; start: string };
  goals: PlanGoal[];
  blockers: PlanBlocker[];
  wins: PlanWin[];
  /** Issues no org chart person owns: counted in the team goal only. */
  unowned: string[];
};

/** Turns the snapshot into PMG records without touching the database. */
export function phase3Plan(): Phase3Plan {
  const issues = snapshot.issues;
  const committed = issues.filter((i) => i.status !== "Backlog");
  const byCreated = (a: JiraIssue, b: JiraIssue) => a.created.localeCompare(b.created) || a.key.localeCompare(b.key);

  const goals: PlanGoal[] = [];
  const group = (pick: (i: JiraIssue) => string | null, role: PlanGoal["role"]) => {
    const by = new Map<string, JiraIssue[]>();
    for (const i of committed) {
      const id = pick(i);
      if (id) by.set(id, [...(by.get(id) ?? []), i]);
    }
    for (const [owner, list] of by) {
      list.sort(byCreated);
      const n = list.length;
      const title = role === "engineer"
        ? `Deliver ${n} Simkey Phase 3 issue${n > 1 ? "s" : ""}`
        : `Take ${n} Simkey Phase 3 issues to release as product owner`;
      goals.push({ owner, role, title, start: list[0].created, issues: list });
    }
  };
  group(issueOwner, "engineer");
  group(productOwner, "product");

  const blockers: PlanBlocker[] = [];
  for (const i of committed.filter((x) => x.heldSince)) {
    const raisedBy = issueOwner(i), owner = productOwner(i);
    if (!raisedBy || !owner) continue;
    blockers.push({
      raisedBy, owner, key: i.key, title: i.summary, opened: `${i.heldSince}T10:00`, resolved: null,
      details: `${i.key} is ${i.status} in Jira. ${i.productOwner} is the product owner.`,
    });
  }
  const wins: PlanWin[] = [];
  for (const i of issues) {
    for (const blockingKey of i.blockedBy) {
      const b = snapshot.external.find((x) => x.key === blockingKey) ?? issues.find((x) => x.key === blockingKey);
      const raisedBy = issueOwner(i), owner = b && JIRA_PEOPLE[b.assignee ?? ""];
      if (!b || !raisedBy || !owner || owner === raisedBy || !b.resolved) continue;
      blockers.push({
        raisedBy, owner, key: b.key, title: b.summary, opened: `${b.created}T10:00`, resolved: `${b.resolved}T17:00`,
        details: `${i.key} ${i.summary} was blocked by ${b.key} in Jira.`,
      });
      const days = Math.max(1, Math.round((Date.parse(b.resolved) - Date.parse(b.created)) / 86_400_000));
      wins.push({ person: owner, kind: "helped", helped: raisedBy, title: `blocker “${b.summary}” in ${days} day${days > 1 ? "s" : ""}`, at: `${b.resolved}T17:00`, key: b.key });
    }
  }

  for (const i of issues.filter((x) => x.done && x.resolved)) {
    const at = `${i.resolved}T18:00`;
    const owner = issueOwner(i), po = productOwner(i);
    const shipped = i.type === "Feature" || i.type === "Story";
    if (owner && shipped) wins.push({ person: owner, kind: "win", title: `Shipped ${i.summary}`, at, key: i.key });
    if (owner && i.type === "Production Bug") wins.push({ person: owner, kind: "win", title: `Fixed production bug: ${i.summary}`, at, key: i.key });
    if (po && shipped) wins.push({ person: po, kind: "win", title: `Released ${i.summary}`, at, key: i.key });
  }

  return {
    team: { title: `Ship ${snapshot.epic.summary}`, done: issues.filter((i) => i.done).length, total: issues.length, start: snapshot.epic.created },
    goals, blockers, wins,
    unowned: issues.filter((i) => !issueOwner(i)).map((i) => i.key),
  };
}

/**
 * Inserts Phase 3 into a freshly seeded database. People in `planned` get no Phase 3 goal: their weekly, monthly
 * and quarterly goals come from their live Jira tickets instead (see planned.ts). Returns the team goal id.
 */
export function seedPhase3(db: DatabaseSync, planned: Set<string> = new Set()): number {
  const ins = (sql: string, ...p: (string | number | null)[]) => Number(db.prepare(sql).run(...p).lastInsertRowid);
  const plan = phase3Plan();
  const measure = `Issues marked Done in Jira epic ${snapshot.epic.key}`;
  const contribution = `${snapshot.epic.key} ${snapshot.epic.summary}: ${snapshot.epic.description.replace(/\s+/g, " ")}`;
  const teamOf = (id: string) => (db.prepare("SELECT team_id FROM people WHERE id = ?").get(id) as { team_id: string }).team_id;
  const nameOf = (id: string) => (db.prepare("SELECT name FROM people WHERE id = ?").get(id) as { name: string }).name;

  const team = ins(
    `INSERT INTO goals (level,title,owner_id,team_id,measure,progress_mode,count_done,count_total,start_date,due_date,contribution,status,created_at)
     VALUES ('team',?,?,?,?,'count',?,?,?,?,?,'approved',?)`,
    plan.team.title, JIRA_PEOPLE[snapshot.epic.assignee], "engineering", measure, plan.team.done, plan.team.total, plan.team.start, QUARTER_END,
    contribution, `${plan.team.start}T10:00`,
  );

  const goalOf = new Map<string, number>();
  for (const g of plan.goals.filter((x) => !planned.has(x.owner))) {
    const id = ins(
      `INSERT INTO goals (level,title,owner_id,team_id,parent_id,measure,progress_mode,start_date,due_date,contribution,status,created_at)
       VALUES ('individual',?,?,?,?,?,'milestones',?,?,?,'approved',?)`,
      g.title, g.owner, teamOf(g.owner), team, g.role === "engineer" ? measure : `Issues I'm Product Owner on, marked Done in Jira epic ${snapshot.epic.key}`,
      g.start, QUARTER_END, contribution, `${g.start}T10:00`,
    );
    goalOf.set(g.owner, id);
    g.issues.forEach((i, n) => ins("INSERT INTO milestones (goal_id,title,due_date,done_at,position) VALUES (?,?,?,?,?)",
      id, `${i.summary} (${i.key})`, i.due, i.resolved, n));
  }

  for (const b of plan.blockers) {
    const id = ins(
      "INSERT INTO blockers (raised_by,owner_id,goal_id,title,details,opened_at,status,resolved_at) VALUES (?,?,?,?,?,?,?,?)",
      b.raisedBy, b.owner, goalOf.get(b.raisedBy) ?? null, b.title, b.details, b.opened, b.resolved ? "resolved" : "waiting", b.resolved,
    );
    if (!b.resolved) {
      ins("INSERT INTO chat_messages (to_id,from_id,kind,body,data,at) VALUES (?,?,?,?,?,?)",
        b.owner, "pmg", "blocker_request", `${nameOf(b.raisedBy)} is blocked: ${b.title}`, JSON.stringify({ blockerId: id }), b.opened);
    }
  }

  for (const w of plan.wins) {
    ins("INSERT INTO wins (person_id,kind,title,goal_id,visibility,evidence,source,at) VALUES (?,?,?,?,?,?,?,?)",
      w.person, w.kind, w.helped ? `Cleared ${nameOf(w.helped).split(" ")[0]}'s ${w.title}` : w.title, w.kind === "win" ? goalOf.get(w.person) ?? null : null, w.kind === "win" ? "team" : "manager",
      JSON.stringify([{ kind: "jira", label: w.key, url: JIRA_BROWSE + w.key }]), "jira", w.at);
  }
  return team;
}
