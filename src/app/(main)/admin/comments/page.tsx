"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Pin, PinOff, Trash2, EyeOff, ThumbsUp, ThumbsDown, Flag, X } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useSession } from "@/store/session";
import { useTeamManagement, applyTeamOverride } from "@/store/team-management";
import { useComments, mergeComments } from "@/store/comments";
import { getTeamAuthRoles, getEffectiveCustomRoles } from "@/lib/team-auth";
import { can, canInTeam } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { avatarUrl, timeAgo } from "@/lib/utils";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";

export default function AdminCommentsPage() {
  useEffect(() => {
    document.title = "إدارة التعليقات | LUNEX TEAM";
  }, []);
  const db = useMemo(() => getMockDatabase(), []);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const currentUserId = useSession((s) => s.currentUserId);
  const currentUser = db.users.find((u) => u.id === currentUserId);
  const teamStore = useTeamManagement();
  const commentsStore = useComments();
  const canManageReports = Boolean(currentUser && can(currentUser, "manage_reports"));
  const [reportedOnly, setReportedOnly] = useState(false);

  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const seriesMap = new Map(db.series.map((s) => [s.id, s]));

  const comments = mergeComments(db.comments, commentsStore)
    .filter((c) => !reportedOnly || (commentsStore.reports[c.id]?.length ?? 0) > 0)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 30);

  function canModerate(seriesTeamId: string) {
    if (!currentUser) return false;
    const rawTeam = [...db.teams, ...teamStore.createdTeams].find((t) => t.id === seriesTeamId);
    const team = rawTeam ? applyTeamOverride(rawTeam, teamStore.teamInfoOverrides) : undefined;
    const { isGlobalAdmin, isMember } = getTeamAuthRoles(team, currentUser, teamStore.memberRoleOverrides);
    if (isGlobalAdmin) return true;
    if (!isMember) return false;
    const customRoles = getEffectiveCustomRoles(
      seriesTeamId, db.customRoles, teamStore.addedCustomRoles, teamStore.customRoleOverrides, teamStore.removedCustomRoleIds
    );
    const override = teamStore.memberRoleOverrides[currentUser.id];
    const effectiveUser = { ...currentUser, customRoleId: override?.customRoleId ?? currentUser.customRoleId };
    return canInTeam(effectiveUser, "moderate_comments", customRoles);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-white">إدارة التعليقات</h1>
        {canManageReports && (
          <Button
            variant={reportedOnly ? "default" : "secondary"}
            size="sm"
            onClick={() => setReportedOnly((v) => !v)}
          >
            <Flag className="h-3.5 w-3.5" /> {reportedOnly ? "عرض الكل" : "المُبلّغ عنها فقط"}
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {comments.map((c) => {
          const user = userMap.get(c.userId);
          const series = seriesMap.get(c.seriesId);
          if (!user || !series) return null;
          const allowed = canModerate(series.teamId);
          const reports = commentsStore.reports[c.id] ?? [];
          return (
            <Card key={c.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                  <Image src={avatarUrl(effectiveAvatarSeed(user, avatarOverrides))} alt={user.displayName} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{user.displayName}</p>
                    <span className="text-xs text-lunex-gray">على {series.titleAr}</span>
                    {c.isPinned && <Badge variant="outline" className="text-[10px]">مثبّت</Badge>}
                    {c.isSpoiler && <Badge variant="outline" className="text-[10px]">مشوّش (حرق)</Badge>}
                    {canManageReports && reports.length > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1 text-[10px]">
                        <Flag className="h-2.5 w-2.5" /> {reports.length} بلاغ
                      </Badge>
                    )}
                    <span className="text-[11px] text-lunex-gray/70">
                      {timeAgo(c.createdAt)}
                      {c.editedAt && " · معدّل"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-lunex-gray">{c.content}</p>
                  {canManageReports && reports.length > 0 && (
                    <p className="mt-1 text-xs text-red-400">
                      أسباب البلاغ: {[...new Set(reports.map((r) => r.reason))].join("، ")}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-lunex-gray">
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {c.likes}</span>
                    <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> {c.dislikes}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canManageReports && reports.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="تجاهل البلاغ"
                      onClick={() => commentsStore.dismissReports(c.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {allowed && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={c.isPinned ? "إلغاء التثبيت" : "تثبيت"}
                        onClick={() => commentsStore.setPinned(c.id, !c.isPinned)}
                      >
                        {c.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={c.isSpoiler ? "إلغاء التشويش" : "تشويش (حرق)"}
                        onClick={() => commentsStore.setSpoiler(c.id, !c.isSpoiler)}
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="حذف"
                        className="text-red-400 hover:bg-red-500/10"
                        onClick={() => commentsStore.deleteComment(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {comments.length === 0 && (
          <div className="panel p-10 text-center text-lunex-gray">لا توجد تعليقات مطابقة.</div>
        )}
      </div>
    </div>
  );
}
