"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, CheckCircle2, Info, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { fetchAndSolvePow } from "@/lib/pow-client";
import { CONTACT_DISCORD_URL, CONTACT_TELEGRAM_URL } from "@/lib/site";
import { TURNSTILE_ENABLED, turnstileErrorMessage } from "@/lib/turnstile";
import { TurnstileBox } from "@/components/auth/turnstile-box";

type Stage = "form" | "sent" | "unavailable";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [boxToken, setBoxToken] = useState<string | null>(null);
  const [boxReset, setBoxReset] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setError("");
    if (TURNSTILE_ENABLED && !boxToken) return setError("أكّد أنك لست روبوتًا بالضغط على المربع أعلاه.");
    setLoading(true);
    try {
      const powSolution = await fetchAndSolvePow();
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-fingerprint": getDeviceFingerprint(), "x-pow-solution": powSolution, ...(boxToken ? { "x-turnstile-token": boxToken } : {}) },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { available?: boolean; code?: string; message?: string } | null;
      if (turnstileErrorMessage(body?.code)) setError(turnstileErrorMessage(body?.code) as string);
      else if (res.status === 429) setError("محاولات كثيرة، انتظر دقيقة ثم حاول مرة أخرى.");
      else if (res.status === 400) setError("أدخل بريدًا إلكترونيًا صحيحًا.");
      else if (!res.ok) setError("تعذر الإرسال الآن، حاول مرة أخرى بعد قليل.");
      else setStage(body?.available === false ? "unavailable" : "sent");
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setLoading(false);
      if (TURNSTILE_ENABLED) setBoxReset((n) => n + 1); // a token works once
    }
  }

  return (
    <Card className="rounded-3xl border-white/10 bg-card/70 shadow-glow-lg backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle>استعادة كلمة المرور</CardTitle>
        <CardDescription>
          {stage === "sent" ? "تحقق من بريدك الإلكتروني" : stage === "unavailable" ? "الاستعادة بالبريد غير متاحة حاليًا" : "أدخل بريد حسابك وسنرسل رابط إعادة التعيين"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stage === "sent" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-sm text-lunex-gray">
              إذا كان <span className="text-white" dir="ltr">{email}</span> مسجلًا لدينا، فقد أرسلنا إليه رابطًا لاختيار كلمة مرور جديدة. الرابط يعمل مرة واحدة ولمدة ساعة.
            </p>
            <p className="text-xs text-lunex-gray">لم يصل شيء؟ راجع مجلد الرسائل غير المرغوبة، أو أعد المحاولة بعد دقيقتين.</p>
          </div>
        )}

        {stage === "unavailable" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Info className="h-12 w-12 text-amber-400" />
            <p className="text-sm text-lunex-gray">لم يُفعَّل إرسال البريد الإلكتروني على الموقع بعد، لذلك لا نستطيع إرسال رابط الاستعادة.</p>
            <p className="text-sm text-lunex-gray">
              تواصل معنا على{" "}
              <a href={CONTACT_DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:text-primary-200">
                Discord
              </a>{" "}
              أو{" "}
              <a href={CONTACT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:text-primary-200">
                Telegram
              </a>{" "}
              وسنساعدك في استعادة حسابك.
            </p>
          </div>
        )}

        {stage === "form" && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="ps-9" autoComplete="email" />
              </div>
            </div>
            <TurnstileBox action="forgot" onToken={setBoxToken} resetKey={boxReset} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={!email || loading || (TURNSTILE_ENABLED && !boxToken)}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              إرسال رابط الاستعادة
            </Button>
          </form>
        )}

        <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-primary-300 hover:text-primary-200">
          <ArrowRight className="h-4 w-4 rtl:rotate-180" /> العودة لتسجيل الدخول
        </Link>
      </CardContent>
    </Card>
  );
}
