import type { LucideIcon } from "lucide-react";
import { BookOpen, BookOpenCheck, Crown, MessageSquare, Bookmark, Flame } from "lucide-react";

export type AchievementMetric = "chaptersRead" | "comments" | "bookmarks" | "streak";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  metric: AchievementMetric;
  target: number;
}

/** Every metric here is derived from data the app already tracks client-side (reading progress, authored comments, bookmarks) — no server-side content model exists yet to key achievements off of real chapter/series data. */
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
];
