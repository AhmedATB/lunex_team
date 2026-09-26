"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { loadTurnstile, TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

interface TurnstileBoxProps {
  /** Names the form ("login", "register", "forgot"); the backend checks the token was earned for this one. */
  action: string;
  /** The token once the visitor passes, and null when there is none (not yet, expired, spent). */
  onToken: (token: string | null) => void;
  /** Raise it after every submit: a token works once, so the box starts over. */
  resetKey?: number;
}

/**
 * The "I am not a robot" box. Renders nothing at all when no site key is configured, so the forms work unchanged until it is.
 * If Cloudflare's script cannot load (an ad blocker, no network) it says so and offers a retry — a form must never look dead.
 */
export function TurnstileBox({ action, onToken, resetKey = 0 }: TurnstileBoxProps) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const report = useRef(onToken);
  report.current = onToken;
  const [problem, setProblem] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!TURNSTILE_ENABLED) return;
    let cancelled = false;
    setProblem(false);
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !holder.current) return;
        widgetId.current = turnstile.render(holder.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: "dark",
          language: "ar",
          size: "flexible",
          callback: (token: string) => report.current(token),
          "expired-callback": () => report.current(null),
          "timeout-callback": () => report.current(null),
          "error-callback": () => {
            report.current(null);
            setProblem(true);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setProblem(true);
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
      report.current(null);
    };
  }, [action, attempt]);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current || !window.turnstile) return;
    report.current(null);
    window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!TURNSTILE_ENABLED) return null;
  return (
    <div className="space-y-2">
      <div ref={holder} className="min-h-[65px]" />
      {problem && (
        <p className="flex items-start gap-1.5 text-xs text-amber-400" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            تعذر تحميل مربع التحقق. إن كان عندك مانع إعلانات فأوقفه لهذا الموقع، ثم{" "}
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-bold underline">
              أعد المحاولة
            </button>
            .
          </span>
        </p>
      )}
    </div>
  );
}
