"use client";

import { useEffect, useState } from "react";
import { Coins, PlayCircle, Gift, Lock } from "lucide-react";
import { useRewards, type MonetizationSettings } from "@/store/rewards";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const FIELDS: { key: keyof MonetizationSettings; label: string; hint: string; icon: typeof Coins; min: number; max: number }[] = [
  {
    key: "adsPerUnlock",
    label: "عدد الإعلانات لفتح فصل",
    hint: "كم إعلاناً يشاهد المستخدم ليحصل على تذكرة فتح فصل مجانية.",
    icon: PlayCircle,
    min: 1,
    max: 20,
  },
  {
    key: "dailyReadTarget",
    label: "هدف القراءة اليومي",
    hint: "كم فصلاً يقرأ المستخدم في اليوم ليحصل على مكافأة فتح فصل من اختياره.",
    icon: Gift,
    min: 1,
    max: 100,
  },
  {
    key: "chapterCoinPrice",
    label: "سعر الفصل بالكوينز",
    hint: "كم كوين يكلف فتح فصل مقفل واحد.",
    icon: Coins,
    min: 1,
    max: 10000,
  },
  {
    key: "lockedChapterCount",
    label: "عدد الفصول المقفلة",
    hint: "كم فصلاً من أحدث فصول كل سلسلة يكون مقفلاً (حصرياً).",
    icon: Lock,
    min: 0,
    max: 50,
  },
];

export default function AdminMonetizationPage() {
  useEffect(() => {
    document.title = "المكافآت والأرباح | LUNEX TEAM";
  }, []);

  const settings = useRewards((s) => s.settings);
  const updateSettings = useRewards((s) => s.updateSettings);

  const [form, setForm] = useState<MonetizationSettings>(settings);
  const [saved, setSaved] = useState(false);

  // Persisted store rehydrates after mount — sync the form once real values arrive.
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="section-title font-display text-2xl font-bold text-white">المكافآت والأرباح</h1>
        <p className="mt-2 text-sm text-lunex-gray">
          تحكم بنظام الإعلانات والمكافآت والكوينز وقفل الفصول على مستوى المنصة.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إعدادات النظام</CardTitle>
          <CardDescription>تُطبق التغييرات فوراً على جميع القرّاء.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map(({ key, label, hint, icon: Icon, min, max }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary-300" /> {label}
                  </Label>
                  <Input
                    id={key}
                    type="number"
                    min={min}
                    max={max}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: Math.max(min, Math.min(max, Number(e.target.value))) }))
                    }
                  />
                  <p className="text-xs text-lunex-gray">{hint}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit">حفظ الإعدادات</Button>
              {saved && <span className="text-sm text-emerald-400">تم الحفظ ✓</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
