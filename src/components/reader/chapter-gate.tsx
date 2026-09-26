"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { BookOpenCheck, Coins, Loader2, Lock } from "lucide-react";
import { isLockedByRule } from "@/lib/chapter-lock";
import { useSession } from "@/store/session";
import { lockRuleOf, useWallet } from "@/store/wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/** People who publish and run the site read every chapter without unlocking it (the server lets them through too). */
const READS_EVERYTHING = new Set(["uploader", "editor", "super_administrator", "owner"]);

/** How long to wait for the wallet before offering a retry, instead of an empty page. */
const WAIT_BEFORE_RETRY_MS = 8000;

const UNLOCK_ERRORS: Record<string, string> = {
  insufficient_credits: "ما عندك رصيد قراءة بعد. اقرأ المزيد من الفصول لتحصل على فتح مجاني.",
  insufficient_coins: "رصيدك من العملات لا يكفي لفتح هذا الفصل.",
  error: "تعذر فتح الفصل، حاول مرة أخرى.",
};

/**
 * Stands in front of a chapter. The newest chapters of a series are locked; they open with a reading credit (earned by
 * finishing chapters) or with coins. What is shown here follows the server's rule and the server's balances, and the
 * server refuses the pages itself to anyone who has not opened the chapter — this screen only explains and asks.
 */
export function ChapterGate({
  seriesSlug,
  seriesTitle,
  chapterId,
  chapterNumber,
  latestChapterNumber,
  manualLock,
  children,
}: {
  seriesId?: string;
  seriesSlug: string;
  seriesTitle: string;
  chapterId: string;
  chapterNumber: number;
  latestChapterNumber: number;
  /** A staff override: true = always locked, false = always open, undefined/null = automatic. */
  manualLock?: boolean | null;
  children: ReactNode;
}) {
  const signedIn = useSession((s) => Boolean(s.currentUserId));
  const role = useSession((s) => s.user?.role);
  const { wallet, loaded, refresh, unlock } = useWallet();

  const [busy, setBusy] = useState<"credit" | "coins" | null>(null);
  const [error, setError] = useState("");
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  useEffect(() => {
    if (signedIn && !loaded) void refresh();
  }, [signedIn, loaded, refresh]);

  useEffect(() => {
    if (loaded || !signedIn) return;
    const timer = window.setTimeout(() => setWaitedTooLong(true), WAIT_BEFORE_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [loaded, signedIn]);

  const staff = role ? READS_EVERYTHING.has(role) : false;
  const byRule = isLockedByRule(chapterNumber, latestChapterNumber, lockRuleOf(wallet), manualLock);
  const opened = wallet?.unlockedChapterIds.includes(chapterId) ?? false;

  // A free chapter needs nothing, so it is never held back waiting for the wallet.
  if (!byRule || staff) return <>{children}</>;
  if (!loaded && signedIn) {
    return waitedTooLong ? (
      <div className="container flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-lunex-gray">تعذر التحقق من حالة هذا الفصل الآن.</p>
        <Button onClick={() => void refresh()}>إعادة المحاولة</Button>
      </div>
    ) : (
      <div className="container flex min-h-[50vh] items-center justify-center" role="status" aria-label="جارِ التحميل">
        <Loader2 className="h-6 w-6 animate-spin text-primary-300" />
      </div>
    );
  }
  if (opened) return <>{children}</>;

  const credits = wallet?.unlockCredits ?? 0;
  const perCredit = wallet?.chaptersPerCredit ?? 10;
  const progressToNext = wallet?.creditProgress ?? 0;
  const price = wallet?.coinPrice ?? 50;
  const coins = wallet?.coins ?? 0;

  async function open(method: "credit" | "coins") {
    if (busy) return;
    setBusy(method);
    setError("");
    const result = await unlock(chapterId, method);
    if (!result.ok) setError(UNLOCK_ERRORS[result.code]);
    setBusy(null);
  }

  return (
    <div className="container flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-5 py-10 text-center">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-6 -z-10 opacity-50 blur-2xl">
          <div className="h-full w-full rounded-full bg-primary-600" />
        </div>
        <Lock className="float-slow h-14 w-14 text-primary-300 drop-shadow-[0_0_18px_rgba(168,85,247,0.6)]" />
      </div>
      <div>
        <h1 className="section-title font-display text-2xl font-black text-white">هذا الفصل مقفل</h1>
        <p className="mt-2 text-sm text-lunex-gray">
          الفصل {chapterNumber} من {seriesTitle} من أحدث الفصول. افتحه بإحدى الطريقتين:
        </p>
      </div>

      <Card className="w-full text-start">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <BookOpenCheck className="h-4 w-4 text-emerald-400" /> بالقراءة
              </span>
              <Badge variant={credits > 0 ? "success" : "secondary"}>{credits} رصيد</Badge>
            </div>
            <Progress value={(progressToNext / perCredit) * 100} />
            <p className="text-xs text-lunex-gray">
              كل {perCredit} فصول تُنهيها تمنحك فتح فصل مقفل مجاناً. المتبقي للرصيد القادم: {Math.max(0, perCredit - progressToNext)} فصلاً.
            </p>
            <Button className="w-full" disabled={credits < 1 || busy !== null} onClick={() => void open("credit")}>
              {busy === "credit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
              استخدم رصيد القراءة لفتح الفصل
            </Button>
          </div>

          <div className="space-y-2 border-t-2 border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <Coins className="h-4 w-4 text-yellow-400" /> بالعملات
              </span>
              <Badge variant="secondary">{coins} عملة</Badge>
            </div>
            <p className="text-xs text-lunex-gray">سعر فتح الفصل {price} عملة.</p>
            <Button className="w-full" variant="secondary" disabled={coins < price || busy !== null} onClick={() => void open("coins")}>
              {busy === "coins" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              افتح الفصل بـ {price} عملة
            </Button>
            {coins < price && (
              <Button asChild variant="ghost" className="w-full">
                <Link href="/store">كيف أحصل على عملات؟</Link>
              </Button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Button variant="ghost" asChild>
        <Link href={`/series/${seriesSlug}`}>العودة إلى صفحة العمل</Link>
      </Button>
    </div>
  );
}
