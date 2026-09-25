"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Ban, Check, Clock, Gavel, Loader2, ShieldAlert, TriangleAlert, Undo2 } from "lucide-react";
import { formatDateTime } from "@/lib/use-mute-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SanctionType = "warning" | "timeout" | "ban";

interface SanctionRow {
  id: string;
  type: SanctionType;
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  revokedBy: string | null;
  active: boolean;
}

interface Summary {
  user: { id: string; username: string; role: string; isBanned: boolean; bannedUntil: string | null; mutedUntil: string | null };
  canSanction: boolean;
  canBan: boolean;
  sanctions: SanctionRow[];
}

type Kind = "warning" | "timeout" | "temp_ban" | "perm_ban";

const KIND_LABELS: Record<Kind, string> = {
  warning: "تحذير",
  timeout: "تايم أوت (منع التعليق والمراسلة)",
  temp_ban: "حظر مؤقت",
  perm_ban: "حظر دائم",
};

const TYPE_LABELS: Record<SanctionType, string> = { warning: "تحذير", timeout: "تايم أوت", ban: "حظر" };

/** Moderators are capped at 30 days server-side; the two longest choices are for administrators only. */
const DURATIONS: { hours: number; label: string; adminOnly?: boolean }[] = [
  { hours: 1, label: "ساعة واحدة" },
  { hours: 6, label: "6 ساعات" },
  { hours: 24, label: "يوم" },
  { hours: 72, label: "3 أيام" },
  { hours: 168, label: "أسبوع" },
  { hours: 720, label: "30 يوماً" },
  { hours: 2160, label: "3 أشهر", adminOnly: true },
  { hours: 8760, label: "سنة", adminOnly: true },
];

const ERRORS: Record<string, string> = {
  insufficient_permissions: "لا تملك صلاحية لهذا الإجراء.",
  cannot_sanction_self: "لا يمكنك معاقبة نفسك.",
  cannot_sanction_owner: "لا يمكن معاقبة مالك المنصة.",
  cannot_sanction_equal_or_higher: "لا يمكنك معاقبة من هو بنفس رتبتك أو أعلى منها.",
  duration_too_long: "المشرف لا يستطيع إعطاء تايم أوت أطول من 30 يوماً.",
  already_banned: "هذا الحساب محظور بالفعل. ارفع الحظر أولاً.",
  sanction_not_active: "هذه العقوبة لم تعد سارية.",
  user_not_found: "لم يُعثر على الحساب.",
};

function errorMessage(body: { code?: string; message?: string } | null, status: number): string {
  if (body?.code && ERRORS[body.code]) return ERRORS[body.code];
  if (status === 400) return "تحقق من المدخلات: السبب يجب أن يكون 3 أحرف على الأقل.";
  if (status === 429) return "محاولات كثيرة، انتظر قليلاً.";
  return "تعذر تنفيذ الإجراء، حاول مرة أخرى.";
}

function statusOf(s: SanctionRow): { label: string; tone: "active" | "over" } {
  if (s.revokedAt) return { label: "مرفوعة", tone: "over" };
  if (s.type === "warning") return { label: "قائم", tone: "active" };
  if (s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()) return { label: "انتهت", tone: "over" };
  return { label: "سارية", tone: "active" };
}

