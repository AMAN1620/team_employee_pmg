import { all, get } from "@/lib/db";
import { today } from "@/lib/time";
import type {
  ActionItem, AgendaTopic, Blocker, ChatMessage, Checkin, CheckinItem, Connection, Feedback, FeedbackRequest, Goal, Milestone,
  GoalAttachment, GoalComment, OneOnOne, Person, RatingLevel, Review, ReviewCycle, Rubric, Team, Win, WorkItem,
} from "./types";

export * from "./types";

// People and teams
export const getPerson = (id: string) => get<Person>("SELECT * FROM people WHERE id = ?", id);
export const listPeople = () => all<Person>("SELECT * FROM people ORDER BY name");
export const directReports = (managerId: string) => all<Person>("SELECT * FROM people WHERE manager_id = ? ORDER BY name", managerId);
export const listTeams = () => all<Team>("SELECT * FROM teams ORDER BY headcount DESC");
export const getTeam = (id: string) => get<Team>("SELECT * FROM teams WHERE id = ?", id);

export function peopleById(): Map<string, Person> {
  return new Map(listPeople().map((p) => [p.id, p]));
}

// Goals
export const getGoal = (id: number) => get<Goal>("SELECT * FROM goals WHERE id = ?", id);
/** A person's work goals. Personal goals are left out here, so check-ins, 1:1s, reviews and team views never see them. */
export const goalsFor = (ownerId: string) =>
  all<Goal>("SELECT * FROM goals WHERE owner_id = ? AND level = 'individual' AND kind = 'work' ORDER BY status = 'approved' DESC, due_date, id", ownerId);
/** Week, month and quarter goals a person set themselves (work and personal), not the ones PMG planned. */
export const ownPlanGoals = (ownerId: string) =>
  all<Goal>("SELECT * FROM goals WHERE owner_id = ? AND source = 'manual' AND horizon IN ('week','month','quarter') ORDER BY start_date, id", ownerId);
/** The goals a person set inside one of theirs (the months of a quarter goal, the weeks of a month goal). */
export const goalsInside = (goalId: number) =>
  all<Goal>("SELECT * FROM goals WHERE parent_id = ? AND source = 'manual' AND horizon IN ('week','month','quarter') ORDER BY start_date, id", goalId);
/** A person's personal (side) goals: for their own Personal tab only. */
export const personalGoalsFor = (ownerId: string) =>
  all<Goal>("SELECT * FROM goals WHERE owner_id = ? AND kind = 'personal' ORDER BY start_date, id", ownerId);
export const companyGoals = () => all<Goal>("SELECT * FROM goals WHERE level = 'company' ORDER BY id");
export const teamGoals = () => all<Goal>("SELECT * FROM goals WHERE level = 'team' ORDER BY id");
export const childGoals = (parentId: number) => all<Goal>("SELECT * FROM goals WHERE parent_id = ? ORDER BY id", parentId);
export const pendingApprovals = (managerId: string) =>
  all<Goal>(`SELECT g.* FROM goals g JOIN people p ON p.id = g.owner_id
             WHERE p.manager_id = ? AND g.status = 'pending' AND g.kind = 'work' ORDER BY g.submitted_at`, managerId);
export const milestonesFor = (goalId: number) => all<Milestone>("SELECT * FROM milestones WHERE goal_id = ? ORDER BY position, id", goalId);
export const goalChanges = (goalId: number) =>
  all<{ id: number; summary: string; reason: string | null; by_id: string | null; at: string }>("SELECT * FROM goal_changes WHERE goal_id = ? ORDER BY at DESC", goalId);
export const goalComments = (goalId: number) =>
  all<{ id: number; field: string | null; author_id: string; body: string; at: string }>("SELECT * FROM goal_comments WHERE goal_id = ? ORDER BY at", goalId);
export const parseRubric = (g: Pick<Goal, "rubric">): Rubric => { try { return JSON.parse(g.rubric) as Rubric; } catch { return {}; } };

