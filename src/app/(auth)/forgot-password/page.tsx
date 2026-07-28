"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSent(true);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>استعادة كلمة المرور</CardTitle>
        <CardDescription>
          {sent ? "تحقق من بريدك الإلكتروني" : "أدخل بريدك وسنرسل رابط إعادة التعيين"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-sm text-lunex-gray">
              أرسلنا رابط استعادة كلمة المرور إلى <span className="text-white">{email}</span>
            </p>
          </div>
        ) : (
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
            <Button type="submit" className="w-full" disabled={!email}>
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
