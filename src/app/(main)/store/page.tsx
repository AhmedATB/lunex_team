"use client";

import { useEffect } from "react";
import { BookOpenCheck, Coins, MessageCircle, Lock } from "lucide-react";
import { CONTACT_DISCORD_URL } from "@/lib/site";
import { useSession } from "@/store/session";
import { useWallet } from "@/store/wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/** Sizes offered when asking for coins; the price of a pack is agreed on Discord, where the coins are added to the account. */
const COIN_PACKS = [100, 550, 1200];

export default function StorePage() {
  useEffect(() => {
    document.title = "العملات وفتح الفصول | LUNEX TEAM";
  }, []);

  const signedIn = useSession((s) => Boolean(s.currentUserId));
  const wallet = useWallet((s) => s.wallet);
  const price = wallet?.coinPrice ?? 50;
  const perCredit = wallet?.chaptersPerCredit ?? 10;
  const window = wallet?.lockedWindow ?? 3;

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="section-title font-display text-2xl font-black text-white">العملات وفتح الفصول</h1>
        <p className="mt-2 text-sm leading-relaxed text-lunex-gray">
          أحدث {window} فصول من كل عمل مقفلة. الفصول الأقدم مفتوحة للجميع. تفتح الفصل المقفل بإحدى طريقتين: بالقراءة أو بالعملات.
        </p>
      </div>

      {signedIn && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 p-5">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs text-lunex-gray">
                <Coins className="h-3.5 w-3.5 text-yellow-400" /> عملاتك
              </p>
              <p className="font-display text-2xl font-black text-white">{wallet?.coins ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs text-lunex-gray">
                <BookOpenCheck className="h-3.5 w-3.5 text-emerald-400" /> رصيد القراءة
              </p>
              <p className="font-display text-2xl font-black text-white">{wallet?.unlockCredits ?? 0}</p>
            </div>
            <div className="col-span-2 space-y-1">
              <Progress value={((wallet?.creditProgress ?? 0) / perCredit) * 100} />
              <p className="text-xs text-lunex-gray">
                {wallet?.creditProgress ?? 0} من {perCredit} فصول للرصيد القادم.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-emerald-400" /> افتح بالقراءة (مجاناً)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-lunex-gray">
          <p>
            كل <span className="font-bold text-white">{perCredit} فصول</span> تُنهيها (تصل فيها إلى نهاية الفصل) تمنحك رصيد قراءة واحداً، وكل رصيد
            يفتح فصلاً مقفلاً واحداً.
          </p>
          <p>يُحسب الفصل مرة واحدة فقط، فإعادة قراءة فصل أنهيته لا تزيد رصيدك، وتُحسب الفصول من النهاية الفعلية لا من فتح الصفحة.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" /> افتح بالعملات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-lunex-gray">
            فتح الفصل الواحد يكلّف <span className="font-bold text-white">{price} عملة</span>. تحصل على العملات بالتواصل معنا على ديسكورد، ونضيفها
            إلى حسابك بعد الدفع. لا يوجد دفع داخل الموقع.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {COIN_PACKS.map((coins) => (
              <div key={coins} className="panel flex flex-col items-center gap-1 p-3 text-center">
                <Coins className="h-5 w-5 text-yellow-400" />
                <span className="font-display text-lg font-black text-white">{coins}</span>
                <Badge variant="secondary" className="text-[10px]">
                  يفتح {Math.floor(coins / price)} فصل
                </Badge>
              </div>
            ))}
          </div>
          <Button asChild className="w-full">
            <a href={CONTACT_DISCORD_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> اطلب العملات عبر ديسكورد
            </a>
          </Button>
          <p className="text-xs text-lunex-gray">الأسعار وطرق الدفع المتاحة تُحدَّد عند التواصل. اذكر اسم المستخدم الخاص بك بالضبط.</p>
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-xs text-lunex-gray">
        <Lock className="h-3.5 w-3.5" /> الفصل الذي تفتحه يبقى مفتوحاً لحسابك.
      </p>
    </div>
  );
}
