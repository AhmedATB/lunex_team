"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, BookOpenCheck, Lock, Loader2 } from "lucide-react";
import { useWallet } from "@/store/wallet";
import { timeAgo } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface LedgerRow {
  id: string;
  username: string;
  amount: number;
  reason: "grant" | "unlock";
  note: string | null;
  createdAt: string;
}

const REASONS: Record<LedgerRow["reason"], string> = { grant: "منح عملات", unlock: "فتح فصل" };

const ERRORS: Record<string, string> = {
  user_not_found: "لا يوجد عضو بهذا اسم المستخدم.",
  invalid_amount: "الكمية يجب أن تكون عدداً صحيحاً بين 1 و100000.",
  insufficient_permissions: "هذا الإجراء للمالك والمدير العام فقط.",
};

export default function AdminMonetizationPage() {
  useEffect(() => {
    document.title = "العملات والقفل | LUNEX TEAM";
  }, []);

  const wallet = useWallet((s) => s.wallet);
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [ledgerDenied, setLedgerDenied] = useState(false);

  const loadLedger = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/wallet/transactions?limit=50", { cache: "no-store" });
      if (res.status === 403) return setLedgerDenied(true);
      if (res.ok) setLedger((await res.json()) as LedgerRow[]);
    } catch {
      // the list simply stays as it was
    }
  }, []);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/wallet/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), amount: Number(amount), note: note.trim() || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setMessage({ ok: true, text: `أُضيف ${body.granted} عملة إلى ${body.username}. رصيده الآن ${body.coins}.` });
        setAmount("");
        setNote("");
        void loadLedger();
      } else {
        setMessage({ ok: false, text: ERRORS[body?.code] ?? (Array.isArray(body?.message) ? body.message.join("، ") : body?.message) ?? "تعذر تنفيذ العملية." });
      }
    } catch {
      setMessage({ ok: false, text: "تعذر الاتصال بالخادم." });
    } finally {
      setBusy(false);
    }
  }

  const settings = [
    { icon: Lock, label: "الفصول المقفلة من أحدث كل عمل", value: wallet?.lockedWindow, env: "LOCKED_CHAPTER_COUNT" },
    { icon: Lock, label: "أول فصول كل عمل تبقى مجانية", value: wallet?.freeFirstChapters, env: "FREE_FIRST_CHAPTERS" },
    { icon: BookOpenCheck, label: "فصول تُنهى لرصيد قراءة واحد", value: wallet?.chaptersPerCredit, env: "CHAPTERS_PER_CREDIT" },
    { icon: Coins, label: "سعر فتح الفصل بالعملات", value: wallet?.coinPrice, env: "CHAPTER_COIN_PRICE" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="section-title font-display text-2xl font-bold text-white">العملات والقفل</h1>
        <p className="mt-2 text-sm text-lunex-gray">
          الفصول الجديدة تُفتح بالقراءة (رصيد قراءة) أو بالعملات. العملات تُضاف هنا بعد استلام الدفع خارج الموقع.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>منح عملات لعضو</CardTitle>
          <CardDescription>للمالك والمدير العام فقط. كل عملية تُسجَّل في السجل أدناه ولا تُحذف.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={grant} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="grant-username">اسم المستخدم</Label>
              <Input id="grant-username" dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoComplete="off" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-amount">عدد العملات</Label>
              <Input id="grant-amount" type="number" min={1} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="grant-note">ملاحظة (اختياري)</Label>
              <Input id="grant-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="مثلاً: تحويل بتاريخ ..." />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy || !username.trim() || !amount}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} إضافة العملات
              </Button>
              {message && (
                <span className={message.ok ? "text-sm text-emerald-400" : "text-sm text-red-400"} role={message.ok ? "status" : "alert"}>
                  {message.text}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إعدادات القفل الحالية</CardTitle>
          <CardDescription>تُضبط من متغيرات Railway لخدمة الباك إند، وتنطبق فوراً بعد إعادة تشغيلها.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {settings.map(({ icon: Icon, label, value, env }) => (
            <div key={env} className="panel flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm text-white">
                  <Icon className="h-4 w-4 shrink-0 text-primary-300" /> {label}
                </p>
                <p className="mt-0.5 text-[11px] text-lunex-gray" dir="ltr">
                  {env}
                </p>
              </div>
              <span className="font-display text-lg font-black text-white">{value ?? "…"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>آخر العمليات</CardTitle>
        </CardHeader>
        <CardContent>
          {ledgerDenied ? (
            <p className="text-sm text-lunex-gray">السجل للمالك والمدير العام فقط.</p>
          ) : ledger === null ? (
            <p className="text-sm text-lunex-gray">جارِ التحميل...</p>
          ) : ledger.length === 0 ? (
            <p className="text-sm text-lunex-gray">لا توجد عمليات بعد.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {ledger.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-white" dir="ltr">
                      {row.username}
                    </p>
                    <p className="truncate text-xs text-lunex-gray">
                      {REASONS[row.reason]}
                      {row.note ? ` · ${row.note}` : ""} · {timeAgo(row.createdAt)}
                    </p>
                  </div>
                  <span className={row.amount > 0 ? "font-bold tabular-nums text-emerald-400" : "font-bold tabular-nums text-amber-300"} dir="ltr">
                    {row.amount > 0 ? "+" : ""}
                    {row.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
