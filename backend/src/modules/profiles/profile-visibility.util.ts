export const PROFILE_VISIBILITY_LEVELS = ["public", "members", "private"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITY_LEVELS)[number];

export interface Viewer {
  /** The caller's own account — always sees everything of theirs. */
  isSelf: boolean;
  /** A moderator or above — sees hidden sections so reports can be investigated. */
  isStaff: boolean;
  signedIn: boolean;
}

/** One rule for every section: the owner and staff always pass; otherwise the owner's chosen level decides. Anything unrecognised is treated as private. */
export function canView(level: string, viewer: Viewer): boolean {
  if (viewer.isSelf || viewer.isStaff) return true;
  if (level === "public") return true;
  if (level === "members") return viewer.signedIn;
  return false;
}
