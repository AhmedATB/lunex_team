"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Eye, EyeOff, Loader2, Pencil, User as UserIcon, Lock, Bell, AlertCircle } from "lucide-react";
import { useSession } from "@/store/session";
import { useRealUsers, synthesizeProfile } from "@/store/real-users";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { usePreferences } from "@/store/preferences";
import { mergeRealUsers } from "@/lib/mock/generate";
import { AVATAR_PRESET_SEEDS } from "@/lib/avatar-presets";
import { avatarUrl, cn } from "@/lib/utils";
import type { BackendPublicUser } from "@/lib/auth-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function FieldMessage({ kind, text }: { kind: "error" | "success"; text: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-sm", kind === "error" ? "text-red-400" : "text-emerald-400")}>
      {kind === "error" ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <Check className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </p>
  );
}

export default function AccountSettingsPage() {
  useEffect(() => {
    document.title = "إعدادات الحساب | LUNEX TEAM";
  }, []);

  const sessionUser = useSession((s) => s.user);
  const setSessionUser = useSession((s) => s.setUser);

  if (!sessionUser) {
    return (
      <div className="container py-16 text-center text-lunex-gray">
        الرجاء تسجيل الدخول للوصول إلى إعدادات الحساب.
      </div>
    );
  }

  return (
    <div className="container max-w-2xl space-y-6 py-6">
      <div className="flex items-center gap-3">
        <Link
          href="/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-lunex-gray transition-colors hover:text-white"
          aria-label="عودة للملف الشخصي"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-white">إعدادات الحساب</h1>
          <p className="text-sm text-lunex-gray">إدارة معلوماتك الشخصية وكلمة المرور والتفضيلات.</p>
        </div>
      </div>

      <ProfileInfoCard sessionUser={sessionUser} onUpdated={setSessionUser} />
      <PasswordCard />
      <PreferencesCard />
    </div>
  );
}

function ProfileInfoCard({
  sessionUser,
  onUpdated,
}: {
  sessionUser: BackendPublicUser;
  onUpdated: (user: BackendPublicUser) => void;
}) {
  const [displayName, setDisplayName] = useState(sessionUser.displayName ?? sessionUser.username);
  const [username, setUsername] = useState(sessionUser.username);
  const [bio, setBio] = useState(sessionUser.bio ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const setAvatarSeed = useProfile((s) => s.setAvatarSeed);
  const currentSeed = effectiveAvatarSeed({ id: sessionUser.id, avatarSeed: sessionUser.id }, avatarOverrides);

  const usernameValid = /^[a-zA-Z0-9_]{3,24}$/.test(username);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!displayName.trim()) {
      setError("يرجى إدخال اسم عرض.");
      return;
    }
    if (!usernameValid) {
      setError("اسم المستخدم يجب أن يكون بين 3 و24 حرفاً، ويتكون من أحرف إنجليزية وأرقام و _ فقط.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName: displayName.trim(), bio: bio.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? "تعذر حفظ التغييرات.");
        return;
      }
      onUpdated(body);
      useRealUsers.getState().upsertProfile(synthesizeProfile(body));
      mergeRealUsers(useRealUsers.getState().profiles);
      setSuccess(true);
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserIcon className="h-4 w-4" /> معلومات الملف الشخصي
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <div className="art-glow relative h-20 w-20 overflow-hidden rounded-full ring-4 ring-primary-500/30">
                <Image src={avatarUrl(currentSeed)} alt={displayName} fill className="object-cover" />
              </div>
              <AvatarPickerDialog currentSeed={currentSeed} onSelect={(seed) => setAvatarSeed(sessionUser.id, seed)} />
            </div>
            <p className="text-xs text-lunex-gray">اضغط على أيقونة القلم لتغيير صورتك الرمزية.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">اسم العرض</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">اسم المستخدم</Label>
              <div className="relative">
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-lunex-gray">@</span>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={24}
                  className="ps-7"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">نبذة تعريفية</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="اكتب شيئاً عن نفسك..."
            />
            <p className="text-end text-xs text-lunex-gray">{bio.length}/280</p>
          </div>

          {error && <FieldMessage kind="error" text={error} />}
          {success && <FieldMessage kind="success" text="تم حفظ التغييرات بنجاح." />}

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            حفظ التغييرات
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!currentPassword) {
      setError("يرجى إدخال كلمة المرور الحالية.");
      return;
    }
    if (newPassword.length < 12) {
      setError("يجب أن تتكون كلمة المرور الجديدة من 12 حرفاً على الأقل.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور الجديدتان غير متطابقتين.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "تعذر تغيير كلمة المرور.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" /> كلمة المرور
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pe-9"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-lunex-gray hover:text-white"
                aria-label={showCurrent ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pe-9"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-lunex-gray hover:text-white"
                  aria-label={showNew ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <Input
                id="confirmPassword"
                type={showNew ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-lunex-gray">12 حرفاً على الأقل.</p>

          {error && <FieldMessage kind="error" text={error} />}
          {success && <FieldMessage kind="success" text="تم تغيير كلمة المرور بنجاح." />}

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            تغيير كلمة المرور
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PreferencesCard() {
  const newChapterAlerts = usePreferences((s) => s.newChapterAlerts);
  const setNewChapterAlerts = usePreferences((s) => s.setNewChapterAlerts);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" /> التفضيلات
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="newChapterAlerts" className="flex items-center gap-2 text-white">
            إشعارات الفصول الجديدة
          </Label>
          <Switch id="newChapterAlerts" checked={newChapterAlerts} onCheckedChange={setNewChapterAlerts} />
        </div>
      </CardContent>
    </Card>
  );
}

function AvatarPickerDialog({ currentSeed, onSelect }: { currentSeed: string; onSelect: (seed: string) => void }) {
  const [open, setOpen] = useState(false);

  function pick(seed: string) {
    onSelect(seed);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" className="hover-pop absolute bottom-0 end-0 h-7 w-7 rounded-full shadow-lg" aria-label="تغيير الصورة الرمزية">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>اختر صورتك الرمزية</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 pt-2 sm:grid-cols-6">
          {AVATAR_PRESET_SEEDS.map((seed) => (
            <button
              key={seed}
              type="button"
              onClick={() => pick(seed)}
              className={cn(
                "hover-pop relative h-16 w-16 overflow-hidden rounded-full ring-2 transition-transform",
                seed === currentSeed ? "ring-primary-400" : "ring-white/10"
              )}
            >
              <Image src={avatarUrl(seed)} alt="خيار صورة رمزية" fill className="object-cover" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
