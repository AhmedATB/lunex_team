/**
 * The site's real team controls, from the browser: everything here goes through the catalogue's BFF door to the backend,
 * which decides against the account's current role who may do it. (The team dashboard's older buttons only change a
 * copy kept in the visitor's own browser; these are the ones that change the site for everybody.)
 */

import { call, callForm, type ApiResult } from "@/lib/api-call";

export type { ApiResult };

export interface TeamPatch {
  name?: string;
  description?: string;
  goals?: string;
  color?: string;
  category?: string;
  discordUrl?: string | null;
  websiteUrl?: string | null;
  recruiting?: boolean;
  status?: "active" | "suspended" | "archived";
  /** Empty string clears the leader. */
  leaderUsername?: string;
  /** The team's own Discord webhook for a new chapter (its own server); empty string clears it. Independent of `discordSeriesWebhookUrl`. Kept out of every other read — see {@link teamApi.getDiscordSettings}. */
  discordChapterWebhookUrl?: string;
  /** Same, for when this team's series is listed as a new work. */
  discordSeriesWebhookUrl?: string;
  /** The role to ping on the team's own server, for either webhook above; empty string clears it. Only has an effect together with at least one of them. */
  discordRoleId?: string;
}

export interface TeamDiscordSettings {
  discordChapterWebhookUrl: string | null;
  discordSeriesWebhookUrl: string | null;
  discordRoleId: string | null;
}

/** Roles a member can be given here. The leader is set through `leaderUsername`, not as a member role. */
export const MEMBER_ROLES = [
  "trainee",
  "member",
  "translator",
  "editor",
  "proofreader",
  "qc",
  "publisher",
  "uploader",
  "recruiter",
  "reviewer",
  "team_administrator",
  "assistant_leader",
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export interface TeamMemberInfo {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  avatarVersion?: string | null;
  teamRole?: string;
}

export interface TeamDetail {
  team: { id: string; slug: string; leaderId: string };
  members: TeamMemberInfo[];
}

const enc = encodeURIComponent;

export const teamApi = {
  /** Team details with each member's role. */
  detail: (slug: string) => call<TeamDetail>(`/api/catalog/teams/${enc(slug)}`, "GET"),

  create: (input: { name: string; description?: string; leaderUsername?: string }) => call<{ id: string; slug: string }>("/api/catalog/teams", "POST", input),

  update: (teamId: string, patch: TeamPatch) => call<unknown>(`/api/catalog/teams/${enc(teamId)}`, "PATCH", patch),

  /** The team's own Discord webhook and role, for the team's leader or a site manager — not part of the team's public data, so it is read separately. */
  getDiscordSettings: (teamId: string) => call<TeamDiscordSettings>(`/api/catalog/teams/${enc(teamId)}/discord`, "GET"),

  remove: (teamId: string) => call<void>(`/api/catalog/teams/${enc(teamId)}`, "DELETE"),

  /** The team's logo, chosen from the device: the server crops it to a square and turns it into WebP. */
  setLogo: (teamId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return callForm<unknown>(`/api/catalog/teams/${enc(teamId)}/logo`, form);
  },

  /** Adds an account by username, with no recruitment post; a member already on the team just gets the new role. */
  addMember: (teamId: string, username: string, role: MemberRole) => call<{ userId: string }>(`/api/catalog/teams/${enc(teamId)}/members`, "POST", { username, role }),

  setMemberRole: (teamId: string, userId: string, role: MemberRole) => call<void>(`/api/catalog/teams/${enc(teamId)}/members/${enc(userId)}`, "PUT", { role }),

  removeMember: (teamId: string, userId: string) => call<void>(`/api/catalog/teams/${enc(teamId)}/members/${enc(userId)}`, "DELETE"),

  /** Moves works (and their chapters) to a team; an empty `teamId` takes them off every team. */
  transferSeries: (seriesIds: string[], teamId: string) => call<{ series: number; chapters: number }>("/api/catalog/series/transfer", "POST", { seriesIds, teamId }),
};
