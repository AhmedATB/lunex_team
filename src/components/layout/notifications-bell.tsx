"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { timeAgo, cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/notification-types";

export function NotificationsBell({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!loggedIn) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const body = await res.json();
        setItems(body.items ?? []);
        setUnreadCount(body.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [loggedIn]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
  }

  async function markAllRead() {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "PATCH" });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="الإشعارات" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full border border-black bg-amber-400" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-80 overflow-y-auto p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-sm font-bold text-white">الإشعارات</p>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-primary-300 hover:text-primary-200"
            >
              <CheckCheck className="h-3.5 w-3.5" /> تحديد الكل كمقروء
            </button>
          )}
        </div>

        {!loggedIn ? (
          <p className="p-6 text-center text-sm text-lunex-gray">سجّل الدخول لرؤية إشعاراتك.</p>
        ) : loading && !loaded ? (
          <p className="p-6 text-center text-sm text-lunex-gray">جارِ التحميل...</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-lunex-gray">لا توجد إشعارات حتى الآن.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((n) => {
              const inner = (
                <div
                  className={cn(
                    "flex gap-2 p-3 text-start transition-colors hover:bg-white/5",
                    !n.read && "bg-primary-500/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-primary-400"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-lunex-gray">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-lunex-gray/70">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => !n.read && markRead(n.id)} className="block">
                  {inner}
                </Link>
              ) : (
                <button key={n.id} onClick={() => !n.read && markRead(n.id)} className="block w-full">
                  {inner}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
