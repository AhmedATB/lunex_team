"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Users, Layers, BookOpen, Star, ShieldAlert, ArrowUp, ArrowDown, Trash2,
  Plus, Check, X, HandHeart, Clock, ClipboardList,
} from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useSession } from "@/store/session";
import { useTeamManagement } from "@/store/team-management";
import {
  TEAM_ROLE_LABELS,
  TEAM_PERMISSION_LABELS,
  TEAM_PERMISSION_GROUPS,
  getTeamPermissions,
  canInTeam,
} from "@/lib/rbac";
import { avatarUrl, formatNumber, safeDecodeURIComponent, timeAgo } from "@/lib/utils";
import type {
  TeamRole, SeriesProductionRole, CollaborationType, RecruitmentApplication, CustomRole,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const PROMOTION_LADDER: TeamRole[] = ["trainee", "member", "team_administrator", "assistant_leader"];
function promote(role: TeamRole): TeamRole {
  const idx = PROMOTION_LADDER.indexOf(role);
  if (idx === -1) return "team_administrator";
  return PROMOTION_LADDER[Math.min(idx + 1, PROMOTION_LADDER.length - 1)];
}
function demote(role: TeamRole): TeamRole {
  const idx = PROMOTION_LADDER.indexOf(role);
  if (idx === -1) return "member";
  return PROMOTION_LADDER[Math.max(idx - 1, 0)];
}

const PRODUCTION_ROLES: SeriesProductionRole[] = ["translator", "proofreader", "cleaner", "redrawer", "typesetter", "qc", "publisher"];
const PRODUCTION_ROLE_LABELS: Record<SeriesProductionRole, string> = {
  translator: "مترجم", proofreader: "مدقق", cleaner: "منظف", redrawer: "رسّام",
  typesetter: "منسّق", qc: "مراقب جودة", publisher: "ناشر",
};

const COLLAB_TYPE_LABELS: Record<CollaborationType, string> = {
  need_translator: "بحاجة مترجم",
  need_cleaner: "بحاجة منظف صور",
  need_typesetter: "بحاجة منسّق",
  need_qc: "بحاجة مراقب جودة",
  need_publisher: "بحاجة ناشر",
  need_complete_team_support: "بحاجة دعم فريق كامل",
  emergency_assistance: "مساعدة طارئة",
};

const APPLICATION_STATUS_LABELS: Record<RecruitmentApplication["status"], string> = {
  pending: "قيد المراجعة", accepted: "مقبول", rejected: "مرفوض", interview: "مقابلة", waitlist: "قائمة انتظار",
};

export default function TeamDashboardPage() {
  const params = useParams<{ slug: string }>();
  const slug = safeDecodeURIComponent(params.slug);

  const db = useMemo(() => getMockDatabase(), []);
  const store = useTeamManagement();
  const team = [...db.teams, ...store.createdTeams].find((t) => t.slug === slug);

  const currentUserId = useSession((s) => s.currentUserId);
  const currentUser = db.users.find((u) => u.id === currentUserId);

  // Persisted stores rehydrate after mount (see StoreHydration), so both `team` and
  // `currentUser` reflect defaults on the very first client render after a hard reload.
  // Wait one tick before trusting "not found" / "access denied" or they flash incorrectly.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (team) document.title = `لوحة إدارة ${team.name} | LUNEX TEAM`;
  }, [team]);

  if (!ready) return null;

  if (!team) {
    return <div className="container py-16 text-center text-lunex-gray">الفريق غير موجود.</div>;
  }

  const isMember = currentUser?.teamId === team.id;
  const isGlobalAdmin = currentUser?.role === "owner" || currentUser?.role === "super_administrator";

  if (!currentUser || (!isMember && !isGlobalAdmin)) {
    return (
      <div className="container flex flex-col items-center gap-4 py-24 text-center">
        <ShieldAlert className="h-14 w-14 text-red-400" />
        <h1 className="font-display text-2xl font-bold text-white">وصول مرفوض</h1>
        <p className="max-w-sm text-sm text-lunex-gray">
          هذه لوحة إدارة خاصة بأعضاء فريق {team.name} فقط. جرّب تبديل الدور من قائمة الحساب للتجربة.
        </p>
        <Button asChild><Link href={`/teams/${team.slug}`}>عرض صفحة الفريق العامة</Link></Button>
      </div>
    );
  }

  const removedIds = new Set(store.removedMemberIds[team.id] ?? []);
  const activeMemberIds = team.memberIds.filter((id) => !removedIds.has(id));
  const members = activeMemberIds
    .map((id) => db.users.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => {
      const override = store.memberRoleOverrides[u!.id];
      return { ...u!, teamRole: override?.teamRole ?? u!.teamRole, customRoleId: override?.customRoleId ?? u!.customRoleId };
    });

  const customRoles: CustomRole[] = [
    ...db.customRoles.filter((r) => r.teamId === team.id),
    ...store.addedCustomRoles.filter((r) => r.teamId === team.id),
  ];

  const teamSeries = db.series.filter((s) => s.teamId === team.id);
  const teamDepartments = db.departments.filter((d) => d.teamId === team.id);
  const canManage = isGlobalAdmin || canInTeam(currentUser, "manage_members", customRoles) || currentUser.id === team.leaderId;
  const canManageRoles = isGlobalAdmin || canInTeam(currentUser, "manage_roles", customRoles) || currentUser.id === team.leaderId;

  const activityLog = [
    ...db.teamActivityLog.filter((a) => a.teamId === team.id),
    ...store.addedActivity.filter((a) => a.teamId === team.id),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl font-display text-xl font-black text-white"
          style={{ background: `linear-gradient(135deg, ${team.color}, #C084FC)` }}
        >
          {team.name[0]}
        </div>
        <div>
          <h1 className="font-display text-2xl font-black text-white sm:text-3xl">لوحة إدارة {team.name}</h1>
          <p className="text-sm text-lunex-gray">إدارة الأعضاء والمشاريع والصلاحيات الخاصة بالفريق.</p>
        </div>
        <Badge className="ms-auto" variant={team.status === "active" ? "success" : "warning"}>
          {team.status === "active" ? "نشط" : team.status === "suspended" ? "معلّق" : "مؤرشف"}
        </Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="members">الأعضاء</TabsTrigger>
          <TabsTrigger value="series">السلاسل</TabsTrigger>
          <TabsTrigger value="roles">الأدوار والصلاحيات</TabsTrigger>
          <TabsTrigger value="recruitment">التوظيف</TabsTrigger>
          <TabsTrigger value="collaboration">التعاون</TabsTrigger>
          <TabsTrigger value="activity">سجل النشاط</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="الأعضاء" value={members.length} />
            <StatCard icon={Layers} label="المشاريع" value={teamSeries.length} />
            <StatCard icon={BookOpen} label="الفصول المنشورة" value={teamSeries.reduce((s, x) => s + x.chapterCount, 0)} />
            <StatCard icon={Star} label="متوسط التقييم" value={Number((teamSeries.reduce((s, x) => s + x.rating, 0) / (teamSeries.length || 1)).toFixed(1))} />
          </div>

          <Card>
            <CardHeader><CardTitle>الأقسام</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {teamDepartments.map((d) => (
                <Badge key={d.id} variant="secondary">{d.nameAr} · {d.memberIds.length}</Badge>
              ))}
              {teamDepartments.length === 0 && <p className="text-sm text-lunex-gray">لا توجد أقسام بعد.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>آخر النشاطات</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {activityLog.slice(0, 5).map((a) => (
                <ActivityRow key={a.id} entry={a} users={db.users} />
              ))}
              {activityLog.length === 0 && <p className="text-sm text-lunex-gray">لا يوجد نشاط مسجل بعد.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-3">
          {members.map((m) => {
            const customRole = customRoles.find((r) => r.id === m.customRoleId);
            return (
              <Card key={m.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20">
                    <Image src={avatarUrl(m.avatarSeed)} alt={m.displayName} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{m.displayName}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{TEAM_ROLE_LABELS[m.teamRole ?? "member"]}</Badge>
                      {customRole && <Badge variant="outline" className="text-[10px]">{customRole.nameAr}</Badge>}
                      {m.id === team.leaderId && <Badge variant="default" className="text-[10px]">قائد الفريق</Badge>}
                    </div>
                  </div>
                  {canManage && m.id !== team.leaderId && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon" variant="ghost" aria-label="ترقية"
                        onClick={() => store.setMemberRole(m.id, team.id, { teamRole: promote(m.teamRole ?? "member") }, currentUser.id, `رقّى ${m.displayName}`)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" aria-label="تنزيل رتبة"
                        onClick={() => store.setMemberRole(m.id, team.id, { teamRole: demote(m.teamRole ?? "member") }, currentUser.id, `نزّل رتبة ${m.displayName}`)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Select
                        value={m.customRoleId ?? "none"}
                        onValueChange={(v) => store.setMemberRole(m.id, team.id, { customRoleId: v === "none" ? undefined : v }, currentUser.id, `غيّر الدور المخصص لـ ${m.displayName}`)}
                      >
                        <SelectTrigger className="w-40"><SelectValue placeholder="دور مخصص" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">بدون دور مخصص</SelectItem>
                          {customRoles.map((r) => <SelectItem key={r.id} value={r.id}>{r.nameAr}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon" variant="ghost" aria-label="إزالة" className="text-red-400 hover:bg-red-500/10"
                        onClick={() => store.removeMember(m.id, team.id, currentUser.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="series" className="space-y-3">
          {teamSeries.map((s) => (
            <Card key={s.id}>
              <CardHeader><CardTitle className="text-base">{s.titleAr}</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PRODUCTION_ROLES.map((role) => {
                  const override = store.seriesAssignmentOverrides.find((a) => a.seriesId === s.id && a.role === role);
                  const base = db.seriesAssignments.find((a) => a.seriesId === s.id && a.role === role);
                  const currentUserIdForRole = override?.userId ?? base?.userId ?? "none";
                  return (
                    <div key={role} className="space-y-1">
                      <Label className="text-xs">{PRODUCTION_ROLE_LABELS[role]}</Label>
                      <Select
                        value={currentUserIdForRole}
                        onValueChange={(v) => store.setSeriesAssignment(s.id, role, v, currentUser.id)}
                        disabled={!canManage}
                      >
                        <SelectTrigger><SelectValue placeholder="غير معيّن" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">غير معيّن</SelectItem>
                          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
          {teamSeries.length === 0 && <div className="panel p-10 text-center text-lunex-gray">لا توجد سلاسل لهذا الفريق بعد.</div>}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>الأدوار الافتراضية</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(["team_leader", "assistant_leader", "team_administrator", "publisher", "qc", "typesetter", "translator", "member"] as TeamRole[]).map((role) => (
                <div key={role} className="flex flex-wrap items-center gap-2 border-b-2 border-white/10 pb-2 last:border-0">
                  <Badge variant="secondary" className="shrink-0">{TEAM_ROLE_LABELS[role]}</Badge>
                  <div className="flex flex-wrap gap-1">
                    {[...getTeamPermissions({ teamRole: role })].slice(0, 6).map((p) => (
                      <span key={p} className="text-[10px] text-lunex-gray">#{TEAM_PERMISSION_LABELS[p]}</span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>الأدوار المخصصة</CardTitle>
              {canManageRoles && <CreateCustomRoleDialog teamId={team.id} onCreate={store.createCustomRole} />}
            </CardHeader>
            <CardContent className="space-y-2">
              {customRoles.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 border-b-2 border-white/10 pb-2 last:border-0">
                  <Badge style={{ background: r.color }} className="shrink-0 border-white/70 text-white">{r.nameAr}</Badge>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.map((p) => (
                      <span key={p} className="text-[10px] text-lunex-gray">#{TEAM_PERMISSION_LABELS[p]}</span>
                    ))}
                  </div>
                </div>
              ))}
              {customRoles.length === 0 && <p className="text-sm text-lunex-gray">لا توجد أدوار مخصصة بعد.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recruitment" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>الوظائف المفتوحة</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {db.recruitmentPositions.filter((p) => p.teamId === team.id).map((p) => (
                <Badge key={p.id} variant="success">{TEAM_ROLE_LABELS[p.role]}</Badge>
              ))}
              {db.recruitmentPositions.filter((p) => p.teamId === team.id).length === 0 && (
                <p className="text-sm text-lunex-gray">لا توجد وظائف مفتوحة حالياً.</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {db.recruitmentApplications.filter((a) => a.teamId === team.id).map((application) => {
              const applicant = db.users.find((u) => u.id === application.userId);
              const status = store.applicationOverrides[application.id] ?? application.status;
              if (!applicant) return null;
              return (
                <Card key={application.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20">
                      <Image src={avatarUrl(applicant.avatarSeed)} alt={applicant.displayName} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">{applicant.displayName} — {TEAM_ROLE_LABELS[application.preferredRole]}</p>
                      <p className="text-xs text-lunex-gray">{application.experience}</p>
                      <p className="text-xs text-lunex-gray">اللغات: {application.languages.join("، ")} · {application.availability}</p>
                    </div>
                    <Badge variant={status === "accepted" ? "success" : status === "rejected" ? "destructive" : "warning"}>
                      {APPLICATION_STATUS_LABELS[status]}
                    </Badge>
                    {canManage && status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => store.reviewApplication(application.id, team.id, "accepted")}><Check className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="secondary" onClick={() => store.reviewApplication(application.id, team.id, "interview")}><Clock className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => store.reviewApplication(application.id, team.id, "rejected")}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {db.recruitmentApplications.filter((a) => a.teamId === team.id).length === 0 && (
              <div className="panel p-10 text-center text-lunex-gray">لا توجد طلبات انضمام بعد.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="collaboration" className="space-y-4">
          {canManage && <CreateCollaborationDialog teamId={team.id} teams={db.teams} series={teamSeries} onCreate={store.createCollaborationRequest} />}

          {(["وارد", "صادر"] as const).map((direction) => {
            const isIncoming = direction === "وارد";
            const base = [...db.collaborationRequests, ...store.addedCollaborationRequests].filter((c) =>
              isIncoming ? c.toTeamId === team.id : c.fromTeamId === team.id
            );
            return (
              <div key={direction} className="space-y-3">
                <h3 className="font-display text-sm font-black text-white">طلبات {direction === "وارد" ? "واردة" : "صادرة"}</h3>
                {base.map((c) => {
                  const otherTeam = db.teams.find((t) => t.id === (isIncoming ? c.fromTeamId : c.toTeamId));
                  const status = store.collaborationOverrides[c.id] ?? c.status;
                  const s = db.series.find((x) => x.id === c.seriesId);
                  return (
                    <Card key={c.id}>
                      <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <HandHeart className="h-5 w-5 shrink-0 text-primary-300" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white">{otherTeam?.name} — {COLLAB_TYPE_LABELS[c.type]}</p>
                          <p className="text-xs text-lunex-gray">{s?.titleAr} · {c.message}</p>
                        </div>
                        <Badge variant={status === "accepted" ? "success" : status === "rejected" ? "destructive" : "warning"}>
                          {status === "pending" ? "قيد الانتظار" : status === "accepted" ? "مقبول" : status === "rejected" ? "مرفوض" : "تفاوض"}
                        </Badge>
                        {isIncoming && canManage && status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => store.respondToCollaboration(c.id, team.id, "accepted")}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="secondary" onClick={() => store.respondToCollaboration(c.id, team.id, "negotiating")}>تفاوض</Button>
                            <Button size="sm" variant="destructive" onClick={() => store.respondToCollaboration(c.id, team.id, "rejected")}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {base.length === 0 && <p className="text-sm text-lunex-gray">لا توجد طلبات {direction === "وارد" ? "واردة" : "صادرة"}.</p>}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2">
          {activityLog.map((a) => <ActivityRow key={a.id} entry={a} users={db.users} />)}
          {activityLog.length === 0 && <div className="panel p-10 text-center text-lunex-gray">لا يوجد نشاط مسجل بعد.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <Icon className="h-4 w-4 text-primary-300" />
        <span className="font-display text-xl font-bold text-white">{formatNumber(value)}</span>
        <span className="text-xs text-lunex-gray">{label}</span>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ entry, users }: { entry: { id: string; userId: string; action: string; target?: string; at: string }; users: { id: string; displayName: string }[] }) {
  const user = users.find((u) => u.id === entry.userId);
  const target = users.find((u) => u.id === entry.target);
  return (
    <div className="flex items-start gap-2 border-b-2 border-white/10 py-2 text-sm last:border-0">
      <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-300" />
      <div className="min-w-0 flex-1">
        <p className="text-lunex-gray">
          <span className="font-bold text-white">{user?.displayName ?? "النظام"}</span> {entry.action}
          {target && <span className="text-primary-300"> — {target.displayName}</span>}
        </p>
        <p className="text-[11px] text-lunex-gray/60">{timeAgo(entry.at)}</p>
      </div>
    </div>
  );
}

function CreateCustomRoleDialog({
  teamId,
  onCreate,
}: {
  teamId: string;
  onCreate: (role: { teamId: string; name: string; nameAr: string; color: string; permissions: import("@/lib/types").TeamPermission[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(p: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function submit() {
    if (!nameAr.trim()) return;
    onCreate({
      teamId,
      name: name.trim() || nameAr.trim(),
      nameAr: nameAr.trim(),
      color: "#6D28D9",
      permissions: [...selected] as import("@/lib/types").TeamPermission[],
    });
    setName(""); setNameAr(""); setSelected(new Set()); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5" /> دور مخصص جديد</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>إنشاء دور مخصص</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>اسم الدور (عربي)</Label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: مترجم أول" />
          </div>
          <div className="space-y-1.5">
            <Label>اسم الدور (إنجليزي)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Senior Translator" />
          </div>
          <div className="space-y-3">
            {TEAM_PERMISSION_GROUPS.map((group) => (
              <div key={group.category}>
                <p className="mb-1.5 text-xs font-bold text-lunex-gray">{group.category}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {group.permissions.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-xs text-lunex-gray">
                      <Checkbox checked={selected.has(p)} onCheckedChange={() => toggle(p)} />
                      {TEAM_PERMISSION_LABELS[p]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button onClick={submit} className="w-full">إنشاء الدور</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateCollaborationDialog({
  teamId,
  teams,
  series,
  onCreate,
}: {
  teamId: string;
  teams: { id: string; name: string }[];
  series: { id: string; titleAr: string }[];
  onCreate: (req: { fromTeamId: string; toTeamId: string; seriesId: string; type: CollaborationType; message: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [toTeamId, setToTeamId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [type, setType] = useState<CollaborationType>("need_translator");
  const [message, setMessage] = useState("");

  function submit() {
    if (!toTeamId || !seriesId || !message.trim()) return;
    onCreate({ fromTeamId: teamId, toTeamId, seriesId, type, message: message.trim() });
    setToTeamId(""); setSeriesId(""); setMessage(""); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5" /> طلب تعاون جديد</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>طلب تعاون من فريق آخر</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>الفريق المستهدف</Label>
            <Select value={toTeamId} onValueChange={setToTeamId}>
              <SelectTrigger><SelectValue placeholder="اختر فريقاً" /></SelectTrigger>
              <SelectContent>
                {teams.filter((t) => t.id !== teamId).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>السلسلة</Label>
            <Select value={seriesId} onValueChange={setSeriesId}>
              <SelectTrigger><SelectValue placeholder="اختر سلسلة" /></SelectTrigger>
              <SelectContent>
                {series.map((s) => <SelectItem key={s.id} value={s.id}>{s.titleAr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>نوع الطلب</Label>
            <Select value={type} onValueChange={(v) => setType(v as CollaborationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COLLAB_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>الرسالة</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          <Button onClick={submit} className="w-full">إرسال الطلب</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
