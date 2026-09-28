"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePush, pushPermission, pushSupport, reattachThisDevice } from "@/lib/push-client";
import { useSession } from "@/store/session";
import { useToast } from "@/store/toast";

const DISMISSED_KEY = "lunex-push-prompt-dismissed";
/** After "later" the question waits this long before it comes back. */
const ASK_AGAIN_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
/** The question waits until the visitor has had a moment on the page. */
const SHOW_AFTER_MS = 6_000;
/** Places where a banner would be in the way: the reader, the chat, and signing in. */
const HIDDEN_ON = [/^\/series\/[^/]+\/[^/]+\/?$/, /^\/messages/, /^\/(login|register|forgot-password|reset-password)/];

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < ASK_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    /* the question just comes back next time */
  }
}

/**
 * Mounted once in the site's frame. To a signed-in member whose browser can receive notifications and who has not been asked yet, it puts
 * one tidy question at the bottom of the screen: do they want new chapters, replies and messages on this device? "Yes" opens the browser's
 * own permission question; "later" keeps the banner away for two weeks. Someone who already agreed on this device is not asked again — the
 * device just follows whoever signs in.
 */
export function PushPrompt() {
  const userId = useSession((s) => s.currentUserId);
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (userId) void reattachThisDevice();
  }, [userId]);

  useEffect(() => {
    if (!userId || pushSupport() !== "supported" || pushPermission() !== "default" || recentlyDismissed()) return;
    const timer = window.setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [userId]);

  const open = ready && !!userId && !HIDDEN_ON.some((pattern) => pattern.test(pathname));

  async function accept() {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    setReady(false);
    if (result.ok) {
      useToast.getState().push({ title: "تم تفعيل الإشعارات", description: "ستصلك الفصول الجديدة والردود والرسائل على هذا الجهاز." });
      return;
    }
    rememberDismissal();
    useToast.getState().push(
      result.reason === "denied"
        ? { title: "لم يُسمح بالإشعارات", description: "يمكنك تفعيلها لاحقًا من صفحة الإشعارات." }
        : { title: "تعذر تفعيل الإشعارات", description: "جرّب لاحقًا من صفحة الإشعارات." }
    );
  }

  function later() {
    rememberDismissal();
    setReady(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="تفعيل الإشعارات"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-x-3 bottom-20 z-[60] sm:inset-x-auto sm:end-4 sm:w-[26rem] lg:bottom-4"
        >
          <div className="panel flex items-start gap-3 border-primary-500/40 p-4 shadow-2xl shadow-black/50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-primary-300">
              <Bell className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">تريد أن تصلك الإشعارات على هذا الجهاز؟</p>
              <p className="mt-1 text-xs leading-relaxed text-lunex-gray">
                الفصول الجديدة لأعمالك المفضلة، والردود على تعليقاتك، والرسائل — حتى والموقع مغلق. تقدر توقفها في أي وقت.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={accept} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} نعم، فعّل الإشعارات
                </Button>
                <Button size="sm" variant="ghost" onClick={later} disabled={busy}>
                  لاحقًا
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
