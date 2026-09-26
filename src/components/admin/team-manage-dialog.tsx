"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Trash2 } from "lucide-react";
import type { Series, Team } from "@/lib/types";
import { MEMBER_ROLES, teamApi, type MemberRole, type TeamDetail, type TeamMemberInfo } from "@/lib/team-api";
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import { avatarSrcFor, useProfile } from "@/store/profile";
import { useToast } from "@/store/toast";
import { AddMemberForm } from "@/components/admin/add-member-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export interface TeamManageAbilities {
  /** Move works between teams (owner and editors). */
  transfer: boolean;
  /** Change a team's status and leader (owner and team managers). */
  status: boolean;
  /** Delete the team. */
  remove: boolean;
}

interface Props {
  team: Team | null;
  teams: Team[];
  series: Series[];
  can: TeamManageAbilities;
  /** Asks the page to re-read the catalogue after a change. */
  onChanged: () => void;
  onClose: () => void;
}

const STATUS_LABELS: Record<Team["status"], string> = { active: "نشط", suspended: "معلّق", archived: "مؤرشف" };

const say = (title: string, description?: string) => useToast.getState().push({ title, description });

/** The owner's window onto one team: its members, its works (and moving them elsewhere), and its settings. */
export function TeamManageDialog({ team, teams, series, can, onChanged, onClose }: Props) {
  return (
    <Dialog open={team !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        {team && <Body key={team.id} team={team} teams={teams} series={series} can={can} onChanged={onChanged} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ team, teams, series, can, onChanged, onClose }: Omit<Props, "team"> & { team: Team }) {
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const result = await teamApi.detail(team.slug);
    if (result.ok) {
      setDetail(result.body);
      setLoadError("");
    } else {
      setLoadError(result.message);
    }
  }, [team.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = useCallback(() => {
    void load();
    onChanged();
  }, [load, onChanged]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{team.name}</DialogTitle>
      </DialogHeader>
      <Tabs defaultValue="members" className="pt-2">
        <TabsList>
          <TabsTrigger value="members">الأعضاء</TabsTrigger>
          <TabsTrigger value="works">الأعمال</TabsTrigger>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-3">
          <AddMemberForm teamId={team.id} onAdded={changed} />
          <MembersList team={team} detail={detail} loadError={loadError} onChanged={changed} />
        </TabsContent>

        <TabsContent value="works" className="space-y-3">
          <WorksPanel team={team} teams={teams} series={series} canTransfer={can.transfer} onChanged={changed} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <SettingsPanel team={team} detail={detail} can={can} onChanged={changed} onDeleted={() => { onChanged(); onClose(); }} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function MembersList({ team, detail, loadError, onChanged }: { team: Team; detail: TeamDetail | null; loadError: string; onChanged: () => void }) {
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const [sure, setSure] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (loadError) return <p className="text-sm text-red-400" role="alert">{loadError}</p>;
  if (!detail) return <p className="flex items-center gap-2 text-sm text-lunex-gray"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل...</p>;
  if (detail.members.length === 0) return <p className="text-sm text-lunex-gray">لا يوجد أعضاء في هذا الفريق بعد.</p>;

  async function changeRole(member: TeamMemberInfo, role: MemberRole) {
    setBusy(member.id);
    const result = await teamApi.setMemberRole(team.id, member.id, role);
    setBusy(null);
    if (!result.ok) return say("تعذر تغيير الدور", result.message);
    onChanged();
  }

  async function remove(member: TeamMemberInfo) {
    if (sure !== member.id) {
      setSure(member.id);
      return;
    }
    setBusy(member.id);
    const result = await teamApi.removeMember(team.id, member.id);
    setBusy(null);
    setSure(null);
    if (!result.ok) return say("تعذرت الإزالة", result.message);
    say("أُزيل العضو", `${member.displayName} لم يعد في الفريق.`);
    onChanged();
  }

  return (
    <ul className="space-y-2">
      {detail.members.map((m) => {
        const isLeader = m.id === detail.team.leaderId;
        const inList = (MEMBER_ROLES as readonly string[]).includes(m.teamRole ?? "");
        return (
          <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 p-2.5">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
              <Image src={avatarSrcFor(m, avatarOverrides)} alt="" fill sizes="36px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{m.displayName}</p>
              <p dir="ltr" className="truncate text-start text-xs text-lunex-gray">@{m.username}</p>
            </div>
            {isLeader ? (
              <Badge>قائد الفريق</Badge>
            ) : (
              <>
                <Select value={inList ? m.teamRole : ""} onValueChange={(v) => changeRole(m, v as MemberRole)} disabled={busy === m.id}>
                  <SelectTrigger className="w-40" aria-label={`دور ${m.displayName}`}>
                    <SelectValue placeholder={TEAM_ROLE_LABELS[m.teamRole as keyof typeof TEAM_ROLE_LABELS] ?? "عضو"} />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((r) => <SelectItem key={r} value={r}>{TEAM_ROLE_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant={sure === m.id ? "destructive" : "ghost"}
                  disabled={busy === m.id}
                  onClick={() => remove(m)}
                  onBlur={() => setSure((s) => (s === m.id ? null : s))}
                  aria-label={`إزالة ${m.displayName}`}
                >
                  <Trash2 className="h-4 w-4" /> {sure === m.id ? "تأكيد الإزالة" : ""}
                </Button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function WorksPanel({ team, teams, series, canTransfer, onChanged }: { team: Team; teams: Team[]; series: Series[]; canTransfer: boolean; onChanged: () => void }) {
  const own = series.filter((s) => s.teamId === team.id);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);

  const others = teams.filter((t) => t.id !== team.id);
  const allPicked = own.length > 0 && picked.size === own.length;

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function move() {
    if (picked.size === 0 || !dest || busy) return;
    setBusy(true);
    const result = await teamApi.transferSeries([...picked], dest === "none" ? "" : dest);
    setBusy(false);
    if (!result.ok) return say("تعذر نقل الأعمال", result.message);
    const target = dest === "none" ? "بدون فريق" : (teams.find((t) => t.id === dest)?.name ?? "الفريق");
    say("تم النقل", `نُقل ${result.body.series} عمل${result.body.chapters ? ` و${result.body.chapters} فصل` : ""} إلى ${target}.`);
    setPicked(new Set());
    onChanged();
  }

  if (own.length === 0) return <p className="text-sm text-lunex-gray">لا توجد أعمال لهذا الفريق. يمكنك نقل أعمال إليه من صفحة «السلاسل».</p>;

  return (
    <>
      <label className="flex items-center gap-2 text-sm text-lunex-gray">
        <Checkbox checked={allPicked} onCheckedChange={() => setPicked(allPicked ? new Set() : new Set(own.map((s) => s.id)))} disabled={!canTransfer} />
        تحديد الكل ({own.length})
      </label>
      <ul className="max-h-64 space-y-1.5 overflow-y-auto pe-1">
        {own.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-2">
            {canTransfer && <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} aria-label={`تحديد ${s.titleAr}`} />}
            <div className="relative h-11 w-8 shrink-0 overflow-hidden rounded-md">
              <Image src={s.cover} alt="" fill sizes="32px" className="object-cover" unoptimized />
            </div>
            <p className="min-w-0 flex-1 truncate text-sm text-white">{s.titleAr}</p>
            <span className="shrink-0 text-xs text-lunex-gray">{s.chapterCount} فصل</span>
          </li>
        ))}
      </ul>
      {canTransfer ? (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
          <Select value={dest} onValueChange={setDest}>
            <SelectTrigger className="sm:flex-1" aria-label="الفريق الذي تُنقل إليه الأعمال"><SelectValue placeholder="انقل المحدد إلى فريق..." /></SelectTrigger>
            <SelectContent>
              {others.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              <SelectItem value="none">بدون فريق</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={move} disabled={busy || picked.size === 0 || !dest}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} نقل ({picked.size})
          </Button>
        </div>
      ) : (
        <p className="text-xs text-lunex-gray">نقل الأعمال بين الفرق للمالك والمحررين.</p>
      )}
      <p className="text-xs text-lunex-gray">تنتقل فصول العمل مع العمل إلى الفريق الجديد.</p>
    </>
  );
}

function SettingsPanel({ team, detail, can, onChanged, onDeleted }: { team: Team; detail: TeamDetail | null; can: TeamManageAbilities; onChanged: () => void; onDeleted: () => void }) {
  const currentLeader = detail?.members.find((m) => m.id === team.leaderId)?.username ?? "";
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [recruiting, setRecruiting] = useState(team.recruiting);
  const [status, setStatus] = useState<Team["status"]>(team.status);
  const [leader, setLeader] = useState<string | null>(null); // null = untouched
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sureDelete, setSureDelete] = useState(false);

  const leaderValue = leader ?? currentLeader;

  async function save() {
    if (name.trim().length < 2 || busy) return;
    setBusy(true);
    setError("");
    const result = await teamApi.update(team.id, {
      name: name.trim(),
      description,
      recruiting,
      ...(can.status ? { status } : {}),
      ...(can.status && leader !== null && leader.trim() !== currentLeader ? { leaderUsername: leader.trim().replace(/^@/, "") } : {}),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    say("حُفظت إعدادات الفريق");
    setLeader(null);
    onChanged();
  }

  async function remove() {
    if (!sureDelete) return setSureDelete(true);
    setBusy(true);
    const result = await teamApi.remove(team.id);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    say("حُذف الفريق", "بقيت أعماله في الموقع بلا فريق.");
    onDeleted();
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="team-name">اسم الفريق</Label>
        <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="team-desc">نبذة عن الفريق</Label>
        <Textarea id="team-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </div>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
        <span>
          <span className="block text-sm font-semibold text-white">يستقبل طلبات انضمام</span>
          <span className="block text-xs text-lunex-gray">تظهر شارة «يستقبل طلبات» على صفحة الفريق وقائمة الفرق.</span>
        </span>
        <Switch checked={recruiting} onCheckedChange={setRecruiting} />
      </label>
      {can.status && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>حالة الفريق</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Team["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as Team["status"][]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-leader">قائد الفريق (username)</Label>
            <Input id="team-leader" dir="ltr" value={leaderValue} onChange={(e) => setLeader(e.target.value)} placeholder="بلا قائد" autoComplete="off" />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <Button onClick={save} disabled={busy || name.trim().length < 2} className="w-full">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ الإعدادات
      </Button>

      {can.remove && (
        <div className="rounded-xl border border-red-500/30 p-3">
          <p className="text-sm font-semibold text-red-300">حذف الفريق</p>
          <p className="mb-2 text-xs text-lunex-gray">يُحذف الفريق وأعضاؤه، وتبقى أعماله في الموقع بلا فريق (يمكنك نقلها لفريق آخر).</p>
          <Button variant="destructive" size="sm" onClick={remove} disabled={busy} onBlur={() => setSureDelete(false)}>
            {sureDelete ? "اضغط مرة أخرى للتأكيد" : "حذف الفريق"}
          </Button>
        </div>
      )}
    </>
  );
}
