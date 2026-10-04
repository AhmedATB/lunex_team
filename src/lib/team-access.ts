import type { TeamAccess, TeamLevel } from "@/lib/auth-types";

export const canPublishAt = (level: TeamLevel): boolean => level === "lead" || level === "publisher";

export const TEAM_LEVEL_LABELS: Record<TeamLevel, string> = {
  lead: "قيادة الفريق",
  publisher: "ناشر",
  uploader: "رافع",
};

/** The signed-in person's standing in one team, from the answer of /auth/me — what the server will honour, not the browser's own copy of the roster. */
export function accessIn(user: { teamAccess?: TeamAccess[] } | null | undefined, teamId: string): TeamAccess | undefined {
  return user?.teamAccess?.find((access) => access.teamId === teamId);
}
