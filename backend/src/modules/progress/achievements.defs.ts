export type AchievementMetric = "chaptersRead" | "comments" | "bookmarks" | "streak" | "level";

export interface AchievementDef {
  id: string;
  metric: AchievementMetric;
  target: number;
}

/**
 * The achievements and what earns them. Titles, descriptions and icons live in the frontend (src/lib/achievements.ts),
 * keyed by these ids; the server decides what is earned, so it is the same on every device and cannot be edited from the
 * browser. Once earned, an id is stored on the account and stays earned.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_chapter", metric: "chaptersRead", target: 1 },
  { id: "reader_10", metric: "chaptersRead", target: 10 },
  { id: "reader_50", metric: "chaptersRead", target: 50 },
  { id: "reader_200", metric: "chaptersRead", target: 200 },
  { id: "first_comment", metric: "comments", target: 1 },
  { id: "commentator_10", metric: "comments", target: 10 },
  { id: "collector_5", metric: "bookmarks", target: 5 },
  { id: "collector_20", metric: "bookmarks", target: 20 },
  { id: "streak_3", metric: "streak", target: 3 },
  { id: "streak_7", metric: "streak", target: 7 },
  { id: "streak_30", metric: "streak", target: 30 },
  { id: "level_5", metric: "level", target: 5 },
  { id: "level_10", metric: "level", target: 10 },
];

export type AchievementValues = Record<AchievementMetric, number>;

/** The ids whose target is met by `values` — including any already earned, which the caller merges. */
export function metAchievements(values: AchievementValues): string[] {
  return ACHIEVEMENTS.filter((def) => values[def.metric] >= def.target).map((def) => def.id);
}
