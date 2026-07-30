"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Lock, PlayCircle, Coins, Gift, Ticket, Sparkles, Plus } from "lucide-react";
import { useRewards, chapterKey, isChapterLocked } from "@/store/rewards";
import { useTeamManagement } from "@/store/team-management";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const COIN_PACKS = [
  { coins: 100, price: "$0.99" },
  { coins: 550, price: "$4.99" },
  { coins: 1200, price: "$9.99" },
];

export function ChapterGate({
  seriesId,
  seriesSlug,
  seriesTitle,
  chapterId,
  chapterNumber,
  latestChapterNumber,
  children,
}: {
  seriesId: string;
  seriesSlug: string;
  seriesTitle: string;
  chapterId: string;
  chapterNumber: number;
  latestChapterNumber: number;
  children: ReactNode;
}) {
  const rewards = useRewards();
  const manualLock = useTeamManagement((s) => s.chapterLockOverrides[chapterId]);
  const key = chapterKey(seriesId, chapterNumber);

  // Persisted store rehydrates after mount; wait one tick so a paying user's
  // unlocked chapter doesn't flash the lock screen on hard reload.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const locked = isChapterLocked(
    chapterNumber,
    latestChapterNumber,
    rewards.settings.lockedChapterCount,
    rewards.unlockedChapters,
    seriesId,
    manualLock
  );

  if (!ready) return null;
  if (!locked) return <>{children}</>;

  const dailyProgress = rewards.dailyReadKeys.length;
  const dailyTarget = rewards.settings.dailyReadTarget;
  const dailyRewardAvailable = !rewards.dailyRewardClaimed && dailyProgress >= dailyTarget;
  const price = rewards.settings.chapterCoinPrice;

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
          الفصل {chapterNumber} من {seriesTitle} من الفصول الحصرية الجديدة. افتحه بإحدى الطرق التالية:
        </p>
      </div>

      <Card className="w-full text-start">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <PlayCircle className="h-4 w-4 text-emerald-400" /> شاهد إعلانات
              </span>
              <Badge variant="secondary">
                {rewards.adsWatched} / {rewards.settings.adsPerUnlock}
              </Badge>
            </div>
            <Progress value={(rewards.adsWatched / rewards.settings.adsPerUnlock) * 100} />
            <p className="text-xs text-lunex-gray">
              شاهد {rewards.settings.adsPerUnlock} إعلانات واحصل على تذكرة فتح فصل مجانية.
            </p>
            <AdWatchDialog onComplete={() => rewards.watchAd()} />
          </div>

          <div className="border-t-2 border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <Ticket className="h-4 w-4 text-amber-300" /> تذاكر الفتح المجانية
              </span>
              <Badge variant={rewards.freeUnlockCredits > 0 ? "success" : "secondary"}>
                {rewards.freeUnlockCredits}
              </Badge>
            </div>
            <Button
              className="mt-2 w-full"
              disabled={rewards.freeUnlockCredits < 1}
              onClick={() => rewards.unlockWithCredit(key)}
            >
              <Ticket className="h-4 w-4" /> استخدم تذكرة لفتح الفصل
            </Button>
          </div>

          <div className="border-t-2 border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <Coins className="h-4 w-4 text-yellow-400" /> الكوينز
              </span>
              <Badge variant="secondary">{rewards.coins} كوين</Badge>
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                disabled={rewards.coins < price}
                onClick={() => rewards.unlockWithCoins(key)}
              >
                <Coins className="h-4 w-4" /> افتح مقابل {price} كوين
              </Button>
              <BuyCoinsDialog onBuy={(amount) => rewards.buyCoins(amount)} />
            </div>
          </div>

          <div className="border-t-2 border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <Gift className="h-4 w-4 text-pink-400" /> مكافأة القراءة اليومية
              </span>
              <Badge variant={dailyRewardAvailable ? "success" : "secondary"}>
                {Math.min(dailyProgress, dailyTarget)} / {dailyTarget}
              </Badge>
            </div>
            <Progress value={(Math.min(dailyProgress, dailyTarget) / dailyTarget) * 100} className="mt-2" />
            <p className="mt-1 text-xs text-lunex-gray">
              {rewards.dailyRewardClaimed
                ? "استلمت مكافأة اليوم — عد غداً لمكافأة جديدة!"
                : `اقرأ ${dailyTarget} فصلاً اليوم واحصل على فتح فصل من اختيارك هدية.`}
            </p>
            {dailyRewardAvailable && (
              <Button className="mt-2 w-full" onClick={() => rewards.claimDailyReward(key)}>
                <Sparkles className="h-4 w-4" /> استخدم مكافأة اليوم لفتح هذا الفصل
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Button variant="ghost" asChild>
        <Link href={`/series/${seriesSlug}`}>العودة لصفحة السلسلة</Link>
      </Button>
    </div>
  );
}

export function AdWatchDialog({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState(5);

  useEffect(() => {
    if (!open) return;
    setRemaining(5);
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  function finish() {
    onComplete();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          <PlayCircle className="h-4 w-4" /> شاهد إعلاناً
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إعلان</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-40 w-full items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5">
            <p className="text-sm text-lunex-gray">مساحة إعلانية تجريبية</p>
          </div>
          {remaining > 0 ? (
            <p className="text-sm text-lunex-gray">يمكنك المتابعة بعد {remaining} ثوانٍ...</p>
          ) : (
            <Button onClick={finish} className="w-full">
              <Sparkles className="h-4 w-4" /> استلم المشاهدة
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BuyCoinsDialog({ onBuy }: { onBuy: (amount: number) => void }) {
  const [open, setOpen] = useState(false);

  function buy(amount: number) {
    onBuy(amount);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label="شراء كوينز">
          <Plus className="h-4 w-4" /> شراء
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>شراء كوينز</DialogTitle></DialogHeader>
        <p className="text-xs text-lunex-gray">عملية الشراء تجريبية — لا يوجد دفع حقيقي في هذه النسخة.</p>
        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          {COIN_PACKS.map((pack) => (
            <button
              key={pack.coins}
              type="button"
              onClick={() => buy(pack.coins)}
              className="panel panel-hover hover-pop flex flex-col items-center gap-1 p-4"
            >
              <Coins className="h-6 w-6 text-yellow-400" />
              <span className="font-display text-lg font-bold text-white">{pack.coins}</span>
              <span className="text-xs text-lunex-gray">{pack.price}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

