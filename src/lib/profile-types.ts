export const PROFILE_VISIBILITY_LEVELS = ["public", "members", "private"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITY_LEVELS)[number];

export const VISIBILITY_LABELS: Record<ProfileVisibility, string> = {
  public: "الجميع",
  members: "الأعضاء المسجلون فقط",
  private: "أنا فقط",
};

/** The three sections an account owner controls — same keys as the backend's User columns. */
export interface PrivacySettings {
  profileVisibility: ProfileVisibility;
  historyVisibility: ProfileVisibility;
  favoritesVisibility: ProfileVisibility;
}

/** Level, experience, streak and earned achievements — sent only to viewers who may see the owner's reading history. */
export interface PublicProgress {
  xp: number;
  level: number;
  xpIntoLevel: number;
  levelSpan: number;
  xpToNext: number;
  streak: number;
  bestStreak: number;
  chaptersRead: number;
  achievements: string[];
}

/** GET /v1/profiles/:username — what the viewer is allowed to see. Hidden sections are absent, never empty. */
export interface ServerProfile {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarVersion: string | null;
  isSelf: boolean;
  /** true = the owner hid the page; only the identity above is present. */
  restricted: boolean;
  access: { profile: boolean; history: boolean; favorites: boolean };
  bio?: string;
  createdAt?: string;
  /** Only sent to the owner and staff. */
  visibility?: { profile: ProfileVisibility; history: ProfileVisibility; favorites: ProfileVisibility };
  bookmarks?: string[];
  progress?: PublicProgress;
  history?: { seriesId: string; chapterNumber: number; lastReadAt: string }[];
}
