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
  invalid_amount: "الكمية يجب أن تكون عددًا صحيحًا بين 1 و100000.",
  insufficient_permissions: "هذا الإجراء للمالك والمشرف الأعلى فقط.",
  invalid_setting: "أحد الأرقام خارج الحدود المسموحة.",
};

type SettingKey = "lockedWindow" | "freeFirstChapters" | "chaptersPerCredit" | "coinPrice";

interface SettingsView {
  values: Record<SettingKey, number>;
  limits: Record<SettingKey, { min: number; max: number }>;
}

const SETTING_FIELDS: { key: SettingKey; icon: typeof Lock; label: string; hint?: string }[] = [
  { key: "lockedWindow", icon: Lock, label: "الفصول المقفلة من أحدث كل عمل", hint: "صفر = لا يُقفل أي فصل تلقائيًا، فيقرأ الجميع مجانًا." },
  { key: "freeFirstChapters", icon: Lock, label: "أول فصول كل عمل تبقى مجانية" },
  { key: "chaptersPerCredit", icon: BookOpenCheck, label: "فصول تُنهى لرصيد قراءة واحد" },
  { key: "coinPrice", icon: Coins, label: "سعر فتح الفصل بالعملات" },
];

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
  const [saved, setSaved] = useState<SettingsView | null>(null);
  const [settingsDenied, setSettingsDenied] = useState(false);
  const [draft, setDraft] = useState<Record<SettingKey, string> | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const showSaved = useCallback((view: SettingsView) => {
    setSaved(view);
    setDraft({
      lockedWindow: String(view.values.lockedWindow),
      freeFirstChapters: String(view.values.freeFirstChapters),
      chaptersPerCredit: String(view.values.chaptersPerCredit),
      coinPrice: String(view.values.coinPrice),
    });
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/wallet/settings", { cache: "no-store" });
        if (res.status === 403) return setSettingsDenied(true);
        if (res.ok) showSaved((await res.json()) as SettingsView);
      } catch {
        // the numbers simply stay hidden until the page is opened again
      }
    })();
  }, [showSaved]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!saved || !draft || savingSettings) return;
    const body = Object.fromEntries(SETTING_FIELDS.map(({ key }) => [key, Number(draft[key])]));
    const bad = SETTING_FIELDS.find(({ key }) => {
      const { min, max } = saved.limits[key];
      const n = Number(draft[key]);
      return draft[key].trim() === "" || !Number.isInteger(n) || n < min || n > max;
    });
    if (bad) {
      const { min, max } = saved.limits[bad.key];
      return setSettingsMessage({ ok: false, text: `«${bad.label}» يجب أن يكون عددًا صحيحًا بين ${min} و${max}.` });
    }
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await fetch("/api/admin/wallet/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json().catch(() => null);
      if (res.ok) {
        showSaved(result as SettingsView);
        setSettingsMessage({ ok: true, text: "تم الحفظ، ويسري الآن على كل الزوار." });
        void useWallet.getState().refresh();
      } else {
        setSettingsMessage({ ok: false, text: ERRORS[result?.code] ?? "تعذر حفظ الإعدادات." });
      }
    } catch {
      setSettingsMessage({ ok: false, text: "تعذر الاتصال بالخادم." });
    } finally {
      setSavingSettings(false);
    }
  }

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
              <Input id="grant-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="مثلًا: تحويل بتاريخ ..." />
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
          <CardTitle>إعدادات القفل</CardTitle>
          <CardDescription>
            {settingsDenied
              ? "تغيير هذه الأرقام للمالك والمشرف الأعلى فقط."
              : "تُحفظ هنا وتسري فورًا على كل الزوار، بدون Railway. القفل اليدوي لفصل معيّن (من إدارة الفصول) يبقى كما هو."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsDenied || (!draft && !saved) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {SETTING_FIELDS.map(({ key, icon: Icon, label }) => (
                <div key={key} className="panel flex items-center justify-between gap-3 p-3">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm text-white">
                    <Icon className="h-4 w-4 shrink-0 text-primary-300" /> {label}
                  </p>
                  <span className="font-display text-lg font-black text-white">{wallet?.[key] ?? "…"}</span>
                </div>
              ))}
            </div>
          ) : (
            draft &&
            saved && (
              <form onSubmit={saveSettings} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {SETTING_FIELDS.map(({ key, icon: Icon, label, hint }) => (
                    <div key={key} className="panel space-y-1.5 p-3">
                      <Label htmlFor={`setting-${key}`} className="flex items-center gap-1.5 text-sm text-white">
                        <Icon className="h-4 w-4 shrink-0 text-primary-300" /> {label}
                      </Label>
                      <Input
                        id={`setting-${key}`}
                        type="number"
                        inputMode="numeric"
                        min={saved.limits[key].min}
                        max={saved.limits[key].max}
                        value={draft[key]}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        disabled={savingSettings}
                      />
                      {hint && <p className="text-[11px] leading-relaxed text-lunex-gray">{hint}</p>}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-lunex-gray">
                  القفل التلقائي الآن:{" "}
                  <span className={saved.values.lockedWindow === 0 ? "font-bold text-emerald-400" : "font-bold text-amber-300"}>
                    {saved.values.lockedWindow === 0 ? "متوقف — الجميع يقرأ كل الفصول" : `يُقفل أحدث ${saved.values.lockedWindow} فصول من كل عمل`}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={savingSettings}>
                    {savingSettings && <Loader2 className="h-4 w-4 animate-spin" />} حفظ الإعدادات
                  </Button>
                  {settingsMessage && (
                    <span className={settingsMessage.ok ? "text-sm text-emerald-400" : "text-sm text-red-400"} role={settingsMessage.ok ? "status" : "alert"}>
                      {settingsMessage.text}
                    </span>
                  )}
                </div>
              </form>
            )
          )}
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
