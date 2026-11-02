// Jira Cloud connector: reads a person's tickets through the REST API with an API token.
// Settings: JIRA_EMAIL and JIRA_API_TOKEN (or jira_email / jira_token), JIRA_SITE (default jobsforher.atlassian.net).
// They're read from the environment, then from .env in this app or the folder above it.
import { setting } from "@/lib/env";
import type { WorkItemInput } from "./types";

export type JiraConfig = { site: string; email: string; token: string };

export function jiraConfig(): JiraConfig | null {
  const token = setting("JIRA_API_TOKEN", "jira_token");
  const email = setting("JIRA_EMAIL", "jira_email");
  if (!token || !email) return null;
  return { site: (setting("JIRA_SITE", "jira_site") ?? "https://jobsforher.atlassian.net").replace(/\/$/, ""), email, token };
}

type JiraIssue = {
  key: string;
  fields: {
    summary: string; created: string; resolutiondate: string | null; duedate: string | null; customfield_10028?: number | null;
    status: { name: string; statusCategory: { key: string } };
    issuetype: { name: string; hierarchyLevel?: number };
    parent?: { key: string; fields: { summary: string; issuetype: { name: string; hierarchyLevel?: number } } };
  };
  changelog?: { histories: { created: string; items: { field: string; toString: string | null }[] }[] };
};

async function search(cfg: JiraConfig, jql: string, fields: string, expand?: string): Promise<JiraIssue[]> {
  const out: JiraIssue[] = [];
  let token: string | undefined;
  do {
    const q = new URLSearchParams({ jql, fields, maxResults: "100", ...(expand ? { expand } : {}), ...(token ? { nextPageToken: token } : {}) });
    const res = await fetch(`${cfg.site}/rest/api/3/search/jql?${q}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${cfg.email}:${cfg.token}`).toString("base64")}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Jira search failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean };
    out.push(...body.issues);
    token = body.isLast === false ? body.nextPageToken : undefined;
  } while (token);
  return out;
}

const HELD = /^(on hold|blocked|with product)$/i;
const REVIEW = /\b(qa|review|testing|uat)\b/i;

function status(s: JiraIssue["fields"]["status"]): WorkItemInput["status"] {
  if (s.statusCategory.key === "done") return "done";
  if (HELD.test(s.name)) return "on_hold";
  if (REVIEW.test(s.name)) return "review";
  return s.statusCategory.key === "indeterminate" ? "in_progress" : "todo";
}

const isEpic = (t?: { name: string; hierarchyLevel?: number }) => !!t && (t.hierarchyLevel === 1 || t.name === "Epic");

/** Tickets assigned to (or developed by) this Jira account and touched in the last six months. */
export async function fetchJiraWork(cfg: JiraConfig, accountId: string): Promise<WorkItemInput[]> {
  const issues = await search(cfg, `(assignee = "${accountId}" OR cf[10032] = "${accountId}") AND updated >= -26w ORDER BY created ASC`,
    "summary,status,issuetype,parent,created,resolutiondate,duedate,customfield_10028", "changelog");

  // Sub-tasks point at their Feature; one more lookup finds the epic above it.
  const parentKeys = [...new Set(issues.map((i) => i.fields.parent).filter((p) => p && !isEpic(p.fields.issuetype)).map((p) => p!.key))];
  const epicOf = new Map<string, { key: string; title: string }>();
  for (let n = 0; n < parentKeys.length; n += 100) {
    for (const p of await search(cfg, `key in (${parentKeys.slice(n, n + 100).join(",")})`, "parent")) {
      if (p.fields.parent && isEpic(p.fields.parent.fields.issuetype)) epicOf.set(p.key, { key: p.fields.parent.key, title: p.fields.parent.fields.summary });
    }
  }

  return issues.map((i) => {
    const f = i.fields;
    const parent = f.parent && !isEpic(f.parent.fields.issuetype) ? f.parent : null;
    const epic = f.parent && isEpic(f.parent.fields.issuetype) ? { key: f.parent.key, title: f.parent.fields.summary } : parent ? epicOf.get(parent.key) : undefined;
    const started = (i.changelog?.histories ?? [])
      .slice().sort((a, b) => a.created.localeCompare(b.created))
      .find((h) => h.items.some((it) => it.field === "status" && it.toString === "In Progress"));
    const st = status(f.status);
    return {
      source: "jira", external_key: i.key, url: `${cfg.site}/browse/${i.key}`, title: f.summary.trim(), kind: f.issuetype.name,
      status: st, status_label: f.status.name, size: f.customfield_10028 || null,
      parent_key: parent?.key ?? null, parent_title: parent?.fields.summary.trim() ?? null,
      epic_key: epic?.key ?? null, epic_title: epic?.title.trim() ?? null,
      created_at: f.created.slice(0, 10), started_at: started?.created.slice(0, 10) ?? null,
      done_at: st === "done" && f.resolutiondate ? f.resolutiondate.slice(0, 10) : null, due_date: f.duedate,
    };
  });
}

/** Who the token belongs to, for the connection card. */
export async function jiraWhoAmI(cfg: JiraConfig): Promise<{ accountId: string; displayName: string }> {
  const res = await fetch(`${cfg.site}/rest/api/3/myself`, {
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.email}:${cfg.token}`).toString("base64")}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Jira sign-in failed: ${res.status}`);
  return (await res.json()) as { accountId: string; displayName: string };
}