// Blockers
export const getBlocker = (id: number) => get<Blocker>("SELECT * FROM blockers WHERE id = ?", id);
export const blockersRaisedBy = (personId: string) => all<Blocker>("SELECT * FROM blockers WHERE raised_by = ? ORDER BY status = 'resolved', opened_at DESC", personId);
export const blockersOwnedBy = (personId: string) => all<Blocker>("SELECT * FROM blockers WHERE owner_id = ? ORDER BY status = 'resolved', opened_at DESC", personId);
export const blockersForGoal = (goalId: number) => all<Blocker>("SELECT * FROM blockers WHERE goal_id = ? ORDER BY status = 'resolved', opened_at DESC", goalId);
export const allBlockers = () => all<Blocker>("SELECT * FROM blockers ORDER BY opened_at DESC");

// Wins
export const winsFor = (personId: string) => all<Win>("SELECT * FROM wins WHERE person_id = ? ORDER BY at DESC", personId);
export const winsForGoal = (goalId: number) => all<Win>("SELECT * FROM wins WHERE goal_id = ? ORDER BY at DESC", goalId);
export const parseEvidence = (w: Pick<Win, "evidence">): { kind: string; label: string; url?: string }[] => {
  try { return JSON.parse(w.evidence); } catch { return []; }
};

// Check-ins
export const checkinsFor = (personId: string) => all<Checkin>("SELECT * FROM checkins WHERE person_id = ? ORDER BY submitted_at DESC", personId);
export const getCheckin = (id: number) => get<Checkin>("SELECT * FROM checkins WHERE id = ?", id);
export const pendingCheckin = (personId: string) =>
  get<Checkin>("SELECT * FROM checkins WHERE person_id = ? AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1", personId);
export const lastConfirmedCheckin = (personId: string) =>
  get<Checkin>("SELECT * FROM checkins WHERE person_id = ? AND status = 'confirmed' ORDER BY submitted_at DESC LIMIT 1", personId);
export const checkinItems = (checkinId: number) => all<CheckinItem>("SELECT * FROM checkin_items WHERE checkin_id = ? ORDER BY id", checkinId);

// Feedback
export const feedbackTo = (personId: string) => all<Feedback>("SELECT * FROM feedback WHERE to_id = ? ORDER BY at DESC", personId);
export const feedbackFrom = (personId: string) => all<Feedback>("SELECT * FROM feedback WHERE from_id = ? ORDER BY at DESC", personId);
export const feedbackRequestsBy = (personId: string) => all<FeedbackRequest>("SELECT * FROM feedback_requests WHERE requester_id = ? ORDER BY at DESC", personId);
export const feedbackRequestsFor = (personId: string) => all<FeedbackRequest>("SELECT * FROM feedback_requests WHERE reviewer_id = ? AND status = 'open' ORDER BY at DESC", personId);

// 1:1s
export const oneOnOnesFor = (employeeId: string) => all<OneOnOne>("SELECT * FROM one_on_ones WHERE employee_id = ? ORDER BY scheduled_at DESC", employeeId);
export const managerOneOnOnes = (managerId: string) => all<OneOnOne>("SELECT * FROM one_on_ones WHERE manager_id = ? ORDER BY scheduled_at", managerId);
export const getOneOnOne = (id: number) => get<OneOnOne>("SELECT * FROM one_on_ones WHERE id = ?", id);
export const agendaTopics = (oneId: number) => all<AgendaTopic>("SELECT * FROM agenda_topics WHERE one_on_one_id = ? ORDER BY at", oneId);
export const actionItemsBetween = (employeeId: string, managerId: string) =>
  all<ActionItem>("SELECT * FROM action_items WHERE employee_id = ? AND manager_id = ? ORDER BY done_at IS NOT NULL, due", employeeId, managerId);

// Reviews
export const activeCycle = () => get<ReviewCycle>("SELECT * FROM review_cycles WHERE status = 'active' ORDER BY id DESC LIMIT 1");
export const ratingLevels = (cycleId: number) => all<RatingLevel>("SELECT * FROM rating_levels WHERE cycle_id = ? ORDER BY level", cycleId);
export const getReview = (cycleId: number, personId: string, kind: "self" | "manager") =>
  get<Review>("SELECT * FROM reviews WHERE cycle_id = ? AND person_id = ? AND kind = ?", cycleId, personId, kind);
export const reviewsInCycle = (cycleId: number) => all<Review>("SELECT * FROM reviews WHERE cycle_id = ?", cycleId);

