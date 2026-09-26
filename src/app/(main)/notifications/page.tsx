"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BookOpen, CheckCheck, Coins, Loader2, Newspaper, ShieldAlert, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NOTIFICATIONS_CHANGED } from "@/components/layout/notifications-bell";
import { groupByPeriod } from "@/lib/notification-groups";
import { NOTIFICATION_TABS, type AppNotification, type NotificationCategory } from "@/lib/notification-types";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";

const PAGE = 30;

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  chapter: { icon: BookOpen, tone: "bg-primary-500/15 text-primary-300" },
  series: { icon: Sparkles, tone: "bg-emerald-500/15 text-emerald-300" },
  news: { icon: Newspaper, tone: "bg-sky-500/15 text-sky-300" },
  coins: { icon: Coins, tone: "bg-amber-500/15 text-amber-300" },
  team: { icon: Users, tone: "bg-fuchsia-500/15 text-fuchsia-300" },
  moderation: { icon: ShieldAlert, tone: "bg-red-500/15 text-red-300" },
};

interface Page {
  items: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
}

/** A member's notifications: everything, or one kind at a time (new chapters, new series, news, the rest), cut into periods. */
export default function NotificationsPage() {
  useEffect(() => {
    document.title = "الإشعارات | LUNEX TEAM";
  }, []);

  const [tab, setTab] = useState<NotificationCategory | "all">("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPage = useCallback(async (category: NotificationCategory | "all", before?: string): Promise<Page | null> => {
    const params = new URLSearchParams({ limit: String(PAGE) });
    if (category !== "all") params.set("category", category);
    if (before) params.set("before", before);
    try {
      const res = await fetch(`/api/notifications?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as Page;
    } catch {
      setError("تعذر تحميل الإشعارات.");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchPage(tab).then((page) => {
      if (cancelled) return;
      if (page) {
        setItems(page.items);
        setHasMore(page.hasMore);
        setUnread(page.unreadCount);
      } else {
        setItems([]);
        setHasMore(false);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, fetchPage]);

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last || loading) return;
    setLoading(true);
    const page = await fetchPage(tab, last.createdAt);
    if (page) {
      setItems((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
      setUnread(page.unreadCount);
    }
    setLoading(false);
  }

  async function markRead(id: string) {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => null);
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  }

  async function markAllRead() {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/read-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tab === "all" ? {} : { category: tab }),
    }).catch(() => null);
    const page = await fetchPage(tab);
    if (page) setUnread(page.unreadCount);
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  }

  const groups = useMemo(() => groupByPeriod(items), [items]);
  const hasUnreadHere = items.some((n) => !n.read);

  return (
    <div className="container max-w-3xl space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">الإشعارات</h1>
          <p className="mt-1 text-sm text-lunex-gray">
            {unread > 0 ? `لديك ${unread} إشعار غير مقروء.` : "لا توجد إشعارات غير مقروءة."}
          </p>
        </div>
        {hasUnreadHere && (
          <Button variant="secondary" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> تحديد {tab === "all" ? "الكل" : "هذا القسم"} كمقروء
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="نوع الإشعارات" className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {NOTIFICATION_TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "border-primary-400 bg-primary-500/20 text-white" : "border-white/10 text-lunex-gray hover:bg-white/5 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-16 text-lunex-gray"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 && !error ? (
        <div className="panel flex flex-col items-center gap-2 p-12 text-center text-lunex-gray">
          <Bell className="h-8 w-8 opacity-60" />
          <p>لا توجد إشعارات هنا بعد.</p>
          <p className="text-xs">ستصلك هنا الفصول الجديدة للأعمال في مفضلتك، والسلاسل الجديدة، والأخبار.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label} className="space-y-2">
              <h2 className="text-xs font-semibold tracking-wide text-lunex-gray">{group.label}</h2>
              <ul className="space-y-2">
                {group.items.map((n) => (
                  <li key={n.id}>
                    <Row notification={n} onOpen={() => !n.read && markRead(n.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} عرض المزيد
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ notification: n, onOpen }: { notification: AppNotification; onOpen: () => void }) {
  const { icon: Icon, tone } = ICONS[n.type] ?? { icon: Bell, tone: "bg-white/10 text-lunex-gray" };
  const content = (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3.5 transition-colors hover:bg-white/[0.04]", n.read ? "border-white/5" : "border-primary-500/30 bg-primary-500/[0.06]")}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{n.title}</p>
        {n.body && <p className="mt-0.5 text-sm text-lunex-gray">{n.body}</p>}
        <p className="mt-1 text-[11px] text-lunex-gray/70">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" aria-label="غير مقروء" />}
    </div>
  );
  return n.link ? (
    <Link href={n.link} onClick={onOpen} className="block">
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className="block w-full text-start">
      {content}
    </button>
  );
}
