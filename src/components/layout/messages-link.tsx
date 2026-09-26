"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatApi, MESSAGES_CHANGED } from "@/lib/messages-api";

const POLL_MS = 30_000;

/** The header's messages icon, with a number when chats have messages the member has not read. Asked for like the bell's. */
export function MessagesLink() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const result = await chatApi.unread();
    if (result.ok) setUnread(result.body.unreadMessages);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(MESSAGES_CHANGED, onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(MESSAGES_CHANGED, onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link href="/messages" aria-label={unread > 0 ? `الرسائل، ${unread} غير مقروءة` : "الرسائل"}>
        <MessageCircle className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full border border-black bg-primary-400 px-1 text-[10px] font-bold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
