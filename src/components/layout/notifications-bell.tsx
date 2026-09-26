"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

const POLL_MS = 60_000;

/**
 * The bell takes the member to their notifications page and carries the number of unread ones. The number is asked for
 * on load, every minute while the tab is showing, and when the tab comes back; the page itself tells the bell (through
 * a window event) when something was read there.
 */
export const NOTIFICATIONS_CHANGED = "lunex:notifications-changed";

export function NotificationsBell({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!loggedIn || document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (res.ok) setUnread(((await res.json()) as { unreadCount?: number }).unreadCount ?? 0);
    } catch {
      /* the badge simply keeps its last number */
    }
  }, [loggedIn]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED, onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onVisible);
    };
  }, [refresh]);

  // Moving between pages is a good moment to look again (something may have been read or arrived).
  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  if (!loggedIn) return null;

  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link href="/notifications" aria-label={unread > 0 ? `الإشعارات، ${unread} غير مقروء` : "الإشعارات"}>
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full border border-black bg-amber-400 px-1 text-[10px] font-bold leading-4 text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
