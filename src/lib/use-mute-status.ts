"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/store/session";

const MAX_TIMER_MS = 2 ** 31 - 1;

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/**
 * Whether the signed-in account is in a timeout right now (an admin's
 * moderation action: no commenting or messaging until `until`). The end time
 * comes from the server-rendered session, and the hook re-renders the moment
 * it passes, so a composer re-enables itself without a page reload.
 *
 * This only shapes the UI. Comments are ALSO refused by the server while the
 * timeout runs, so bypassing the composer gets nothing; messages are still
 * device-local, so for them this notice is the whole enforcement until they
 * move server-side.
 */
export function useMuteStatus(): { muted: boolean; until: Date | null; message: string } {
  const mutedUntil = useSession((s) => s.user?.mutedUntil ?? null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!mutedUntil) return;
    const remaining = new Date(mutedUntil).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => tick((n) => n + 1), Math.min(remaining, MAX_TIMER_MS));
    return () => clearTimeout(timer);
  }, [mutedUntil]);

  const until = mutedUntil ? new Date(mutedUntil) : null;
  const muted = until !== null && until.getTime() > Date.now();
  return {
    muted,
    until: muted ? until : null,
    message: muted && until ? `أنت في تايم أوت من الإدارة، ولا يمكنك التعليق أو المراسلة حتى ${formatDateTime(until)}.` : "",
  };
}
