"use client";

import { useEffect } from "react";
import { useSession } from "@/store/session";
import { useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";

const REFRESH_EVERY_MS = 60_000;

/**
 * Headless — mounted once in AppShell. Keeps the signed-in reader's server-side progression (experience, level,
 * streak, achievements) and wallet (coins, reading credits, opened chapters) loaded, and looks again when the tab comes back and once a minute, so what a comment or a
 * rating earned shows up (and is announced) without a reload. The numbers are the server's; nothing is tracked here.
 */
export function ProgressWatcher() {
  const currentUserId = useSession((s) => s.currentUserId);

  useEffect(() => {
    const { refresh, reset } = useProgress.getState();
    if (!currentUserId) {
      reset();
      useWallet.getState().reset();
      return;
    }
    void refresh();
    void useWallet.getState().refresh();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void useProgress.getState().refresh();
      void useWallet.getState().refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, REFRESH_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [currentUserId]);

  return null;
}
