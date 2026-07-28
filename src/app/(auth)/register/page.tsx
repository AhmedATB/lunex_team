"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = Math.min(4, Math.floor(form.password.length / 3));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.username || !form.email || !form.password) {
      setError("يرجى تعبئة جميع الحقول المطلوبة.");
      return;
    }
    if (!agree) {
      setError("يجب الموافقة على الشروط والأحكام.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push("/login");
    }, 700);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>إنشاء حساب جديد</CardTitle>
        <CardDescription>انضم إلى مجتمع قرّاء LUNEX TEAM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">اسم المستخدم</Label>
            <div className="relative">
              <User className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="username"
                className="ps-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="ps-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">كلمة المرور</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="ps-9"
              />
            </div>
            <div className="flex gap-1 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < passwordStrength ? "bg-lunex-gradient" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-lunex-gray">
            <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
            أوافق على <Link href="#" className="text-primary-300 hover:underline">الشروط والأحكام</Link> وسياسة الخصوصية
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            إنشاء الحساب
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
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="font-semibold text-primary-300 hover:text-primary-200">
            سجّل الدخول
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
