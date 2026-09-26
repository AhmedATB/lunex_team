import { call } from "@/lib/api-call";

export const RECRUIT_ROLES = ["translator", "editor", "proofreader", "qc", "publisher", "uploader", "recruiter", "reviewer"] as const;
export type RecruitRole = (typeof RECRUIT_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  translator: "مترجم",
  editor: "محرر",
  proofreader: "مدقق لغوي",
  qc: "مراقب جودة",
  publisher: "ناشر",
  uploader: "رافع",
  recruiter: "مسؤول توظيف",
  reviewer: "مراجع",
};

export type ApplicationStatus = "pending" | "accepted" | "rejected" | "interview" | "waitlist";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "قيد المراجعة",
  accepted: "مقبول",
  rejected: "مرفوض",
  interview: "مقابلة",
  waitlist: "قائمة انتظار",
};

export interface Position {
  id: string;
  teamId: string;
  role: string;
  description: string;
  isOpen: boolean;
  createdAt: string;
}

export interface Application {
  id: string;
  teamId: string;
  positionId: string;
  userId: string;
  preferredRole: string;
  experience: string;
  portfolioUrl?: string;
  languages: string[];
  availability: string;
  status: ApplicationStatus;
  note?: string;
  appliedAt: string;
}

export interface TeamApplication extends Application {
  applicant: { id: string; username: string; displayName: string; avatarSeed: string; avatarVersion: string | null };
}

export interface MyApplication extends Application {
  team: { id: string; name: string; slug: string };
}

export interface ApplyInput {
  positionId?: string;
  preferredRole: string;
  experience: string;
  portfolioUrl?: string;
  languages: string[];
  availability: string;
}

const enc = encodeURIComponent;

/** Team recruitment, from the browser: everything is kept on the server, so a leader sees what members send. */
export const recruitmentApi = {
  /** Open positions (public); a team's leaders can ask for the closed ones too. */
  positions: (teamId: string, all = false) => call<Position[]>(`/api/recruitment/teams/${enc(teamId)}/positions${all ? "?all=true" : ""}`, "GET"),
  createPosition: (teamId: string, role: string, description: string) => call<Position>(`/api/recruitment/teams/${enc(teamId)}/positions`, "POST", { role, description }),
  setOpen: (positionId: string, isOpen: boolean) => call<Position>(`/api/recruitment/positions/${enc(positionId)}`, "PATCH", { isOpen }),
  removePosition: (positionId: string) => call<void>(`/api/recruitment/positions/${enc(positionId)}`, "DELETE"),

  apply: (teamId: string, input: ApplyInput) => call<Application>(`/api/recruitment/teams/${enc(teamId)}/applications`, "POST", input),
  mine: () => call<{ items: MyApplication[] }>("/api/recruitment/me/applications", "GET"),
  withdraw: (applicationId: string) => call<void>(`/api/recruitment/applications/${enc(applicationId)}`, "DELETE"),

  teamApplications: (teamId: string) => call<{ items: TeamApplication[] }>(`/api/recruitment/teams/${enc(teamId)}/applications`, "GET"),
  review: (applicationId: string, decision: { status: Exclude<ApplicationStatus, "pending">; role?: string; note?: string }) =>
    call<Application>(`/api/recruitment/applications/${enc(applicationId)}`, "PATCH", decision),
};
