/** The words of the notifications the site itself writes (a member's own language, in one place). */

export const NOTIFICATION_TYPES = {
  chapter: "chapter",
  series: "series",
  news: "news",
  coins: "coins",
  team: "team",
} as const;

/** What the notifications page groups by: the three kinds readers follow, and everything else. */
export const NOTIFICATION_CATEGORIES = ["chapters", "series", "news", "other"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const FOLLOWED_TYPES = [NOTIFICATION_TYPES.chapter, NOTIFICATION_TYPES.series, NOTIFICATION_TYPES.news] as const;

/** "Chapter 14 is out", or, when several came since the last time it was read, how many and which is the newest. */
export function chapterBody(count: number, latest: string): string {
  if (count <= 1) return `صدر الفصل ${latest}`;
  if (count === 2) return `صدر فصلان جديدان — آخرها الفصل ${latest}`;
  if (count <= 10) return `صدرت ${count} فصول جديدة — آخرها الفصل ${latest}`;
  return `صدر ${count} فصلًا جديدًا — آخرها الفصل ${latest}`;
}

export const chapterTitle = (seriesTitle: string) => `فصل جديد من ${seriesTitle}`;
export const seriesTitle = (title: string) => `سلسلة جديدة: ${title}`;
export const newsTitle = (title: string) => `خبر جديد: ${title}`;

export function coinsBody(amount: number, note?: string | null): string {
  const base = amount === 1 ? "تم تحويل عملة واحدة إلى حسابك." : amount === 2 ? "تم تحويل عملتين إلى حسابك." : `تم تحويل ${amount} عملة إلى حسابك.`;
  return note?.trim() ? `${base} (${note.trim()})` : base;
}
