import { fetchJiraWork, jiraConfig } from "./jira";
import type { Connector } from "./types";

export type * from "./types";

/** Every work-tool connector PMG knows. People without one add their work by hand on the My work page. */
export const CONNECTORS: Record<string, Connector> = {
  jira: {
    kind: "jira",
    label: "Jira",
    configured: () => !!jiraConfig(),
    fetch: (accountId) => fetchJiraWork(jiraConfig()!, accountId),
  },
};
