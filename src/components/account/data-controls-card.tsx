"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Database, Download, Loader2, Trash2 } from "lucide-react";
import { useSession } from "@/store/session";
import type { BackendPublicUser } from "@/lib/auth-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Backend messages are English by convention; the ones a person can actually hit here get Arabic copy. */
const DELETE_ERRORS: Record<string, string> = {
  invalid_password: "كلمة المرور غير صحيحة.",
  confirmation_mismatch: "اكتب اسم المستخدم كما هو تماماً.",
  owner_cannot_delete: "لا يمكن حذف حساب المالك. انقل الملكية إلى حساب آخر أولاً.",
};

/**
 * Everything the app keeps in this browser is under a `lunex-` key (comments,
 * bookmarks, messages, rewards, the cached profile...). Those stores are
 * device-local, so deleting the account has to clear them here too — the
 * server can't reach them.
 */
function clearLocalUserData() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("lunex-")) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked — nothing was stored, so nothing to clear.
  }
}

function InlineMessage({ kind, text }: { kind: "error" | "success"; text: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-sm ${kind === "error" ? "text-red-400" : "text-emerald-400"}`} role={kind === "error" ? "alert" : "status"}>
      {kind === "error" ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <Check className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </p>
  );
}

/** Self-service data rights: download a copy of what's stored, or erase the account for good. */
export function DataControlsCard({ user }: { user: BackendPublicUser }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  async function downloadData() {
    setExportError("");
    setExporting(true);
    try {
      const res = await fetch("/api/users/me/export", { cache: "no-store" });
      if (!res.ok) {
        setExportError(res.status === 429 ? "طلبات كثيرة، حاول بعد قليل." : "تعذر تجهيز الملف، حاول مرة أخرى.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `lunex-data-${user.username}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" /> بياناتك وحسابك
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white">تنزيل نسخة من بياناتك</h3>
          <p className="text-sm leading-relaxed text-lunex-gray">
            ملف JSON يضم كل ما نحفظه عن حسابك: بياناتك الأساسية، والحسابات المرتبطة، وسجل الدخول، وسجل وصولك للفصول.
          </p>
          <Button type="button" variant="secondary" onClick={downloadData} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            تنزيل بياناتي
          </Button>
          {exportError && <InlineMessage kind="error" text={exportError} />}
        </div>

        <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <h3 className="text-sm font-bold text-red-300">حذف الحساب نهائياً</h3>
          <p className="text-sm leading-relaxed text-lunex-gray">
            يُحذف حسابك وجلساتك وأجهزتك وإشعاراتك والحسابات المرتبطة به، ولا يمكن التراجع. تبقى فقط السجلات الأمنية التقنية إلى أن تنتهي مدة
            حفظها ثم تُحذف تلقائياً، كما في{" "}
            <Link href="/privacy" className="text-primary-300 underline-offset-2 hover:underline">
              سياسة الخصوصية
            </Link>
            .
          </p>
          {user.role === "owner" ? (
            <p className="text-sm text-amber-300">حساب المالك لا يُحذف من هنا. انقل الملكية إلى حساب آخر أولاً.</p>
          ) : (
            <DeleteAccountDialog user={user} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteAccountDialog({ user }: { user: BackendPublicUser }) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);

  const needsPassword = user.hasPassword;

  function leave() {
    // Re-clear in case a store persisted something between the delete and now.
    clearLocalUserData();
    useSession.getState().setUser(null);
    window.location.assign("/");
  }

  function handleOpenChange(next: boolean) {
    if (loading) return;
    if (deleted) {
      leave();
      return;
    }
    setOpen(next);
    if (!next) {
      setSecret("");
      setError("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!secret) {
      setError(needsPassword ? "أدخل كلمة المرور للتأكيد." : "اكتب اسم المستخدم للتأكيد.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsPassword ? { password: secret } : { confirmUsername: secret }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(DELETE_ERRORS[body?.code] ?? (res.status === 429 ? "محاولات كثيرة، حاول لاحقاً." : "تعذر حذف الحساب، حاول مرة أخرى."));
        return;
      }
      clearLocalUserData();
      setDeleted(true);
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive">
          <Trash2 className="h-4 w-4" />
          حذف حسابي
        </Button>
      </DialogTrigger>
      <DialogContent>
        {deleted ? (
          <div className="space-y-4 text-center">
            <DialogHeader className="text-center">
              <DialogTitle>تم حذف حسابك</DialogTitle>
              <DialogDescription>حذفنا حسابك ومسحنا بيانات LUNEX المحفوظة في هذا المتصفح. نتمنى لك التوفيق.</DialogDescription>
            </DialogHeader>
            <Button type="button" onClick={leave}>
              العودة للرئيسية
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            <DialogHeader>
              <DialogTitle>حذف الحساب نهائياً؟</DialogTitle>
              <DialogDescription>
                لا يمكن التراجع عن هذا الإجراء. لن تستطيع استعادة حسابك أو الفصول التي فتحتها.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">
                {needsPassword ? "أدخل كلمة المرور للتأكيد" : (
                  <>
                    اكتب اسم المستخدم <span dir="ltr" className="font-mono text-white">{user.username}</span> للتأكيد
                  </>
                )}
              </Label>
              <Input
                id="delete-confirm"
                type={needsPassword ? "password" : "text"}
                autoComplete={needsPassword ? "current-password" : "off"}
                dir={needsPassword ? undefined : "ltr"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>

            {error && <InlineMessage kind="error" text={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={loading}>
                إلغاء
              </Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                نعم، احذف حسابي
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
