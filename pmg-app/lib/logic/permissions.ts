import type { Person, Win } from "@/lib/repo/types";

type Viewer = Pick<Person, "id" | "role" | "team_id">;
type Owner = Pick<Person, "id" | "manager_id" | "team_id">;

/** Wins journal entries follow the owner's visibility choice. HR gets no special access to the journal. */
export function canSeeWin(viewer: Viewer, owner: Owner, win: Pick<Win, "visibility">): boolean {
  if (viewer.id === owner.id) return true;
  switch (win.visibility) {
    case "private": return false;
    case "manager": return owner.manager_id === viewer.id;
    case "team": return owner.manager_id === viewer.id || owner.team_id === viewer.team_id;
    case "company": return true;
  }
}

/** Raw check-in replies are only ever shown to the person who wrote them. */
export function canSeeRawCheckin(viewer: Viewer, ownerId: string): boolean {
  return viewer.id === ownerId;
}

/** Managers see confirmed items, goals and reviews for their direct reports. */
export function isManagerOf(viewer: Viewer, owner: Owner): boolean {
  return owner.manager_id === viewer.id;
}

/** HR sees team-level numbers and submitted reviews, never individual journals or check-ins. */
export function canSeeSubmittedReview(viewer: Viewer, owner: Owner, status: string): boolean {
  if (viewer.id === owner.id || isManagerOf(viewer, owner)) return true;
  return viewer.role === "hr" && status === "submitted";
}
