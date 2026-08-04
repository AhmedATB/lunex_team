import type { Team, TeamRole, User, CustomRole } from "@/lib/types";

/**
 * The leader/assistant-leader/global-admin check is duplicated identically across
 * team-dashboard-link.tsx, series-admin-controls.tsx, chapter-list.tsx, and the team
 * dashboard page. Centralized here so every "can this person manage this team's stuff"
 * check stays in sync — a fix in one no longer risks drifting from the other three.
 */
export function getTeamAuthRoles(
  team: Pick<Team, "id" | "leaderId"> | undefined,
  currentUser: Pick<User, "id" | "role" | "teamId" | "teamRole"> | undefined,
  memberRoleOverrides: Record<string, { teamRole?: TeamRole; customRoleId?: string }>
) {
  const isGlobalAdmin = currentUser?.role === "owner" || currentUser?.role === "super_administrator";
  const isMember = Boolean(team && currentUser?.teamId === team.id);
  const isLeader = Boolean(team && currentUser?.id === team.leaderId);
  const effectiveTeamRole = currentUser
    ? memberRoleOverrides[currentUser.id]?.teamRole ?? currentUser.teamRole
    : undefined;
  const isAssistantLeader = isMember && effectiveTeamRole === "assistant_leader";
  return { isGlobalAdmin, isMember, isLeader, isAssistantLeader };
}

/** Merges added/removed/edited custom roles for one team — the same logic the dashboard uses to list them. */
export function getEffectiveCustomRoles(
  teamId: string,
  dbCustomRoles: CustomRole[],
  addedCustomRoles: CustomRole[],
  customRoleOverrides: Record<string, Partial<Pick<CustomRole, "nameAr" | "name" | "color" | "permissions">>>,
  removedCustomRoleIds: string[]
): CustomRole[] {
  const removed = new Set(removedCustomRoleIds);
  return [
    ...dbCustomRoles.filter((r) => r.teamId === teamId),
    ...addedCustomRoles.filter((r) => r.teamId === teamId),
  ]
    .filter((r) => !removed.has(r.id))
    .map((r) => ({ ...r, ...customRoleOverrides[r.id] }));
}