/** Staff-only panel on a member's profile: current standing, sanction history, and the tools to warn, time out or ban. */
export function ModerationPanel({ userId }: { userId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [kind, setKind] = useState<Kind>("warning");
  const [hours, setHours] = useState(24);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/moderation/users/${encodeURIComponent(userId)}/sanctions`, { cache: "no-store" });
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setSummary(await res.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // A staff account that opens this panel without the rights (e.g. after being demoted) simply sees nothing.
  if (loadError || !summary) return null;

  const needsDuration = kind === "timeout" || kind === "temp_ban";
  const isBanKind = kind === "temp_ban" || kind === "perm_ban";
  const kinds = (Object.keys(KIND_LABELS) as Kind[]).filter((k) => summary.canBan || (k !== "temp_ban" && k !== "perm_ban"));
  const durations = DURATIONS.filter((d) => summary.canBan || !d.adminOnly);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (reason.trim().length < 3) {
      setError("اكتب سبب العقوبة (3 أحرف على الأقل). يراه صاحب الحساب.");
      return;
    }
    if (isBanKind && !window.confirm(kind === "perm_ban" ? "حظر هذا الحساب نهائياً؟" : "حظر هذا الحساب مؤقتاً؟")) return;

    const body =
      kind === "warning"
        ? { type: "warning", reason }
        : kind === "timeout"
          ? { type: "timeout", reason, durationHours: hours }
          : kind === "temp_ban"
            ? { type: "ban", reason, durationHours: hours }
            : { type: "ban", reason };

    setBusy("create");
    try {
      const res = await fetch(`/api/moderation/users/${encodeURIComponent(userId)}/sanctions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(errorMessage(await res.json().catch(() => null), res.status));
        return;
      }
      setReason("");
      setDone("تم تطبيق الإجراء وإبلاغ صاحب الحساب.");
      await load();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setBusy(null);
    }
  }

  async function lift(s: SanctionRow) {
    setError("");
    setDone("");
    setBusy(s.id);
    try {
      const res = await fetch(`/api/moderation/users/${encodeURIComponent(userId)}/sanctions/${encodeURIComponent(s.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(errorMessage(await res.json().catch(() => null), res.status));
        return;
      }
      setDone(s.type === "warning" ? "تم سحب التحذير." : "تم رفع العقوبة.");
      await load();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setBusy(null);
    }
  }

  const { user } = summary;

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-amber-300" /> الإشراف
          <span className="text-xs font-normal text-lunex-gray">(يظهر للمشرفين فقط)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {user.isBanned && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Ban className="h-3 w-3" />
              {user.bannedUntil ? `محظور حتى ${formatDateTime(new Date(user.bannedUntil))}` : "محظور نهائياً"}
            </Badge>
          )}
          {user.mutedUntil && (
            <Badge variant="warning" className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> تايم أوت حتى {formatDateTime(new Date(user.mutedUntil))}
            </Badge>
          )}
          {!user.isBanned && !user.mutedUntil && <span className="text-sm text-lunex-gray">لا توجد عقوبة سارية على هذا الحساب.</span>}
        </div>

        {summary.canSanction ? (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mod-kind">الإجراء</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                  <SelectTrigger id="mod-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kinds.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {needsDuration && (
                <div className="space-y-1.5">
                  <Label htmlFor="mod-duration">المدة</Label>
                  <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
                    <SelectTrigger id="mod-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {durations.map((d) => (
                        <SelectItem key={d.hours} value={String(d.hours)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-reason">السبب (يراه صاحب الحساب)</Label>
              <Textarea id="mod-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button type="submit" variant={isBanKind ? "destructive" : "default"} disabled={busy !== null}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : isBanKind ? <Ban className="h-4 w-4" /> : <Gavel className="h-4 w-4" />}
              تطبيق الإجراء
            </Button>
          </form>
        ) : (
          <p className="text-sm text-lunex-gray">لا تملك صلاحية معاقبة هذا الحساب (رتبته مساوية لرتبتك أو أعلى).</p>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}
        {done && !error && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-400" role="status">
            <Check className="h-3.5 w-3.5 shrink-0" /> {done}
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white">سجل العقوبات ({summary.sanctions.length})</h3>
          {summary.sanctions.length === 0 ? (
            <p className="text-sm text-lunex-gray">لا يوجد سجل عقوبات لهذا الحساب.</p>
          ) : (
            <ul className="space-y-2">
              {summary.sanctions.map((s) => {
                const status = statusOf(s);
                const liftable = status.tone === "active" && (s.type !== "ban" || summary.canBan) && summary.canSanction;
                return (
                  <li key={s.id} className="panel space-y-1 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={s.type === "ban" ? "destructive" : s.type === "timeout" ? "warning" : "secondary"} className="flex items-center gap-1">
                        {s.type === "warning" ? <TriangleAlert className="h-3 w-3" /> : s.type === "ban" ? <Ban className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {TYPE_LABELS[s.type]}
                      </Badge>
                      <span className={status.tone === "active" ? "text-xs font-bold text-amber-300" : "text-xs text-lunex-gray"}>{status.label}</span>
                      <span className="text-xs text-lunex-gray">{formatDateTime(new Date(s.createdAt))}</span>
                      {liftable && (
                        <Button type="button" size="sm" variant="secondary" className="ms-auto" disabled={busy !== null} onClick={() => lift(s)}>
                          {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                          {s.type === "warning" ? "سحب" : "رفع"}
                        </Button>
                      )}
                    </div>
                    <p className="text-white">{s.reason}</p>
                    <p className="text-xs text-lunex-gray">
                      {s.createdBy ? `بواسطة @${s.createdBy}` : "بواسطة الإدارة"}
                      {s.expiresAt && ` · تنتهي ${formatDateTime(new Date(s.expiresAt))}`}
                      {!s.expiresAt && s.type === "ban" && " · دائم"}
                      {s.revokedAt && s.revokedBy && ` · رُفعت بواسطة @${s.revokedBy}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
