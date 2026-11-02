export type Role = "employee" | "manager" | "hr";

export type Person = {
  id: string; name: string; title: string; team_id: string; manager_id: string | null; role: Role; email: string;
  recognition_pref: string; default_visibility: string; chat_connected: number;
};

export type Team = { id: string; name: string; headcount: number; self_done_base: number; mgr_done_base: number };

export type Goal = {
  id: number; level: "company" | "team" | "individual"; title: string; owner_id: string; team_id: string; parent_id: number | null;
  measure: string | null; baseline: number | null; target: number | null; current: number | null; unit: string | null;
  progress_mode: "metric" | "milestones" | "count" | "manual"; count_done: number | null; count_total: number | null;
  manual_progress: number | null; start_date: string; due_date: string; rubric: string; dependencies: string | null;
  contribution: string | null; status: "draft" | "pending" | "changes_requested" | "approved";
  approved_by: string | null; approved_at: string | null; submitted_at: string | null; created_at: string;
  /**
   * Set on goals PMG plans from work: a week, month or quarter (start_date..due_date), or a feature (due_date is
   * its deadline, expected_date when it's now expected to finish). Weeks can also be set by the manager.
   */
  horizon: "week" | "month" | "quarter" | "feature" | null; source: "manual" | "ai" | "manager";
  /** Work goals go to the manager for approval; personal (side) goals need none and only their owner sees them. */
  kind: "work" | "personal";
  /** Which plan item an AI goal is ("week:2026-10-26", "feature:SP0-615") and the tasks it was worded for. */
  plan_key: string | null; plan_sig: string | null; title_locked: number; expected_date: string | null;
};

export type Rubric = { partial?: string; meets?: string; exceeds?: string };

export type Milestone = {
  id: number; goal_id: number; title: string; due_date: string | null; done_at: string | null; position: number;
  work_item_id: number | null; note: string | null;
  /** Set when a ticket joined an approved goal and the manager hasn't approved the addition yet. */
  pending_since: string | null;
};

export type Connection = {
  id: number; person_id: string; kind: string; external_id: string; label: string | null; last_synced_at: string | null; last_error: string | null;
};

/** A ticket or task from a connector (Jira) or typed in by hand. Dates are YYYY-MM-DD. */
export type GoalAttachment = { id: number; comment_id: number; name: string; mime: string; size: number; stored: string };
/** A comment on a goal; `field` is set on a manager's review note about one part of a proposed goal. */
export type GoalComment = { id: number; goal_id: number; field: string | null; author_id: string; body: string; at: string; attachments: GoalAttachment[] };

export type WorkItem = {
  id: number; person_id: string; source: string; external_key: string | null; url: string | null; title: string; kind: string | null;
  status: "todo" | "in_progress" | "review" | "on_hold" | "done"; status_label: string | null; size: number | null;
  parent_key: string | null; parent_title: string | null; epic_key: string | null; epic_title: string | null;
  created_at: string; started_at: string | null; done_at: string | null; due_date: string | null; synced_at: string | null;
  /** The milestone PMG wrote for this task (what is true once it's done), and the ticket title it was written from. */
  outcome?: string | null; outcome_of?: string | null;
  /** When the person ticked the task off in PMG before its source caught up. */
  marked_done_at?: string | null;
};

export type Blocker = {
  id: number; raised_by: string; owner_id: string; goal_id: number | null; title: string; details: string | null;
  opened_at: string; need_by: string | null; status: "waiting" | "accepted" | "needs_info" | "redirected" | "resolved";
  reply: string | null; resolved_at: string | null; escalated_to: string | null; escalated_at: string | null; nudged_at: string | null;
  /** One of BLOCKER_CATEGORIES (null on blockers found in a check-in); what's needed to get unstuck. */
  category: string | null; needed: string | null; milestone_id: number | null;
  /** Where it was raised: goal, milestone, overdue_task, nudge, checkin or page. */
  origin: string | null;
  /** Blockers raised together (one per person or team tagged) share a group key. */
  group_key: string | null;
  /** Set when a team was tagged: the request went to its head, who can pass it on (delegated_by is then the head). */
  team_id: string | null; delegated_by: string | null; meeting_requested_at: string | null;
};

/** A message PMG would send outside itself (Slack, Google Chat, email, calendar). Mocked: recorded, never sent. */
export type OutboxMessage = { id: number; to_id: string; channel: string; kind: string; subject: string | null; body: string; blocker_id: number | null; at: string };

export type Win = {
  id: number; person_id: string; kind: "win" | "kudos" | "helped" | "unplanned"; title: string; body: string | null;
  goal_id: number | null; from_id: string | null; visibility: "private" | "manager" | "team" | "company";
  evidence: string; source: string; tag: string | null; at: string;
};

export type Checkin = {
  id: number; person_id: string; week_of: string; moved: string | null; stuck: string | null; next: string | null;
  mood: number | null; source: string; status: "pending" | "confirmed"; submitted_at: string; confirmed_at: string | null;
};

export type CheckinItem = {
  id: number; checkin_id: number; kind: "progress" | "win" | "blocker" | "existing_blocker" | "unplanned" | "next";
  text: string; goal_id: number | null; data: string; state: "suggested" | "confirmed" | "removed";
};

export type Feedback = {
  id: number; from_id: string; to_id: string; goal_id: number | null; about: string; keep: string | null;
  improve: string | null; next_action: string | null; request_id: number | null; at: string;
};

export type FeedbackRequest = {
  id: number; requester_id: string; reviewer_id: string; goal_id: number | null; about: string; due: string | null;
  kind: string; status: string; at: string;
};

export type OneOnOne = { id: number; employee_id: string; manager_id: string; scheduled_at: string; notes: string };
export type AgendaTopic = { id: number; one_on_one_id: number; author_id: string; text: string; at: string };
export type ActionItem = {
  id: number; employee_id: string; manager_id: string; one_on_one_id: number | null; owner_id: string; text: string;
  due: string | null; goal_id: number | null; blocker_id: number | null; carried_from: string | null; done_at: string | null; created_at: string;
};

export type ReviewCycle = {
  id: number; name: string; self_due: string; manager_due: string; status: string; peer_enabled: number;
  show_rubric: number; require_comment: number; forced_distribution: number; participants: number;
};
export type RatingLevel = { cycle_id: number; level: number; label: string; description: string };

export type ReviewGoalEntry = { rating?: number; text?: string; reviewed?: boolean; comment?: string };
export type ReviewPayload = { goals?: Record<string, ReviewGoalEntry>; beyond?: string; beyondReviewed?: boolean; overall?: string };
export type Review = {
  id: number; cycle_id: number; person_id: string; reviewer_id: string; kind: "self" | "manager";
  status: "draft" | "submitted"; payload: string; submitted_at: string | null;
};

export type ChatMessage = {
  id: number; to_id: string; from_id: string; kind: string; body: string; data: string; at: string; handled: string | null;
};
