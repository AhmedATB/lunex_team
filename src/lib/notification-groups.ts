import type { AppNotification } from "@/lib/notification-types";

export interface NotificationGroup {
  key: string;
  label: string;
  items: AppNotification[];
}

const DAY = 86_400_000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Which period a notification belongs to, by whole calendar days ago: today, yesterday, this week, last week, this month, older. */
function periodOf(createdAt: string, now: Date): { key: string; label: string } {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(createdAt))) / DAY);
  if (days <= 0) return { key: "today", label: "اليوم" };
  if (days === 1) return { key: "yesterday", label: "أمس" };
  if (days <= 6) return { key: "week", label: "هذا الأسبوع" };
  if (days <= 13) return { key: "last-week", label: "الأسبوع الماضي" };
  if (days <= 30) return { key: "month", label: "هذا الشهر" };
  return { key: "older", label: "أقدم" };
}

/** Newest-first notifications cut into labelled periods, in the order they appear (a period with nothing in it is left out). */
export function groupByPeriod(items: readonly AppNotification[], now: Date = new Date()): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const item of items) {
    const { key, label } = periodOf(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label, items: [item] });
  }
  return groups;
}
