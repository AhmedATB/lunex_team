"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/store/session";
import { getMockDatabase } from "@/lib/mock/generate";

export default function LoginPage() {
  const router = useRouter();
  const setCurrentUserId = useSession((s) => s.setCurrentUserId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("يرجى تعبئة جميع الحقول.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const user = getMockDatabase().users.find((u) => u.email === email) ?? getMockDatabase().users[0];
      setCurrentUserId(user.id);
      setLoading(false);
      router.push("/profile");
    }, 700);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>تسجيل الدخول</CardTitle>
        <CardDescription>أهلاً بعودتك إلى LUNEX TEAM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="ps-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">كلمة المرور</Label>
              <Link href="/forgot-password" className="text-xs text-primary-300 hover:text-primary-200">
                نسيت كلمة المرور؟
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="ps-9"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            تسجيل الدخول
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-lunex-gray">أو تابع عبر</span>
          <Separator className="flex-1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" type="button">Google</Button>
          <Button variant="secondary" type="button">Discord</Button>
        </div>

        <p className="text-center text-sm text-lunex-gray">
          ليس لديك حساب؟{" "}
          <Link href="/register" className="font-semibold text-primary-300 hover:text-primary-200">
            أنشئ حساباً
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
