"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  Clock,
  Eraser,
  Gavel,
  Info,
  Loader2,
  LogOut,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  Undo2,
  UserCog,
} from "lucide-react";
import { GLOBAL_ROLE_LABELS } from "@/lib/rbac";
import type { GlobalRole } from "@/lib/types";
import { useSession } from "@/store/session";
import { formatDateTime } from "@/lib/use-mute-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SanctionType = "warning" | "timeout" | "ban";
type RecordType = SanctionType | "profile_reset" | "comments_removed";
type ProfilePart = "avatar" | "bio" | "displayName";

interface SanctionRow {
  id: string;
  type: RecordType;
  reason: string;
  details: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  revokedBy: string | null;
  active: boolean;
}

interface AccountInfo {
  email: string;
  createdAt: string;
  hasPassword: boolean;
  providers: string[];
  lastLoginAt: string | null;
  activeSessions: number;
  comments: number;
}

interface Summary {
  user: { id: string; username: string; role: string; isBanned: boolean; bannedUntil: string | null; mutedUntil: string | null };
  canSanction: boolean;
  canBan: boolean;
  account: AccountInfo | null;
  sanctions: SanctionRow[];
}

type Kind = "warning" | "timeout" | "temp_ban" | "perm_ban" | "reset_profile" | "remove_comments" | "sign_out";

const KIND_LABELS: Record<Kind, string> = {
  warning: "تحذير",
  timeout: "تايم أوت (منع التعليق والمراسلة)",
  temp_ban: "حظر مؤقت",
  perm_ban: "حظر دائم",
  reset_profile: "مسح جزء من الملف (صورة أو نبذة أو اسم)",
  remove_comments: "حذف كل تعليقات العضو",
  sign_out: "تسجيل خروج إجباري من كل الأجهزة",
};

const PART_LABELS: Record<ProfilePart, string> = { avatar: "الصورة الرمزية", bio: "النبذة", displayName: "الاسم المعروض" };
const PART_ORDER: ProfilePart[] = ["avatar", "bio", "displayName"];

const TYPE_LABELS: Record<RecordType, string> = {
  warning: "تحذير",
  timeout: "تايم أوت",
  ban: "حظر",
  profile_reset: "مسح من الملف",
  comments_removed: "حذف تعليقات",
};

/** Moderators are capped at 30 days server-side; the two longest choices are for administrators only. */
const DURATIONS: { hours: number; label: string; adminOnly?: boolean }[] = [
  { hours: 1, label: "ساعة واحدة" },
  { hours: 6, label: "6 ساعات" },
  { hours: 24, label: "يوم" },
  { hours: 72, label: "3 أيام" },
  { hours: 168, label: "أسبوع" },
  { hours: 720, label: "30 يومًا" },
  { hours: 2160, label: "3 أشهر", adminOnly: true },
  { hours: 8760, label: "سنة", adminOnly: true },
];

const ERRORS: Record<string, string> = {
  insufficient_permissions: "لا تملك صلاحية لهذا الإجراء.",
  cannot_sanction_self: "لا يمكنك تنفيذ هذا على نفسك.",
  cannot_sanction_owner: "لا يمكن تنفيذ هذا على مالك المنصة.",
  cannot_sanction_equal_or_higher: "لا يمكنك تنفيذ هذا على من هو بنفس رتبتك أو أعلى منها.",
  duration_too_long: "المشرف لا يستطيع إعطاء تايم أوت أطول من 30 يومًا.",
  already_banned: "هذا الحساب محظور بالفعل. ارفع الحظر أولًا.",
  sanction_not_active: "هذه العقوبة لم تعد سارية.",
  sanction_not_revocable: "هذا الإجراء لا يُرفع.",
  user_not_found: "لم يُعثر على الحساب.",
};

const PROVIDER_LABELS: Record<string, string> = { discord: "Discord", google: "Google" };

function errorMessage(body: { code?: string; message?: string } | null, status: number): string {
  if (body?.code && ERRORS[body.code]) return ERRORS[body.code];
  if (status === 400) return "تحقق من المدخلات: السبب يجب أن يكون 3 أحرف على الأقل.";
  if (status === 429) return "محاولات كثيرة، انتظر قليلًا.";
  return "تعذر تنفيذ الإجراء، حاول مرة أخرى.";
}

const LASTING: RecordType[] = ["warning", "timeout", "ban"];

function statusOf(s: SanctionRow): { label: string; tone: "active" | "over" } {
  if (!LASTING.includes(s.type)) return { label: "نُفّذ", tone: "over" };
  if (s.revokedAt) return { label: "مرفوعة", tone: "over" };
  if (s.type === "warning") return { label: "قائم", tone: "active" };
  if (s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()) return { label: "انتهت", tone: "over" };
  return { label: "سارية", tone: "active" };
}

/** "الصورة الرمزية، النبذة" for a profile reset; "5 تعليقات" for a bulk removal. */
function describeDetails(s: SanctionRow): string | null {
  if (!s.details) return null;
  if (s.type === "profile_reset") {
    return s.details
      .split(",")
      .map((p) => PART_LABELS[p as ProfilePart])
      .filter(Boolean)
      .join("، ");
  }
  if (s.type === "comments_removed") return `${s.details} تعليق`;
  return null;
}

