"use client";

import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/consent";

export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}>
      إعدادات الكوكيز
    </button>
  );
}
