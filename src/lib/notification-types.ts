export interface AppNotification {
  id: string;
  /** "chapter" | "series" | "news" | "coins" | "team" | "moderation" | ... */
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  /** How many events this one row stands for (several new chapters of one series fold into one). */
  count?: number;
  read: boolean;
  createdAt: string;
}

export type NotificationCategory = "chapters" | "series" | "news" | "other";

export const NOTIFICATION_TABS: { value: NotificationCategory | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "chapters", label: "الفصول الجديدة" },
  { value: "series", label: "سلاسل جديدة" },
  { value: "news", label: "الأخبار" },
  { value: "other", label: "أخرى" },
];
