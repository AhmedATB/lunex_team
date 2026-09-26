import { call } from "@/lib/api-call";

export type CollaborationType =
  | "need_translator"
  | "need_editor"
  | "need_proofreader"
  | "need_qc"
  | "need_publisher"
  | "need_complete_team_support"
  | "emergency_assistance";

export type CollaborationStatus = "pending" | "negotiating" | "accepted" | "rejected";

export const COLLABORATION_TYPE_LABELS: Record<CollaborationType, string> = {
  need_translator: "بحاجة مترجم",
  need_editor: "بحاجة محرر",
  need_proofreader: "بحاجة مدقق لغوي",
  need_qc: "بحاجة مراقب جودة",
  need_publisher: "بحاجة ناشر",
  need_complete_team_support: "بحاجة دعم فريق كامل",
  emergency_assistance: "مساعدة طارئة",
};

export const COLLABORATION_STATUS_LABELS: Record<CollaborationStatus, string> = {
  pending: "قيد الانتظار",
  negotiating: "تفاوض",
  accepted: "مقبول",
  rejected: "مرفوض",
};

export interface TeamRef {
  id: string;
  name: string;
  slug: string;
}

export interface CollaborationRequest {
  id: string;
  fromTeam: TeamRef;
  toTeam: TeamRef;
  series: { id: string; slug: string; titleAr: string };
  type: CollaborationType;
  message: string;
  status: CollaborationStatus;
  createdAt: string;
  respondedAt?: string;
}

export interface ActivityEntry {
  id: string;
  text: string;
  at: string;
}

/** Teams asking each other for help, and what a team's leaders can look back on: both kept on the site. */
export const collaborationApi = {
  create: (input: { fromTeamId: string; toTeamId: string; seriesId: string; type: CollaborationType; message: string }) =>
    call<CollaborationRequest>("/api/collaboration", "POST", input),

  forTeam: (teamId: string) => call<{ incoming: CollaborationRequest[]; outgoing: CollaborationRequest[] }>(`/api/collaboration/teams/${encodeURIComponent(teamId)}`, "GET"),

  respond: (id: string, status: Exclude<CollaborationStatus, "pending">, note?: string) =>
    call<CollaborationRequest>(`/api/collaboration/${encodeURIComponent(id)}`, "PATCH", { status, ...(note?.trim() ? { note: note.trim() } : {}) }),

  /** Ends a team's work on a series it does not own. */
  endCollaboration: (seriesId: string, teamId: string) => call<void>(`/api/collaboration/series/${encodeURIComponent(seriesId)}/teams/${encodeURIComponent(teamId)}`, "DELETE"),
};

export const teamActivityApi = {
  list: (teamId: string) => call<{ items: ActivityEntry[] }>(`/api/team-activity/${encodeURIComponent(teamId)}`, "GET"),
};
