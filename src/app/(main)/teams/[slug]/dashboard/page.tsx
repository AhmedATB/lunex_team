"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Users, Layers, BookOpen, Star, ShieldAlert, ArrowUp, ArrowDown, Trash2,
  Plus, Check, X, HandHeart, Clock, ClipboardList, Crown, Settings,
} from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useSession } from "@/store/session";
import { useTeamManagement, applyTeamOverride } from "@/store/team-management";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import {
  TEAM_ROLE_LABELS,
  TEAM_PERMISSION_LABELS,
  TEAM_PERMISSION_GROUPS,
  getTeamPermissions,
  canInTeam,
} from "@/lib/rbac";
import { CATEGORY_LABELS, DEPARTMENT_KIND_LABELS } from "@/lib/team-labels";
import { TEAM_COLOR_PALETTE } from "@/lib/team-colors";
import { roleTierAvatarClass, roleTierAnimationClass } from "@/lib/role-tier";
import { avatarUrl, cn, formatNumber, safeDecodeURIComponent, timeAgo } from "@/lib/utils";
import type {
  TeamRole, SeriesProductionRole, CollaborationType, RecruitmentApplication, CustomRole, Team, TeamCategory, User,
  Department, DepartmentKind, RecruitmentPosition, Series, SeriesType, SeriesStatus,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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

const PRODUCTION_ROLES: SeriesProductionRole[] = ["translator", "editor", "proofreader", "qc", "publisher"];

const COLLAB_TYPE_LABELS: Record<CollaborationType, string> = {
  need_translator: "بحاجة مترجم",
  need_editor: "بحاجة محرر",
  need_proofreader: "بحاجة مدقق لغوي",
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
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const rawTeam = [...db.teams, ...store.createdTeams].find((t) => t.slug === slug);
  const team = rawTeam ? applyTeamOverride(rawTeam, store.teamInfoOverrides) : undefined;

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
  const isLeader = currentUser?.id === team.leaderId;
  const effectiveTeamRole = currentUser ? store.memberRoleOverrides[currentUser.id]?.teamRole ?? currentUser.teamRole : undefined;
  const isAssistantLeader = isMember && effectiveTeamRole === "assistant_leader";
  const canAccessDashboard = isLeader || isAssistantLeader || isGlobalAdmin;

  // Dashboard access is intentionally narrower than "team member": only the team
  // leader, their assistant leader, and platform admins manage the team here —
  // other roles (translators, QC, etc.) only get the public team page.
  if (!currentUser || !canAccessDashboard) {
    return (
      <div className="container flex flex-col items-center gap-4 py-24 text-center">
        <ShieldAlert className="h-14 w-14 text-red-400" />
        <h1 className="font-display text-2xl font-bold text-white">وصول مرفوض</h1>
        <p className="max-w-sm text-sm text-lunex-gray">
          هذه اللوحة مخصصة لقائد فريق {team.name} ونائبه ومشرفي المنصة فقط.
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

  const removedRoleIds = new Set(store.removedCustomRoleIds);
  const customRoles: CustomRole[] = [
    ...db.customRoles.filter((r) => r.teamId === team.id),
    ...store.addedCustomRoles.filter((r) => r.teamId === team.id),
  ]
    .filter((r) => !removedRoleIds.has(r.id))
    .map((r) => ({ ...r, ...store.customRoleOverrides[r.id] }));

  const teamSeries = [
    ...db.series.filter((s) => s.teamId === team.id),
    ...store.addedSeries.filter((s) => s.teamId === team.id),
  ];
  const removedDeptIds = new Set(store.removedDepartmentIds);
  const teamDepartments = [
    ...db.departments.filter((d) => d.teamId === team.id),
    ...store.addedDepartments.filter((d) => d.teamId === team.id),
  ]
    .filter((d) => !removedDeptIds.has(d.id))
    .map((d) => ({ ...d, ...store.departmentOverrides[d.id] }));

  const recruitmentPositions = [
    ...db.recruitmentPositions.filter((p) => p.teamId === team.id),
    ...store.addedRecruitmentPositions.filter((p) => p.teamId === team.id),
  ].map((p) => ({ ...p, ...store.recruitmentPositionOverrides[p.id] }));

  const canManage = isGlobalAdmin || canInTeam(currentUser, "manage_members", customRoles) || currentUser.id === team.leaderId;
  const canManageRoles = isGlobalAdmin || canInTeam(currentUser, "manage_roles", customRoles) || currentUser.id === team.leaderId;
  const canEditInfo = isGlobalAdmin || canInTeam(currentUser, "edit_team_info", customRoles) || currentUser.id === team.leaderId;

  const activityLog = [
    ...db.teamActivityLog.filter((a) => a.teamId === team.id),
    ...store.addedActivity.filter((a) => a.teamId === team.id),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="art-glow shine relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl font-display text-xl font-black text-white"
          style={team.logoUrl ? undefined : { background: `linear-gradient(135deg, ${team.color}, #C084FC)` }}
        >
          {team.logoUrl ? (
            <Image src={team.logoUrl} alt={team.name} fill className="object-cover" unoptimized />
          ) : (
            team.name[0]
          )}
        </div>
        <div>
          <h1 className="section-title font-display text-2xl font-black text-white sm:text-3xl">لوحة إدارة {team.name}</h1>
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
          {(canEditInfo || isGlobalAdmin) && <TabsTrigger value="settings">الإعدادات</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="الأعضاء" value={members.length} />
            <StatCard icon={Layers} label="المشاريع" value={teamSeries.length} />
            <StatCard icon={BookOpen} label="الفصول المنشورة" value={teamSeries.reduce((s, x) => s + x.chapterCount, 0)} />
            <StatCard icon={Star} label="متوسط التقييم" value={Number((teamSeries.reduce((s, x) => s + x.rating, 0) / (teamSeries.length || 1)).toFixed(1))} />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>الأقسام</CardTitle>
              {canManage && (
                <CreateDepartmentDialog
                  teamId={team.id}
                  members={members}
                  onCreate={(d) => store.createDepartment(d, currentUser.id)}
                />
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {teamDepartments.map((d) => {
                const leader = members.find((m) => m.id === d.leaderId);
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-2 border-b-2 border-white/10 pb-2 last:border-0">
                    <Badge variant="secondary" className="shrink-0">{d.nameAr} · {d.memberIds.length}</Badge>
                    {leader && <span className="text-xs text-lunex-gray">رئيس القسم: {leader.displayName}</span>}
                    {canManage && (
                      <div className="ms-auto flex shrink-0 gap-1">
                        <EditDepartmentDialog
                          department={d}
                          members={members}
                          onSave={(patch) => store.updateDepartment(d.id, patch, team.id, currentUser.id)}
                        />
                        <Button
                          size="icon" variant="ghost" aria-label="حذف القسم" className="text-red-400 hover:bg-red-500/10"
                          onClick={() => store.removeDepartment(d.id, team.id, currentUser.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
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
            const isLeader = m.id === team.leaderId;
            return (
              <Card key={m.id} className="panel-hover">
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div
                    className={cn(
                      "relative h-10 w-10 shrink-0 overflow-hidden rounded-full",
                      roleTierAvatarClass(m.teamRole, isLeader),
                      roleTierAnimationClass(m.teamRole, isLeader)
                    )}
                  >
                    <Image src={avatarUrl(effectiveAvatarSeed(m, avatarOverrides))} alt={m.displayName} fill className="object-cover" />
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
          {canManage && (
            <div className="flex justify-end">
              <CreateSeriesDialog
                teamId={team.id}
                genres={db.genres}
                onCreate={(s) => store.createSeries(s, currentUser.id)}
              />
            </div>
          )}
          {teamSeries.map((s) => (
            <Card key={s.id} className="panel-hover">
              <CardHeader><CardTitle className="text-base">{s.titleAr}</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PRODUCTION_ROLES.map((role) => {
                  const override = store.seriesAssignmentOverrides.find((a) => a.seriesId === s.id && a.role === role);
                  const base = db.seriesAssignments.find((a) => a.seriesId === s.id && a.role === role);
                  const currentUserIdForRole = override?.userId ?? base?.userId ?? "none";
                  return (
                    <div key={role} className="space-y-1">
                      <Label className="text-xs">{TEAM_ROLE_LABELS[role]}</Label>
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
              {(["team_leader", "assistant_leader", "team_administrator", "publisher", "qc", "editor", "proofreader", "translator", "member"] as TeamRole[]).map((role) => (
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
                  {canManageRoles && (
                    <div className="ms-auto flex shrink-0 gap-1">
                      <CreateCustomRoleDialog
                        teamId={team.id}
                        existingRole={r}
                        onCreate={store.createCustomRole}
                        onSave={(patch) => store.updateCustomRole(r.id, patch, team.id, currentUser.id)}
                      />
                      <Button
                        size="icon" variant="ghost" aria-label="حذف الدور" className="text-red-400 hover:bg-red-500/10"
                        onClick={() => store.removeCustomRole(r.id, team.id, currentUser.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {customRoles.length === 0 && <p className="text-sm text-lunex-gray">لا توجد أدوار مخصصة بعد.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recruitment" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>الوظائف المفتوحة</CardTitle>
              {canManage && <CreateRecruitmentPositionDialog teamId={team.id} onCreate={(p) => store.createRecruitmentPosition(p, currentUser.id)} />}
            </CardHeader>
            <CardContent className="space-y-2">
              {recruitmentPositions.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2 border-b-2 border-white/10 pb-2 last:border-0">
                  <Badge variant={p.isOpen ? "success" : "secondary"}>{TEAM_ROLE_LABELS[p.role]}</Badge>
                  <span className="text-xs text-lunex-gray">{p.description}</span>
                  {canManage && (
                    <Button
                      size="sm" variant="secondary" className="ms-auto shrink-0"
                      onClick={() => store.toggleRecruitmentPosition(p.id, team.id, !p.isOpen, currentUser.id)}
                    >
                      {p.isOpen ? "إغلاق" : "إعادة فتح"}
                    </Button>
                  )}
                </div>
              ))}
              {recruitmentPositions.length === 0 && (
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
                <Card key={application.id} className="panel-hover">
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/30">
                      <Image src={avatarUrl(effectiveAvatarSeed(applicant, avatarOverrides))} alt={applicant.displayName} fill className="object-cover" />
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
                    <Card key={c.id} className="panel-hover">
                      <CardContent className="flex flex-wrap items-center gap-3 p-4">
                        <HandHeart className="hover-pop h-5 w-5 shrink-0 text-primary-300" />
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

        {(canEditInfo || isGlobalAdmin) && (
          <TabsContent value="settings" className="space-y-4">
            {canEditInfo && (
              <TeamInfoSettingsForm
                team={team}
                onSave={(patch) => store.updateTeamInfo(team.id, patch, currentUser.id)}
              />
            )}
            {isGlobalAdmin && (
              <LeaderTransferPanel
                team={team}
                members={members}
                onTransfer={(toUserId, reason) => store.transferLeadership(team.id, team.leaderId, toUserId, currentUser.id, reason)}
              />
            )}
            {isGlobalAdmin && (
              <TeamStatusPanel
                team={team}
                onSetStatus={(status) => store.updateTeamInfo(team.id, { status }, currentUser.id)}
              />
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card className="panel-hover">
      <CardContent className="flex flex-col gap-1 p-4">
        <Icon className="hover-pop h-4 w-4 text-primary-300" />
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
  existingRole,
  onCreate,
  onSave,
}: {
  teamId: string;
  existingRole?: CustomRole;
  onCreate: (role: { teamId: string; name: string; nameAr: string; color: string; permissions: import("@/lib/types").TeamPermission[] }) => void;
  onSave?: (patch: { nameAr: string; name: string; color: string; permissions: import("@/lib/types").TeamPermission[] }) => void;
}) {
  const isEdit = Boolean(existingRole);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existingRole?.name ?? "");
  const [nameAr, setNameAr] = useState(existingRole?.nameAr ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(existingRole?.permissions ?? []));

  function toggle(p: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function submit() {
    if (!nameAr.trim()) return;
    const permissions = [...selected] as import("@/lib/types").TeamPermission[];
    if (isEdit) {
      onSave?.({ nameAr: nameAr.trim(), name: name.trim() || nameAr.trim(), color: existingRole!.color, permissions });
    } else {
      onCreate({ teamId, name: name.trim() || nameAr.trim(), nameAr: nameAr.trim(), color: "#6D28D9", permissions });
      setName(""); setNameAr(""); setSelected(new Set());
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="icon" variant="ghost" aria-label="تعديل الدور"><Settings className="h-4 w-4" /></Button>
        ) : (
          <Button size="sm"><Plus className="h-3.5 w-3.5" /> دور مخصص جديد</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? `تعديل دور ${existingRole!.nameAr}` : "إنشاء دور مخصص"}</DialogTitle></DialogHeader>
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
          <Button onClick={submit} className="w-full">{isEdit ? "حفظ التغييرات" : "إنشاء الدور"}</Button>
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

function TeamInfoSettingsForm({
  team,
  onSave,
}: {
  team: Team;
  onSave: (patch: Partial<Pick<Team, "name" | "description" | "goals" | "discordUrl" | "category" | "recruiting" | "logoUrl" | "color">>) => void;
}) {
  const [form, setForm] = useState({
    name: team.name,
    description: team.description,
    goals: team.goals,
    discordUrl: team.discordUrl ?? "",
    category: team.category,
    recruiting: team.recruiting,
    logoUrl: team.logoUrl ?? "",
    color: team.color,
  });
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name: form.name.trim() || team.name,
      description: form.description.trim(),
      goals: form.goals.trim(),
      discordUrl: form.discordUrl.trim(),
      category: form.category,
      recruiting: form.recruiting,
      logoUrl: form.logoUrl.trim() || undefined,
      color: form.color,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Settings className="h-4 w-4 text-primary-300" />
        <CardTitle>معلومات الفريق</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>شعار الفريق</Label>
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="art-glow shine relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl font-display text-2xl font-black text-white"
                style={{ background: `linear-gradient(135deg, ${form.color}, #C084FC)` }}
              >
                {form.logoUrl.trim() ? (
                  <Image src={form.logoUrl.trim()} alt="معاينة الشعار" fill className="object-cover" unoptimized />
                ) : (
                  (form.name.trim()[0] ?? "L").toUpperCase()
                )}
              </div>
              <div className="min-w-[220px] flex-1 space-y-1.5">
                <Input
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="رابط صورة الشعار (اختياري)"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {TEAM_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`اختر اللون ${c}`}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cn(
                    "hover-pop h-7 w-7 rounded-full border-2 transition-transform",
                    form.color === c ? "border-white scale-110" : "border-white/20"
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="teamName">اسم الفريق</Label>
            <Input id="teamName" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="teamDescription">وصف الفريق</Label>
            <Textarea
              id="teamDescription"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="teamGoals">أهداف الفريق</Label>
            <Textarea
              id="teamGoals"
              rows={2}
              value={form.goals}
              onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="teamDiscord">رابط سيرفر الديسكورد</Label>
              <Input
                id="teamDiscord"
                value={form.discordUrl}
                onChange={(e) => setForm((f) => ({ ...f, discordUrl: e.target.value }))}
                placeholder="https://discord.gg/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>تصنيف الفريق</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as TeamCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 p-3">
            <div>
              <p className="text-sm font-bold text-white">استقبال طلبات الانضمام</p>
              <p className="text-xs text-lunex-gray">فعّل هذا الخيار ليظهر فريقك كفريق يستقبل أعضاء جدد.</p>
            </div>
            <Switch checked={form.recruiting} onCheckedChange={(v) => setForm((f) => ({ ...f, recruiting: v }))} />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit">حفظ التغييرات</Button>
            {saved && <span className="text-sm text-emerald-400">تم الحفظ ✓</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LeaderTransferPanel({
  team,
  members,
  onTransfer,
}: {
  team: Team;
  members: (User & { teamRole?: TeamRole })[];
  onTransfer: (toUserId: string, reason: string) => void;
}) {
  const currentLeader = members.find((m) => m.id === team.leaderId);
  const candidates = members.filter((m) => m.id !== team.leaderId);
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  function submit() {
    if (!selectedId) return;
    onTransfer(selectedId, reason.trim());
    setSelectedId("");
    setReason("");
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <Card className="ring-2 ring-amber-400/20">
      <CardHeader className="flex-row items-center gap-2">
        <Crown className="h-4 w-4 text-amber-300" />
        <CardTitle>تعيين قائد الفريق</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-lunex-gray">صلاحية خاصة بمشرفي المنصة — تتيح نقل قيادة أي فريق إلى عضو آخر.</p>
        {currentLeader && (
          <div className="flex items-center gap-2 text-sm text-lunex-gray">
            <span>القائد الحالي:</span>
            <Badge variant="default">{currentLeader.displayName}</Badge>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>القائد الجديد</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="اختر عضواً" /></SelectTrigger>
              <SelectContent>
                {candidates.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>سبب النقل (اختياري)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تفرغ القائد السابق" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={!selectedId} variant="secondary">
            <Crown className="h-3.5 w-3.5" /> نقل القيادة
          </Button>
          {done && <span className="text-sm text-emerald-400">تم نقل القيادة ✓</span>}
        </div>
      </CardContent>
    </Card>
  );
}

const TEAM_STATUS_LABELS: Record<Team["status"], string> = { active: "نشط", suspended: "معلّق", archived: "مؤرشف" };

function TeamStatusPanel({
  team,
  onSetStatus,
}: {
  team: Team;
  onSetStatus: (status: Team["status"]) => void;
}) {
  return (
    <Card className="ring-2 ring-red-400/20">
      <CardHeader className="flex-row items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-red-400" />
        <CardTitle>حالة الفريق</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-lunex-gray">
          صلاحية خاصة بمشرفي المنصة — تعليق الفريق يخفي إمكانية استقبال طلبات جديدة، والأرشفة تُخرجه من قوائم الفرق النشطة.
        </p>
        <div className="flex items-center gap-2 text-sm text-lunex-gray">
          <span>الحالة الحالية:</span>
          <Badge variant={team.status === "active" ? "success" : team.status === "suspended" ? "warning" : "secondary"}>
            {TEAM_STATUS_LABELS[team.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={team.status === "active"} onClick={() => onSetStatus("active")}>
            تنشيط
          </Button>
          <Button size="sm" variant="secondary" disabled={team.status === "suspended"} onClick={() => onSetStatus("suspended")}>
            تعليق
          </Button>
          <Button size="sm" variant="destructive" disabled={team.status === "archived"} onClick={() => onSetStatus("archived")}>
            أرشفة
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const DEPARTMENT_KIND_OPTIONS: DepartmentKind[] = [
  "translation", "editing", "proofreading", "quality_control", "publishing", "media", "recruitment",
];

function CreateDepartmentDialog({
  teamId,
  members,
  onCreate,
}: {
  teamId: string;
  members: (User & { teamRole?: TeamRole })[];
  onCreate: (dept: Omit<Department, "id">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [kind, setKind] = useState<DepartmentKind>("translation");
  const [leaderId, setLeaderId] = useState<string>("none");

  function submit() {
    if (!nameAr.trim()) return;
    onCreate({
      teamId,
      kind,
      name: nameAr.trim(),
      nameAr: nameAr.trim(),
      leaderId: leaderId === "none" ? undefined : leaderId,
      memberIds: [],
    });
    setNameAr(""); setKind("translation"); setLeaderId("none"); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5" /> قسم جديد</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إنشاء قسم جديد</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>اسم القسم</Label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: قسم التدقيق اللغوي" />
          </div>
          <div className="space-y-1.5">
            <Label>نوع القسم</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as DepartmentKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENT_KIND_OPTIONS.map((k) => <SelectItem key={k} value={k}>{DEPARTMENT_KIND_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>رئيس القسم (اختياري)</Label>
            <Select value={leaderId} onValueChange={setLeaderId}>
              <SelectTrigger><SelectValue placeholder="بدون رئيس قسم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون رئيس قسم</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={submit} className="w-full">إنشاء القسم</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDepartmentDialog({
  department,
  members,
  onSave,
}: {
  department: Department;
  members: (User & { teamRole?: TeamRole })[];
  onSave: (patch: Partial<Pick<Department, "nameAr" | "leaderId" | "memberIds">>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nameAr, setNameAr] = useState(department.nameAr);
  const [leaderId, setLeaderId] = useState(department.leaderId ?? "none");
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set(department.memberIds));

  function toggleMember(id: string) {
    setMemberIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function submit() {
    onSave({
      nameAr: nameAr.trim() || department.nameAr,
      leaderId: leaderId === "none" ? undefined : leaderId,
      memberIds: [...memberIds],
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="تعديل القسم"><Settings className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>تعديل قسم {department.nameAr}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>اسم القسم</Label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>رئيس القسم</Label>
            <Select value={leaderId} onValueChange={setLeaderId}>
              <SelectTrigger><SelectValue placeholder="بدون رئيس قسم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون رئيس قسم</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>أعضاء القسم</Label>
            <div className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-xs text-lunex-gray">
                  <Checkbox checked={memberIds.has(m.id)} onCheckedChange={() => toggleMember(m.id)} />
                  {m.displayName}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={submit} className="w-full">حفظ التغييرات</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateRecruitmentPositionDialog({
  teamId,
  onCreate,
}: {
  teamId: string;
  onCreate: (pos: Omit<RecruitmentPosition, "id" | "createdAt" | "isOpen">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<TeamRole>("translator");
  const [description, setDescription] = useState("");

  function submit() {
    if (!description.trim()) return;
    onCreate({ teamId, role, description: description.trim() });
    setDescription(""); setRole("translator"); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5" /> فتح وظيفة</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>فتح وظيفة توظيف جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>الوظيفة المطلوبة</Label>
            <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["translator", "editor", "proofreader", "qc", "publisher"] as TeamRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{TEAM_ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>وصف الوظيفة</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="المتطلبات والمهام المتوقعة..." />
          </div>
          <Button onClick={submit} className="w-full">فتح الوظيفة</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SERIES_TYPE_LABELS: Record<SeriesType, string> = { manhwa: "مانهوا", manga: "مانجا", manhua: "مانها", novel: "رواية" };
const SERIES_STATUS_LABELS: Record<SeriesStatus, string> = { ongoing: "مستمر", completed: "مكتمل", hiatus: "متوقف مؤقتاً", dropped: "متروك" };

function CreateSeriesDialog({
  teamId,
  genres,
  onCreate,
}: {
  teamId: string;
  genres: { id: string; nameAr: string }[];
  onCreate: (series: Pick<Series, "title" | "titleAr" | "synopsis" | "type" | "status" | "country" | "author" | "artist" | "year" | "cover" | "banner" | "genreIds" | "tags" | "teamId">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [titleAr, setTitleAr] = useState("");
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [type, setType] = useState<SeriesType>("manhwa");
  const [status, setStatus] = useState<SeriesStatus>("ongoing");
  const [author, setAuthor] = useState("");
  const [cover, setCover] = useState("");
  const [genreIds, setGenreIds] = useState<Set<string>>(new Set());

  function toggleGenre(id: string) {
    setGenreIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!titleAr.trim() || !synopsis.trim()) return;
    const seed = `lunex-series-new-${Date.now()}`;
    onCreate({
      teamId,
      titleAr: titleAr.trim(),
      title: title.trim() || titleAr.trim(),
      synopsis: synopsis.trim(),
      type,
      status,
      country: "kr",
      author: author.trim() || "غير معروف",
      artist: author.trim() || "غير معروف",
      year: new Date().getFullYear(),
      cover: cover.trim() || `https://picsum.photos/seed/${seed}/480/680`,
      banner: cover.trim() || `https://picsum.photos/seed/${seed}-banner/1200/400`,
      genreIds: [...genreIds],
      tags: [],
    });
    setTitleAr(""); setTitle(""); setSynopsis(""); setAuthor(""); setCover(""); setGenreIds(new Set()); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5" /> إضافة سلسلة جديدة</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>إضافة سلسلة جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>اسم السلسلة (عربي)</Label>
            <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="مثال: عودة قناص العصور" />
          </div>
          <div className="space-y-1.5">
            <Label>اسم السلسلة (إنجليزي)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Return of the Ancient Sniper" />
          </div>
          <div className="space-y-1.5">
            <Label>القصة</Label>
            <Textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={3} placeholder="ملخص قصير عن أحداث السلسلة..." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={type} onValueChange={(v) => setType(v as SeriesType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SERIES_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SeriesStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SERIES_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>المؤلف/الرسّام (اختياري)</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="اسم المؤلف" />
          </div>
          <div className="space-y-1.5">
            <Label>رابط صورة الغلاف (اختياري)</Label>
            <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>التصنيفات</Label>
            <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
              {genres.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-xs text-lunex-gray">
                  <Checkbox checked={genreIds.has(g.id)} onCheckedChange={() => toggleGenre(g.id)} />
                  {g.nameAr}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={submit} className="w-full">إضافة السلسلة</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
