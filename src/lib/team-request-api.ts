import { call } from "@/lib/api-call";

export type TeamRequestStatus = "pending" | "needs_modification" | "approved" | "rejected" | "suspended" | "archived";

export const REQUEST_STATUS_LABELS: Record<TeamRequestStatus, string> = {
  pending: "قيد المراجعة",
  needs_modification: "يحتاج تعديلًا",
  approved: "مقبول",
  rejected: "مرفوض",
  suspended: "معلّق",
  archived: "مؤرشف",
};

export const REQUEST_STATUS_VARIANT: Record<TeamRequestStatus, "success" | "secondary" | "warning" | "destructive"> = {
  pending: "warning",
  needs_modification: "warning",
  approved: "success",
  rejected: "destructive",
  suspended: "secondary",
  archived: "secondary",
};

export interface TeamRequest {
  id: string;
  requesterId: string;
  requester: { username: string; displayName: string };
  teamName: string;
  description: string;
  goals: string;
  discordUrl: string;
  requiredPositions: string[];
  category: string;
  expectedMembers: number;
  previousExperience: string;
  portfolioUrl?: string;
  logoUrl?: string;
  color?: string;
  status: TeamRequestStatus;
  reviewerNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  createdTeamId?: string;
}

export interface TeamRequestInput {
  teamName: string;
  description: string;
  goals: string;
  discordUrl?: string;
  requiredPositions: string[];
  category: string;
  expectedMembers: number;
  previousExperience?: string;
  portfolioUrl?: string;
  logoUrl?: string;
  color?: string;
}

/** Requests to open a team, kept on the server: a member sends and follows theirs, the site's team managers decide. */
export const teamRequestApi = {
  create: (input: TeamRequestInput) => call<TeamRequest>("/api/team-requests", "POST", input),

  mine: () => call<{ items: TeamRequest[] }>("/api/team-requests/me", "GET"),

  /** Every request, newest first (team managers only); `status` narrows it. */
  list: (status?: TeamRequestStatus) => call<{ items: TeamRequest[] }>(`/api/team-requests${status ? `?status=${status}` : ""}`, "GET"),

  /** The changes a manager asked for; the request goes back to waiting. */
  resubmit: (id: string, input: TeamRequestInput) => call<TeamRequest>(`/api/team-requests/${encodeURIComponent(id)}`, "PUT", input),

  review: (id: string, status: Exclude<TeamRequestStatus, "pending">, note?: string) =>
    call<TeamRequest>(`/api/team-requests/${encodeURIComponent(id)}/review`, "PATCH", { status, ...(note?.trim() ? { note: note.trim() } : {}) }),
};