// Chat
// Earlier days sort by time; today's messages keep the order they happened in, since the demo date is fixed but the clock is real.
export const chatFor = (personId: string) =>
  all<ChatMessage>("SELECT * FROM chat_messages WHERE to_id = ? ORDER BY CASE WHEN substr(at, 1, 10) < ? THEN at ELSE ? END, id", personId, today(), today());

// Work items and connectors
export const workItemsFor = (personId: string) =>
  all<WorkItem>("SELECT * FROM work_items WHERE person_id = ? ORDER BY COALESCE(done_at, '9999') DESC, created_at DESC", personId);
export const getWorkItem = (id: number) => get<WorkItem>("SELECT * FROM work_items WHERE id = ?", id);
export const connectionsFor = (personId: string) => all<Connection>("SELECT * FROM connections WHERE person_id = ? ORDER BY kind", personId);
export const allConnections = () => all<Connection>("SELECT * FROM connections ORDER BY person_id, kind");
/** A planned goal that's history: its period is over, or its feature is finished. */
export const isClosedPlan = (g: Pick<Goal, "horizon" | "due_date" | "expected_date">) =>
  !!g.horizon && (g.horizon === "feature" ? (g.expected_date ?? g.due_date) : g.due_date) < today();
/** A planned goal whose period hasn't started yet (next week, next month). */
export const isFuturePlan = (g: Pick<Goal, "horizon" | "start_date">) => !!g.horizon && g.start_date > today();
export const plannedGoal = (ownerId: string, planKey: string) =>
  get<Goal>("SELECT * FROM goals WHERE owner_id = ? AND plan_key = ? AND source = 'ai'", ownerId, planKey);
/** Week goals not yet sent to the manager, and tickets waiting for the manager to approve joining a week. */
export const draftPlansFor = (managerId: string) =>
  all<Goal>(`SELECT g.* FROM goals g JOIN people p ON p.id = g.owner_id
             WHERE p.manager_id = ? AND g.horizon = 'week' AND g.source = 'ai' AND g.status IN ('draft','changes_requested') AND g.due_date >= ? ORDER BY g.start_date`, managerId, today());
export const pendingAdditions = (managerId: string) =>
  all<Milestone & { owner_id: string; goal_title: string; start_date: string }>(`SELECT m.*, g.owner_id, g.title AS goal_title, g.start_date FROM milestones m
             JOIN goals g ON g.id = m.goal_id JOIN people p ON p.id = g.owner_id WHERE p.manager_id = ? AND m.pending_since IS NOT NULL ORDER BY m.pending_since`, managerId);

// Settings
export const setting = (key: string) => get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)?.value;

// Org hierarchy
/** Everyone below a manager, at any depth, in top-down order. */
export function orgBelow(managerId: string): Person[] {
  const out: Person[] = [];
  const queue = directReports(managerId);
  while (queue.length) {
    const p = queue.shift()!;
    out.push(p);
    queue.push(...directReports(p.id));
  }
  return out;
}

/** The person's managers, nearest first. */
export function chainAbove(personId: string): Person[] {
  const out: Person[] = [];
  let p = getPerson(personId);
  while (p?.manager_id && out.length < 20) {
    p = getPerson(p.manager_id);
    if (p) out.push(p);
  }
  return out;
}

/** True when the viewer is anywhere above the person in the reporting line. */
export function isInLine(viewerId: string, personId: string): boolean {
  return chainAbove(personId).some((m) => m.id === viewerId);
}

// ── Comments and attachments on goals ──

export function commentsFor(goalId: number): GoalComment[] {
  const comments = all<Omit<GoalComment, "attachments">>("SELECT * FROM goal_comments WHERE goal_id = ? ORDER BY at, id", goalId);
  const files = all<GoalAttachment>(`SELECT a.* FROM goal_attachments a JOIN goal_comments c ON c.id = a.comment_id WHERE c.goal_id = ? ORDER BY a.id`, goalId);
  return comments.map((c) => ({ ...c, attachments: files.filter((f) => f.comment_id === c.id) }));
}

export const getAttachment = (id: number) =>
  get<GoalAttachment & { goal_id: number }>("SELECT a.*, c.goal_id FROM goal_attachments a JOIN goal_comments c ON c.id = a.comment_id WHERE a.id = ?", id);
