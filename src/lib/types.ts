export type SeriesStatus = "ongoing" | "completed" | "hiatus" | "dropped";
export type SeriesType = "manhwa" | "manga" | "manhua" | "novel";

export type TeamPermission =
  | "edit_team_info"
  | "change_logo"
  | "change_banner"
  | "manage_members"
  | "manage_roles"
  | "manage_permissions"
  | "add_series"
  | "edit_series"
  | "assign_workers"
  | "archive_series"
  | "upload_chapter"
  | "edit_chapter"
  | "delete_chapter"
  | "publish_chapter"
  | "schedule_release"
  | "invite_members"
  | "remove_members"
  | "promote_members"
  | "demote_members"
  | "view_team_statistics"
  | "view_member_performance";

export interface Genre {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  logoHue: number;
  color: string;
  logoUrl?: string;
  description: string;
  leaderId: string;
  memberIds: string[];
  discordUrl?: string;
  websiteUrl?: string;
  rank: number;
  recruiting: boolean;
  createdAt: string;
  category: TeamCategory;
  goals: string;
  status: "active" | "suspended" | "archived";
  lastActivityAt: string;
}

export type TeamCategory = "manhwa" | "manhua" | "manga" | "novel" | "mixed";

export interface TeamCreationRequest {
  id: string;
  requesterId: string;
  teamName: string;
  logoSeed: string;
  bannerSeed: string;
  logoUrl?: string;
  color?: string;
  description: string;
  goals: string;
  discordUrl: string;
  requiredPositions: TeamRole[];
  category: TeamCategory;
  expectedMembers: number;
  previousExperience: string;
  portfolioUrl?: string;
  status: "pending" | "approved" | "rejected" | "needs_modification" | "suspended" | "archived";
  reviewerNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  createdTeamId?: string;
}

export interface CustomRole {
  id: string;
  teamId: string;
  name: string;
  nameAr: string;
  color: string;
  permissions: TeamPermission[];
  isDefault: boolean;
  createdAt: string;
}

export type DepartmentKind =
  | "translation"
  | "editing"
  | "proofreading"
  | "quality_control"
  | "publishing"
  | "media"
  | "recruitment";

export interface Department {
  id: string;
  teamId: string;
  kind: DepartmentKind;
  name: string;
  nameAr: string;
  leaderId?: string;
  memberIds: string[];
}

export type SeriesProductionRole = "translator" | "editor" | "proofreader" | "qc" | "publisher";

export interface SeriesAssignment {
  id: string;
  seriesId: string;
  userId: string;
  role: SeriesProductionRole;
  assignedAt: string;
  assignedBy: string;
}

export interface TeamActivityLogEntry {
  id: string;
  teamId: string;
  userId: string;
  action: string;
  target?: string;
  previousValue?: string;
  newValue?: string;
  at: string;
}

export interface RecruitmentPosition {
  id: string;
  teamId: string;
  role: TeamRole;
  isOpen: boolean;
  description: string;
  createdAt: string;
}

export interface RecruitmentApplication {
  id: string;
  teamId: string;
  positionId: string;
  userId: string;
  preferredRole: TeamRole;
  experience: string;
  portfolioUrl?: string;
  languages: string[];
  availability: string;
  status: "pending" | "accepted" | "rejected" | "interview" | "waitlist";
  note?: string;
  appliedAt: string;
}

export type CollaborationType =
  | "need_translator"
  | "need_editor"
  | "need_proofreader"
  | "need_qc"
  | "need_publisher"
  | "need_complete_team_support"
  | "emergency_assistance";

export interface CollaborationRequest {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  seriesId: string;
  type: CollaborationType;
  message: string;
  status: "pending" | "accepted" | "rejected" | "negotiating";
  createdAt: string;
}

export interface TeamTransferRequest {
  id: string;
  userId: string;
  fromTeamId: string;
  toTeamId: string;
  reason: string;
  status: "pending" | "current_team_approved" | "new_team_approved" | "approved" | "rejected";
  createdAt: string;
}

export interface LeadershipTransferEntry {
  id: string;
  teamId: string;
  fromUserId: string;
  toUserId: string;
  reason: string;
  at: string;
}

export type GlobalRole =
  | "guest"
  | "reader"
  | "verified_member"
  | "uploader"
  | "moderator"
  | "support"
  | "news_manager"
  | "editor"
  | "global_team_manager"
  | "super_administrator"
  | "owner";

export type TeamRole =
  | "trainee"
  | "member"
  | "translator"
  | "editor"
  | "proofreader"
  | "qc"
  | "publisher"
  | "uploader"
  | "recruiter"
  | "reviewer"
  | "team_administrator"
  | "assistant_leader"
  | "team_leader";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  email: string;
  role: GlobalRole;
  teamId?: string;
  teamRole?: TeamRole;
  customRoleId?: string;
  level: number;
  xp: number;
  xpToNext: number;
  joinedAt: string;
  bio: string;
  isOnline: boolean;
  readCount: number;
  commentCount: number;
  bookmarkCount: number;
  badges: string[];
}

export interface Chapter {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  pages: number;
  releasedAt: string;
  views: number;
  isPublished: boolean;
  scheduledFor?: string;
  teamId: string;
}

export interface Series {
  id: string;
  slug: string;
  title: string;
  titleAr: string;
  alternativeTitles: string[];
  cover: string;
  banner: string;
  synopsis: string;
  type: SeriesType;
  status: SeriesStatus;
  country: "kr" | "jp" | "cn";
  author: string;
  artist: string;
  year: number;
  rating: number;
  ratingCount: number;
  views: number;
  bookmarks: number;
  likes: number;
  genreIds: string[];
  tags: string[];
  teamId: string;
  chapterCount: number;
  latestChapterNumber: number;
  updatedAt: string;
  isFeatured: boolean;
  isRecommended: boolean;
}

export interface Comment {
  id: string;
  seriesId: string;
  chapterId?: string;
  userId: string;
  parentId?: string;
  content: string;
  likes: number;
  dislikes: number;
  createdAt: string;
  isPinned: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  cover: string;
  category: "announcement" | "event" | "news";
  createdAt: string;
  authorId: string;
}

export interface KanbanTask {
  id: string;
  seriesId: string;
  chapterNumber: number;
  stage:
    | "pending"
    | "assigned"
    | "in_progress"
    | "review"
    | "qc"
    | "ready_to_publish"
    | "published"
    | "cancelled";
  assigneeId?: string;
  priority: "low" | "medium" | "high" | "urgent";
  deadline?: string;
  teamId: string;
}
