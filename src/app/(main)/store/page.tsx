"use client";

import { useEffect } from "react";
import { Coins, PlayCircle, Gift, Ticket, Sparkles } from "lucide-react";
import { useRewards } from "@/store/rewards";
import { AdWatchDialog, BuyCoinsDialog } from "@/components/reader/chapter-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StorePage() {
  useEffect(() => {
    document.title = "متجر الكوينز | LUNEX TEAM";
  }, []);

  const rewards = useRewards();
  const dailyProgress = Math.min(rewards.dailyReadKeys.length, rewards.settings.dailyReadTarget);
  const dailyTarget = rewards.settings.dailyReadTarget;
  const dailyRewardAvailable = !rewards.dailyRewardClaimed && rewards.dailyReadKeys.length >= dailyTarget;

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title font-display text-2xl font-black text-white">متجر الكوينز</h1>
          <p className="mt-2 text-sm text-lunex-gray">اشحن رصيدك أو اكسب كوينز مجاناً لفتح الفصول الحصرية.</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1.5 text-sm">
          <Coins className="h-4 w-4 text-yellow-400" /> {rewards.coins}
        </Badge>
      </div>

      <Tabs defaultValue="buy">
        <TabsList>
          <TabsTrigger value="buy">شراء كوينز</TabsTrigger>
          <TabsTrigger value="ads">شاهد إعلانات</TabsTrigger>
          <TabsTrigger value="daily">المكافأة اليومية</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Coins className="h-4 w-4 text-yellow-400" /> شراء كوينز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-lunex-gray">عملية شراء تجريبية — لا يوجد دفع حقيقي في هذه النسخة.</p>
              <BuyCoinsDialog onBuy={(amount) => rewards.buyCoins(amount)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PlayCircle className="h-4 w-4 text-emerald-400" /> شاهد إعلانات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-lunex-gray">تقدمك الحالي</span>
                <Badge variant="secondary">{rewards.adsWatched} / {rewards.settings.adsPerUnlock}</Badge>
              </div>
              <Progress value={(rewards.adsWatched / rewards.settings.adsPerUnlock) * 100} />
              <p className="text-xs text-lunex-gray">
                شاهد {rewards.settings.adsPerUnlock} إعلانات واحصل على تذكرة فتح فصل مجانية.
              </p>
              <AdWatchDialog onComplete={() => rewards.watchAd()} />

              <div className="border-t-2 border-white/10 pt-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    <Ticket className="h-4 w-4 text-amber-300" /> تذاكر الفتح المجانية لديك
                  </span>
                  <Badge variant={rewards.freeUnlockCredits > 0 ? "success" : "secondary"}>{rewards.freeUnlockCredits}</Badge>
                </div>
                <p className="mt-1 text-xs text-lunex-gray">استخدم التذاكر من داخل أي فصل مقفل.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gift className="h-4 w-4 text-pink-400" /> المكافأة اليومية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-lunex-gray">فصول اليوم المقروءة</span>
                <Badge variant={dailyRewardAvailable ? "success" : "secondary"}>{dailyProgress} / {dailyTarget}</Badge>
              </div>
              <Progress value={(dailyProgress / dailyTarget) * 100} />
              <p className="text-xs text-lunex-gray">
                {rewards.dailyRewardClaimed
                  ? "استلمت مكافأة اليوم — عد غداً لمكافأة جديدة!"
                  : `اقرأ ${dailyTarget} فصلاً حتى النهاية اليوم لتفتح مكافأة فتح فصل مجاني.`}
              </p>
              {dailyRewardAvailable && (
                <p className="flex items-center gap-2 rounded-xl bg-primary-600/10 p-3 text-sm text-primary-300">
                  <Sparkles className="h-4 w-4" /> مكافأتك جاهزة — افتح أي فصل مقفل واستخدمها من هناك.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
