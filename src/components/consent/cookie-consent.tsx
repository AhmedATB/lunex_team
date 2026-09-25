"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  clearPreferenceStorage,
  writeConsent,
  type ConsentChoice,
} from "@/lib/consent";
import { useTheme, writeStyleCookie } from "@/store/theme";
import { useReaderSettings, useNovelReaderSettings } from "@/store/reader-settings";
import { usePreferences } from "@/store/preferences";

/**
 * The cookie notice. `initialChoice` comes from the consent cookie read on
 * the server, so a returning visitor never sees the banner flash in.
 * Accepting turns on the preference tier; choosing essential-only removes
 * whatever that tier had stored (see lib/consent.ts).
 */
export function CookieConsent({ initialChoice }: { initialChoice: ConsentChoice | null }) {
  const [choice, setChoice] = useState<ConsentChoice | null>(initialChoice);
  const [open, setOpen] = useState(initialChoice === null);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  function save(next: ConsentChoice) {
    writeConsent(next);
    if (next === "all") {
      writeStyleCookie(useTheme.getState().style);
      // The stores only write on change; nudge them so what the reader already
      // picked this visit is saved now rather than at their next change.
      useTheme.setState({});
      useReaderSettings.setState({});
      useNovelReaderSettings.setState({});
      usePreferences.setState({});
    } else {
      clearPreferenceStorage();
    }
    setChoice(next);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="panel animate-in fade-in slide-in-from-bottom-4 fixed inset-x-3 bottom-20 z-[90] space-y-3 p-4 shadow-2xl duration-300 lg:inset-x-auto lg:bottom-4 lg:start-4 lg:w-[26rem]"
    >
      <div className="flex items-center gap-2">
        <Cookie className="h-5 w-5 text-primary-300" aria-hidden />
        <h2 id="cookie-consent-title" className="font-display text-base font-bold text-white">
          ملفات تعريف الارتباط (الكوكيز)
        </h2>
      </div>
      <p className="text-sm leading-relaxed text-lunex-gray">
        نستخدم ملفات ضرورية لتسجيل الدخول وحماية حسابك، وأخرى اختيارية لحفظ تفضيلاتك مثل الثيم وإعدادات القارئ.
        لا نستخدم ملفات تحليلية. وتُعرض في صفحات التصفح إعلانات من شبكة خارجية تموّل الموقع، وقد تضع ملفاتها الخاصة؛ هذا الشريط لا
        يتحكم بها.{" "}
        <Link href="/privacy" className="font-medium text-primary-300 underline-offset-2 hover:underline">
          سياسة الخصوصية
        </Link>
      </p>
      {choice && (
        <p className="text-xs text-lunex-gray">
          اختيارك الحالي: {choice === "all" ? "قبول الكل" : "الضرورية فقط"}
        </p>
      )}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => save("all")}>
          قبول الكل
        </Button>
        <Button className="flex-1" variant="secondary" onClick={() => save("essential")}>
          الضرورية فقط
        </Button>
      </div>
    </div>
  );
}
