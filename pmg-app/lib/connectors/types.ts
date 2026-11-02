import type { WorkItem } from "@/lib/repo/types";

/** What a connector hands PMG for each ticket: a work item without PMG's own columns. */
export type WorkItemInput = Omit<WorkItem, "id" | "person_id" | "synced_at">;

/**
 * A work-tool connector (Jira today; Linear, GitHub or Asana would be more of these).
 * `externalId` is the person's id in that tool, stored on their connection.
 */
export type Connector = {
  kind: string;
  label: string;
  configured(): boolean;
  fetch(externalId: string): Promise<WorkItemInput[]>;
};
