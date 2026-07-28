export type SeriesStatus = "ongoing" | "completed" | "hiatus" | "dropped";
export type SeriesType = "manhwa" | "manga" | "manhua" | "novel";

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
  description: string;
  leaderId: string;
  memberIds: string[];
  discordUrl?: string;
  websiteUrl?: string;
  rank: number;
  recruiting: boolean;
  createdAt: string;
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
  | "proofreader"
  | "cleaner"
  | "redrawer"
  | "typesetter"
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
