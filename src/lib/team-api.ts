/**
 * The site's real team controls, from the browser: everything here goes through the catalogue's BFF door to the backend,
 * which decides against the account's current role who may do it. (The team dashboard's older buttons only change a
 * copy kept in the visitor's own browser; these are the ones that change the site for everybody.)
 */

export type ApiResult<T> = { ok: true; body: T } | { ok: false; message: string; status: number };

const MESSAGES: Record<string, string> = {
  user_not_found: "لا يوجد حساب بهذا الاسم.",
  team_not_found: "هذا الفريق غير موجود.",
  series_not_found: "بعض هذه الأعمال لم تعد موجودة.",
  global_editor_only: "نقل الأعمال بين الفرق للمالك والمحررين فقط.",
  global_manager_only: "حالة الفريق وقائده يغيّرها مدير الفرق أو المالك فقط.",
  insufficient_permissions: "لا تملك صلاحية لهذا الإجراء.",
  account_banned: "هذا الحساب محظور.",
  tag_exists: "هذا الاسم موجود مسبقاً.",
};

function messageFor(body: unknown): string {
  const code = (body as { code?: string } | null)?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message) && message.length > 0) return `بيانات غير صالحة: ${message[0]}`;
  return "فشلت العملية.";
}

async function call<T>(path: string, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      cache: "no-store",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (res.status === 204) return { ok: true, body: undefined as T };
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, message: messageFor(json) };
    return { ok: true, body: json as T };
  } catch {
    return { ok: false, status: 0, message: "تعذر الاتصال بالخادم." };
  }
}

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
}

/** Roles a member can be given here. The leader is set through `leaderUsername`, not as a member role. */
export const MEMBER_ROLES = [
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

  remove: (teamId: string) => call<void>(`/api/catalog/teams/${enc(teamId)}`, "DELETE"),

  /** Adds an account by username, with no recruitment post; a member already on the team just gets the new role. */
  addMember: (teamId: string, username: string, role: MemberRole) => call<{ userId: string }>(`/api/catalog/teams/${enc(teamId)}/members`, "POST", { username, role }),

  setMemberRole: (teamId: string, userId: string, role: MemberRole) => call<void>(`/api/catalog/teams/${enc(teamId)}/members/${enc(userId)}`, "PUT", { role }),

  removeMember: (teamId: string, userId: string) => call<void>(`/api/catalog/teams/${enc(teamId)}/members/${enc(userId)}`, "DELETE"),

  /** Moves works (and their chapters) to a team; an empty `teamId` takes them off every team. */
  transferSeries: (seriesIds: string[], teamId: string) => call<{ series: number; chapters: number }>("/api/catalog/series/transfer", "POST", { seriesIds, teamId }),
};
