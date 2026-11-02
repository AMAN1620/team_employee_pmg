export type SortedItem =
  | { kind: "progress"; text: string; goalId: number | null }
  | { kind: "win"; text: string; goalId: number | null }
  | { kind: "blocker"; text: string; goalId: number | null; ownerId: string | null; needBy: string }
  | { kind: "existing_blocker"; text: string; goalId: number | null; blockerId: number }
  | { kind: "unplanned"; text: string; goalId: null; tag: string };

export type CheckinContext = {
  today: string;
  goals: { id: number; title: string; measure: string | null; milestones: string[] }[];
  openBlockers: { id: number; title: string; ownerId: string; goalId: number | null }[];
  people: { id: string; name: string; title: string; teamName: string; isLead: boolean; managerId: string | null }[];
};

export type CheckinInput = { moved: string; stuck: string; next: string };

export type EvidenceItem = {
  n: number;
  kind: "win" | "kudos" | "helped" | "unplanned" | "blocker" | "feedback" | "checkin";
  refId: number;
  goalId: number | null;
  date: string;
  label: string;
  detail: string;
};

export type AppraisalGoal = { id: number; title: string; health: string; progressText: string };

export type AppraisalDraft = { goals: Record<string, string>; beyond: string; source: "ai" | "rules" };

export type GoalQuality = { ok: boolean; issues: string[]; suggestion: string | null };

/** A goal PMG planned from work items, for the LLM to word as an outcome. Dates are YYYY-MM-DD. */
export type PlanGoalSpec = {
  key: string; kind: "week" | "month" | "quarter" | "feature"; label: string;
  features: { name: string; epic: string | null; deadline: string; expected: string; done: boolean }[];
  tasks: { title: string; milestone: string | null; feature: string; points: number | null; status: string; finish: string; done: boolean }[];
  fallback: GoalText;
};
export type GoalText = { title: string; doneWhen: string };
/** One task to turn into a milestone: what is achieved once it's done. */
export type MilestoneSpec = { key: string; task: string; feature: string; epic: string | null };
