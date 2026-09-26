"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ADS_ENABLED, isAdPage } from "@/lib/ads";
import { ADS_STATUS_EVENT, adsDebugRequested } from "@/lib/ads-status";

const MEANING: Record<string, string> = {
  "script loaded": "وصل كود الشبكة (إن لم يظهر إعلان فالشبكة لم تُعطِ إعلاناً)",
  "blocked or failed": "انحجب: مانع إعلانات أو فلتر أو الشبكة غير قابلة للوصول من جهازك",
  "creative shown": "ظهر إعلان",
  "no ad served": "الكود اشتغل لكن الشبكة لم تُعطِ إعلاناً",
};

/** A small corner panel, only when the page is opened with `?ads=debug`: what each ad unit did in this browser. */
export function AdsDebugPanel() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const [rows, setRows] = useState<[string, string][]>([]);

  useEffect(() => {
    setOn(adsDebugRequested());
    const update = () => setRows(Object.entries(window.__lunexAds ?? {}));
    update();
    window.addEventListener(ADS_STATUS_EVENT, update);
    return () => window.removeEventListener(ADS_STATUS_EVENT, update);
  }, []);

  if (!on) return null;
  return (
    <div dir="rtl" className="fixed bottom-20 start-2 z-[70] max-w-[min(92vw,22rem)] rounded-xl border border-white/20 bg-black/85 p-3 text-[11px] leading-relaxed text-white shadow-lg" role="status">
      <p className="mb-1 font-bold">تشخيص الإعلانات</p>
      <p>الإعلانات مفعّلة: {ADS_ENABLED ? "نعم" : "لا"} · هذه الصفحة تسمح بها: {isAdPage(pathname) ? "نعم" : "لا"}</p>
      {rows.length === 0 ? (
        <p className="mt-1 opacity-75">لا توجد وحدات على هذه الصفحة بعد.</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {rows.map(([id, status]) => (
            <li key={id}>
              <span dir="ltr" className="font-mono">{id}</span>: {MEANING[status] ?? status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
