/**
 * Role facts the backend needs to enforce on its own. Mirrors the frontend's
 * rbac.ts on purpose rather than importing it (the two apps share no types
 * package yet — see architecture doc §19), so a role added there has to be
 * ranked here too; an unknown role ranks 0, the safe direction.
 */
export const ROLE_RANK: Record<string, number> = {
  guest: 0,
  reader: 0,
  verified_member: 10,
  uploader: 20,
  news_manager: 30,
  support: 40,
  editor: 40,
  global_team_manager: 40,
  moderator: 60,
  super_administrator: 90,
  owner: 100,
};

export const rankOf = (role: string): number => ROLE_RANK[role] ?? 0;

/**
 * Staff who moderate members: they can see profile sections a member has
 * hidden (needed to investigate a report) and issue warnings and timeouts.
 * Banning stays with the narrower ROLE_MANAGER_ROLES set in UsersService.
 */
export const MODERATOR_ROLES: ReadonlySet<string> = new Set(["owner", "super_administrator", "moderator"]);

/** May ban and unban. Same set as UsersService's role/ban managers (the frontend's `manage_users` permission). */
export const BAN_ROLES: ReadonlySet<string> = new Set(["owner", "super_administrator"]);
