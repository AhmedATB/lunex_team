"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const MIN_LENGTH = 12;

/**
 * The page the mailed link opens. The token sits after the `#` in the link — a browser never sends that part to any
 * server or in a Referer header — so it is read here and then wiped from the address bar.
 */
export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const found = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    setToken(found);
    setReady(true);
    if (found) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || loading) return;
    setError("");
    if (password.length < MIN_LENGTH) return setError(`كلمة المرور ${MIN_LENGTH} حرفًا على الأقل.`);
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) setDone(true);
      else {
        const body = (await res.json().catch(() => null)) as { code?: string } | null;
        if (body?.code === "reset_link_invalid") setExpired(true);
        else if (res.status === 429) setError("محاولات كثيرة، انتظر دقيقة ثم حاول مرة أخرى.");
        else setError("تعذر تغيير كلمة المرور الآن، حاول مرة أخرى.");
      }
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  const noLink = ready && !token && !done;

  return (
    <Card className="rounded-3xl border-white/10 bg-card/70 shadow-glow-lg backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle>كلمة مرور جديدة</CardTitle>
        <CardDescription>{done ? "تم تغيير كلمة المرور" : "اختر كلمة مرور جديدة لحسابك"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {done && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-sm text-lunex-gray">تم تعيين كلمة المرور الجديدة وتسجيل الخروج من كل الأجهزة. سجّل الدخول بها الآن.</p>
            <Button asChild className="w-full">
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
          </div>
        )}

        {(expired || noLink) && !done && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-red-400">{expired ? "هذا الرابط غير صالح أو انتهت صلاحيته." : "لا يوجد رابط استعادة في هذا العنوان."}</p>
            <p className="text-sm text-lunex-gray">كل رابط يعمل مرة واحدة ولمدة ساعة. اطلب رابطًا جديدًا وافتحه من بريدك.</p>
            <Button asChild className="w-full">
              <Link href="/forgot-password">طلب رابط جديد</Link>
            </Button>
          </div>
        )}

        {ready && token && !expired && !done && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" className="ps-9" autoComplete="new-password" />
              </div>
              <p className="text-xs text-lunex-gray">{MIN_LENGTH} حرفًا على الأقل.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••••••" className="ps-9" autoComplete="new-password" />
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={!password || !confirm || loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ كلمة المرور
            </Button>
          </form>
        )}

        {!done && (
          <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-primary-300 hover:text-primary-200">
            <ArrowRight className="h-4 w-4 rtl:rotate-180" /> العودة لتسجيل الدخول
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
