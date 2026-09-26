import type { LucideIcon } from "lucide-react";
import { BookOpen, BookOpenCheck, Crown, MessageSquare, Bookmark, Flame, Star, Trophy } from "lucide-react";

export type AchievementMetric = "chaptersRead" | "comments" | "bookmarks" | "streak" | "level";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  metric: AchievementMetric;
  target: number;
}

/**
 * How each achievement looks and what it asks for. The server decides which ones are earned (backend
 * modules/progress/achievements.defs.ts — keep the ids and targets in step); this list is the display side and the
 * progress bars' targets.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_chapter", title: "أول خطوة", description: "اقرأ أول فصل لك", icon: BookOpen, metric: "chaptersRead", target: 1 },
  { id: "reader_10", title: "قارئ نشيط", description: "اقرأ 10 فصول", icon: BookOpen, metric: "chaptersRead", target: 10 },
  { id: "reader_50", title: "قارئ محترف", description: "اقرأ 50 فصلاً", icon: BookOpenCheck, metric: "chaptersRead", target: 50 },
  { id: "reader_200", title: "أسطورة القراءة", description: "اقرأ 200 فصل", icon: Crown, metric: "chaptersRead", target: 200 },
  { id: "first_comment", title: "أول تعليق", description: "شارك أول تعليق لك", icon: MessageSquare, metric: "comments", target: 1 },
  { id: "commentator_10", title: "متفاعل", description: "اكتب 10 تعليقات", icon: MessageSquare, metric: "comments", target: 10 },
  { id: "collector_5", title: "جامع الأعمال", description: "أضف 5 أعمال للمفضلة", icon: Bookmark, metric: "bookmarks", target: 5 },
  { id: "collector_20", title: "خزانة الروايات", description: "أضف 20 عملاً للمفضلة", icon: Bookmark, metric: "bookmarks", target: 20 },
  { id: "streak_3", title: "بداية العادة", description: "اقرأ 3 أيام متتالية", icon: Flame, metric: "streak", target: 3 },
  { id: "streak_7", title: "أسبوع كامل", description: "اقرأ 7 أيام متتالية", icon: Flame, metric: "streak", target: 7 },
  { id: "streak_30", title: "شهر بلا انقطاع", description: "اقرأ 30 يوماً متتالياً", icon: Flame, metric: "streak", target: 30 },
  { id: "level_5", title: "قارئ متمرّس", description: "بلّغ المستوى 5", icon: Star, metric: "level", target: 5 },
  { id: "level_10", title: "نخبة القرّاء", description: "بلّغ المستوى 10", icon: Trophy, metric: "level", target: 10 },
];

export const ACHIEVEMENT_INFO: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