/** Staff-only panel on a member's profile: standing, record, and every tool a moderator or administrator has for that account. */
export function ModerationPanel({ userId }: { userId: string }) {
  const viewerRole = useSession((s) => s.user?.role);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [kind, setKind] = useState<Kind>("warning");
  const [hours, setHours] = useState(24);
  const [parts, setParts] = useState<Set<ProfilePart>>(new Set());
  const [reason, setReason] = useState("");
  const [newRole, setNewRole] = useState<string | null>(null);
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
  const needsReason = kind !== "sign_out";
  const isDestructive = isBanKind || kind === "remove_comments" || kind === "sign_out";
  const kinds = (Object.keys(KIND_LABELS) as Kind[]).filter((k) => summary.canBan || (k !== "temp_ban" && k !== "perm_ban"));
  const durations = DURATIONS.filter((d) => summary.canBan || !d.adminOnly);
  const { user, account } = summary;

  function togglePart(part: ProfilePart) {
    setParts((current) => {
      const next = new Set(current);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  }

  async function call(method: "POST" | "DELETE", path: string, body?: unknown) {
    return fetch(`/api/moderation/users/${encodeURIComponent(userId)}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    if (needsReason && reason.trim().length < 3) {
      setError("اكتب سبب الإجراء (3 أحرف على الأقل). يراه صاحب الحساب.");
      return;
    }
    if (kind === "reset_profile" && parts.size === 0) {
      setError("اختر جزءًا واحدًا على الأقل لمسحه.");
      return;
    }
    const confirmations: Partial<Record<Kind, string>> = {
      perm_ban: "حظر هذا الحساب نهائيًا؟",
      temp_ban: "حظر هذا الحساب مؤقتًا؟",
      remove_comments: "حذف كل تعليقات هذا العضو؟ يظهر ذلك في سجله ويُبلَّغ به.",
      sign_out: "إنهاء كل جلسات هذا الحساب على كل الأجهزة؟",
    };
    const confirmation = confirmations[kind];
    if (confirmation && !window.confirm(confirmation)) return;

    let path: string;
    let body: unknown;
    if (kind === "warning") {
      path = "/sanctions";
      body = { type: "warning", reason };
    } else if (kind === "timeout") {
      path = "/sanctions";
      body = { type: "timeout", reason, durationHours: hours };
    } else if (kind === "temp_ban") {
      path = "/sanctions";
      body = { type: "ban", reason, durationHours: hours };
    } else if (kind === "perm_ban") {
      path = "/sanctions";
      body = { type: "ban", reason };
    } else if (kind === "reset_profile") {
      path = "/reset-profile";
      body = { parts: PART_ORDER.filter((p) => parts.has(p)), reason };
    } else if (kind === "remove_comments") {
      path = "/remove-comments";
      body = { reason };
    } else {
      path = "/sign-out";
      body = undefined;
    }

    setBusy("create");
    try {
      const res = await call("POST", path, body);
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorMessage(result, res.status));
        return;
      }
      setReason("");
      setParts(new Set());
      if (kind === "remove_comments") setDone(result?.removed ? `حُذف ${result.removed} تعليق وأُبلغ صاحب الحساب.` : "لا توجد تعليقات لحذفها.");
      else if (kind === "sign_out") setDone(`أُنهيت ${result?.sessionsEnded ?? 0} جلسة. سيحتاج صاحب الحساب لتسجيل الدخول من جديد.`);
      else setDone("تم تطبيق الإجراء وإبلاغ صاحب الحساب.");
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
      const res = await call("DELETE", `/sanctions/${encodeURIComponent(s.id)}`);
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

  async function changeRole() {
    if (!newRole || newRole === user.role) return;
    setError("");
    setDone("");
    if (!window.confirm(`تغيير دور هذا الحساب إلى «${GLOBAL_ROLE_LABELS[newRole as GlobalRole] ?? newRole}»؟`)) return;
    setBusy("role");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        setError(errorMessage(await res.json().catch(() => null), res.status));
        return;
      }
      setNewRole(null);
      setDone("تم تغيير الدور وإبلاغ صاحب الحساب.");
      await load();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setBusy(null);
    }
  }

  // Only the owner may hand out the owner role; the backend enforces it, the list just doesn't offer it to anyone else.
  const roleChoices = (Object.keys(GLOBAL_ROLE_LABELS) as GlobalRole[]).filter((r) => r !== "guest" && (r !== "owner" || viewerRole === "owner"));

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
              {user.bannedUntil ? `محظور حتى ${formatDateTime(new Date(user.bannedUntil))}` : "محظور نهائيًا"}
            </Badge>
          )}
          {user.mutedUntil && (
            <Badge variant="warning" className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> تايم أوت حتى {formatDateTime(new Date(user.mutedUntil))}
            </Badge>
          )}
          {!user.isBanned && !user.mutedUntil && <span className="text-sm text-lunex-gray">لا توجد عقوبة سارية على هذا الحساب.</span>}
        </div>

        {account && (
          <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-1.5 text-white sm:col-span-2">
              <Info className="h-3.5 w-3.5 text-primary-300" /> معلومات الحساب <span className="text-xs text-lunex-gray">(للمسؤولين فقط)</span>
            </div>
            <Fact label="البريد الإلكتروني" value={account.email} ltr />
            <Fact label="تاريخ الانضمام" value={formatDateTime(new Date(account.createdAt))} />
            <Fact label="آخر تسجيل دخول" value={account.lastLoginAt ? formatDateTime(new Date(account.lastLoginAt)) : "لم يسجّل دخولًا بعد"} />
            <Fact label="الجلسات النشطة" value={String(account.activeSessions)} />
            <Fact
              label="طريقة الدخول"
              value={[account.hasPassword ? "كلمة مرور" : null, ...account.providers.map((p) => PROVIDER_LABELS[p] ?? p)].filter(Boolean).join(" + ") || "—"}
            />
            <Fact label="التعليقات الظاهرة" value={String(account.comments)} />
          </dl>
        )}

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

            {kind === "reset_profile" && (
              <fieldset className="space-y-1.5">
                <legend className="text-sm text-white">ما الذي يُمسح؟</legend>
                <div className="flex flex-wrap gap-4">
                  {PART_ORDER.map((part) => (
                    <label key={part} className="flex items-center gap-1.5 text-sm text-lunex-gray">
                      <input type="checkbox" checked={parts.has(part)} onChange={() => togglePart(part)} className="h-3.5 w-3.5 accent-primary-500" />
                      {PART_LABELS[part]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {needsReason ? (
              <div className="space-y-1.5">
                <Label htmlFor="mod-reason">السبب (يراه صاحب الحساب)</Label>
                <Textarea id="mod-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            ) : (
              <p className="text-xs text-lunex-gray">إجراء أمني: لا يُسجَّل كعقوبة ولا يُبلَّغ به صاحب الحساب، ويُدوَّن في سجل التدقيق.</p>
            )}

            <Button type="submit" variant={isDestructive ? "destructive" : "default"} disabled={busy !== null}>
              {busy === "create" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : kind === "sign_out" ? (
                <LogOut className="h-4 w-4" />
              ) : kind === "reset_profile" ? (
                <Eraser className="h-4 w-4" />
              ) : kind === "remove_comments" ? (
                <Trash2 className="h-4 w-4" />
              ) : isBanKind ? (
                <Ban className="h-4 w-4" />
              ) : (
                <Gavel className="h-4 w-4" />
              )}
              تطبيق الإجراء
            </Button>
          </form>
        ) : (
          <p className="text-sm text-lunex-gray">لا تملك صلاحية معاقبة هذا الحساب (رتبته مساوية لرتبتك أو أعلى).</p>
        )}

        {summary.canBan && summary.canSanction && (
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <Label htmlFor="mod-role" className="flex items-center gap-1.5 text-white">
              <UserCog className="h-3.5 w-3.5 text-primary-300" /> دور الحساب
              <span className="text-xs font-normal text-lunex-gray">
                (الحالي: {GLOBAL_ROLE_LABELS[user.role as GlobalRole] ?? user.role})
              </span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={newRole ?? user.role} onValueChange={setNewRole}>
                <SelectTrigger id="mod-role" className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleChoices.map((r) => (
                    <SelectItem key={r} value={r}>
                      {GLOBAL_ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" disabled={busy !== null || !newRole || newRole === user.role} onClick={changeRole}>
                {busy === "role" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} تغيير الدور
              </Button>
            </div>
          </div>
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
          <h3 className="text-sm font-bold text-white">سجل الإجراءات ({summary.sanctions.length})</h3>
          {summary.sanctions.length === 0 ? (
            <p className="text-sm text-lunex-gray">لا يوجد سجل إجراءات لهذا الحساب.</p>
          ) : (
            <ul className="space-y-2">
              {summary.sanctions.map((s) => {
                const status = statusOf(s);
                const detail = describeDetails(s);
                const liftable = status.tone === "active" && (s.type !== "ban" || summary.canBan) && summary.canSanction;
                return (
                  <li key={s.id} className="panel space-y-1 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={s.type === "ban" ? "destructive" : s.type === "timeout" ? "warning" : "secondary"} className="flex items-center gap-1">
                        {s.type === "warning" ? (
                          <TriangleAlert className="h-3 w-3" />
                        ) : s.type === "ban" ? (
                          <Ban className="h-3 w-3" />
                        ) : s.type === "timeout" ? (
                          <Clock className="h-3 w-3" />
                        ) : s.type === "profile_reset" ? (
                          <Eraser className="h-3 w-3" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        {TYPE_LABELS[s.type] ?? s.type}
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
                    {detail && <p className="text-xs text-primary-300">{detail}</p>}
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

function Fact({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-lunex-gray">{label}</dt>
      <dd className="truncate text-white" dir={ltr ? "ltr" : undefined} title={value}>
        {value}
      </dd>
    </div>
  );
}
