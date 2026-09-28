"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  disablePush,
  enableFailureText,
  enablePush,
  pushPermission,
  pushStatus,
  pushSupport,
  savePushPreferences,
  sendTestPush,
  type PushCategory,
  type PushPreferences,
  type PushSupport,
} from "@/lib/push-client";
import { useToast } from "@/store/toast";

const CATEGORIES: { key: PushCategory; label: string; hint: string }[] = [
  { key: "chapters", label: "الفصول الجديدة", hint: "لأعمالك المفضلة" },
  { key: "messages", label: "الرسائل", hint: "المحادثات الخاصة والمجموعات" },
  { key: "replies", label: "الردود", hint: "على تعليقاتك" },
  { key: "news", label: "الأخبار والأعمال الجديدة", hint: "ما ينشره الموقع للجميع" },
  { key: "account", label: "الحساب والفرق", hint: "العملات وطلبات الفرق وتنبيهات الإدارة" },
];

/**
 * The notifications page's card for notifications on the device (phone or computer): turn them on or off for this device, choose which
 * kinds arrive on any of the member's devices, and send a test to see that it works.
 */
export function PushSettings() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [thisDevice, setThisDevice] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const level = pushSupport();
    setSupport(level);
    setPermission(pushPermission());
    if (level !== "supported") return;
    const status = await pushStatus();
    if (status) {
      setThisDevice(status.thisDevice && pushPermission() === "granted");
      setPreferences(status.preferences);
    }
  }, []);

  // On load, and whenever the visitor comes back to the tab (they may have just allowed notifications in the browser's own settings).
  useEffect(() => {
    void load();
    const onBack = () => document.visibilityState === "visible" && void load();
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onBack);
    return () => {
      window.removeEventListener("focus", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [load]);

  async function toggleDevice(on: boolean) {
    setBusy(true);
    if (on) {
      const result = await enablePush();
      if (!result.ok) useToast.getState().push(enableFailureText(result));
    } else {
      await disablePush();
    }
    await load();
    setBusy(false);
  }

  async function toggleCategory(key: PushCategory, value: boolean) {
    setPreferences((current) => (current ? { ...current, [key]: value } : current));
    const saved = await savePushPreferences({ [key]: value });
    if (saved) setPreferences(saved);
    else {
      setPreferences((current) => (current ? { ...current, [key]: !value } : current));
      useToast.getState().push({ title: "تعذر الحفظ", description: "جرّب مرة أخرى." });
    }
  }

  async function test() {
    setTesting(true);
    const result = await sendTestPush();
    setTesting(false);
    useToast.getState().push(
      result.ok && result.sent > 0
        ? { title: "أُرسل إشعار تجريبي", description: "يجب أن يظهر على جهازك خلال ثوانٍ." }
        : result.ok
          ? { title: "لم يصل الإشعار التجريبي", description: "أعد تفعيل الإشعارات على هذا الجهاز ثم جرّب مرة أخرى." }
          : { title: "لا يوجد جهاز مفعّل", description: "فعّل الإشعارات على هذا الجهاز أولًا." }
    );
    await load(); // a device the browser's push service dropped is gone from the server too
  }

  if (support === null) return null;

  return (
    <section aria-label="الإشعارات على جهازك" className="panel space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-primary-300">
          <BellRing className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-white">الإشعارات على جهازك</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-lunex-gray">تصلك على الهاتف أو الحاسوب حتى والموقع مغلق.</p>
        </div>
        {support === "supported" && permission !== "denied" && (
          <div className="flex items-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin text-lunex-gray" aria-hidden />}
            <Switch checked={thisDevice} disabled={busy} onCheckedChange={toggleDevice} aria-label="الإشعارات على هذا الجهاز" />
          </div>
        )}
      </div>

      {support === "unsupported" && <p className="text-xs leading-relaxed text-lunex-gray">هذا المتصفح لا يدعم الإشعارات على الجهاز. جرّب Chrome أو Firefox أو Edge أو Safari حديثًا.</p>}
      {support === "needs-install" && (
        <p className="text-xs leading-relaxed text-lunex-gray">
          على الآيفون تعمل الإشعارات بعد إضافة الموقع إلى الشاشة الرئيسية: افتحه في Safari، اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وافتح الموقع من أيقونته وفعّل الإشعارات من هنا.
        </p>
      )}
      {support === "supported" && permission === "denied" && (
        <p className="text-xs leading-relaxed text-amber-300/90">الإشعارات محظورة لهذا الموقع في المتصفح. اضغط على أيقونة القفل بجانب العنوان، اسمح بالإشعارات، ثم أعد تحميل الصفحة.</p>
      )}

      {support === "supported" && thisDevice && preferences && (
        <>
          <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
            {CATEGORIES.map(({ key, label, hint }) => (
              <li key={key} className="flex items-center justify-between gap-3 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-lunex-gray">{hint}</p>
                </div>
                <Switch checked={preferences[key]} onCheckedChange={(value) => toggleCategory(key, value)} aria-label={label} />
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال إشعار تجريبي
          </Button>
        </>
      )}
    </section>
  );
}
