"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, Eye, Search, Lock } from "lucide-react";
import type { Chapter } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo, formatNumber } from "@/lib/utils";
import { useReadingProgress } from "@/store/reader-settings";
import { useRewards, isChapterLocked } from "@/store/rewards";
import { useSession } from "@/store/session";
import { useTeamManagement, applyTeamOverride } from "@/store/team-management";
import { getTeamAuthRoles, getEffectiveCustomRoles } from "@/lib/team-auth";
import { canInTeam } from "@/lib/rbac";
import { getMockDatabase } from "@/lib/mock/generate";
import { ChapterAdminMenu } from "@/components/series/chapter-admin-menu";

export function ChapterList({ seriesSlug, chapters, teamId }: { seriesSlug: string; chapters: Chapter[]; teamId: string }) {
  const [query, setQuery] = useState("");
  const [asc, setAsc] = useState(false);
  const seriesId = chapters[0]?.seriesId;
  const lastRead = useReadingProgress((s) => (seriesId ? s.getProgress(seriesId) : undefined));
  const lockedChapterCount = useRewards((s) => s.settings.lockedChapterCount);
  const unlockedChapters = useRewards((s) => s.unlockedChapters);

  const store = useTeamManagement();
  const currentUserId = useSession((s) => s.currentUserId);
  const db = useMemo(() => getMockDatabase(), []);
  const currentUser = db.users.find((u) => u.id === currentUserId);
  const rawTeam = [...db.teams, ...store.createdTeams].find((t) => t.id === teamId);
  const team = rawTeam ? applyTeamOverride(rawTeam, store.teamInfoOverrides) : undefined;

  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const { isGlobalAdmin, isLeader, isAssistantLeader } = getTeamAuthRoles(team, currentUser, store.memberRoleOverrides);
  const customRoles = getEffectiveCustomRoles(
    teamId, db.customRoles, store.addedCustomRoles, store.customRoleOverrides, store.removedCustomRoleIds
  );
  const currentUserOverride = currentUser ? store.memberRoleOverrides[currentUser.id] : undefined;
  const effectiveCurrentUser = currentUser
    ? { ...currentUser, customRoleId: currentUserOverride?.customRoleId ?? currentUser.customRoleId }
    : undefined;
  const hasCustomChapterPermission = Boolean(
    effectiveCurrentUser &&
      (canInTeam(effectiveCurrentUser, "upload_chapter", customRoles) ||
        canInTeam(effectiveCurrentUser, "edit_chapter", customRoles) ||
        canInTeam(effectiveCurrentUser, "delete_chapter", customRoles))
  );
  const canManage = ready && Boolean(currentUser) && (isGlobalAdmin || isLeader || isAssistantLeader || hasCustomChapterPermission);

  const removedIds = new Set(store.removedChapterIds);
  const effectiveChapters = chapters
    .filter((c) => !removedIds.has(c.id))
    .map((c) => ({ ...c, ...store.chapterOverrides[c.id] }));

  const latestNumber = useMemo(
    () => effectiveChapters.reduce((max, c) => Math.max(max, c.number), 0),
    [effectiveChapters]
  );

  const list = useMemo(() => {
    let items = effectiveChapters.filter((c) => c.number.toString().includes(query) || c.title.includes(query));
    items = [...items].sort((a, b) => (asc ? a.number - b.number : b.number - a.number));
    return items;
  }, [effectiveChapters, query, asc]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن رقم الفصل..."
            className="ps-9"
          />
        </div>
        <Button variant="secondary" size="icon" onClick={() => setAsc((v) => !v)} aria-label="ترتيب">
          <ArrowDownUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="panel max-h-[560px] overflow-y-auto">
        {list.map((c) => {
          const manualLock = store.chapterLockOverrides[c.id];
          const locked = seriesId
            ? isChapterLocked(c.number, latestNumber, lockedChapterCount, unlockedChapters, seriesId, manualLock)
            : false;
          return (
            <div
              key={c.id}
              className="group relative flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-sm transition-colors last:border-0 hover:bg-primary-600/10"
            >
              <span className="absolute inset-y-0 start-0 w-0.5 scale-y-0 bg-lunex-gradient transition-transform duration-300 group-hover:scale-y-100" />
              <Link href={`/series/${seriesSlug}/${c.number}`} className="absolute inset-0" aria-label={c.title} />
              <div className="pointer-events-none min-w-0">
                <p className="flex items-center gap-1.5 truncate font-medium text-white">
                  {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="فصل مقفل" />}
                  {c.title}
                  {!c.isPublished && <Badge variant="secondary" className="text-[10px]">مسودة</Badge>}
                  {lastRead === c.number && (
                    <span className="ms-2 rounded-full bg-primary-500/20 px-2 py-0.5 text-[10px] text-primary-300 shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                      آخر قراءة
                    </span>
                  )}
                </p>
                <p className="text-xs text-lunex-gray">{timeAgo(c.releasedAt)}</p>
              </div>
              <span className="relative flex shrink-0 items-center gap-2 text-xs text-lunex-gray transition-colors group-hover:text-primary-300">
                <span className="pointer-events-none flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {formatNumber(c.views)}
                </span>
                {canManage && (
                  <ChapterAdminMenu
                    chapter={c}
                    isPublished={c.isPublished}
                    manualLock={manualLock}
                    onSave={(patch) => store.updateChapter(c.id, patch, teamId, currentUser!.id)}
                    onSetLock={(lock) => store.setChapterLock(c.id, lock, teamId, currentUser!.id)}
                    onDelete={() => store.removeChapter(c.id, teamId, currentUser!.id)}
                  />
                )}
              </span>
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="p-6 text-center text-sm text-lunex-gray">لا توجد فصول مطابقة.</p>
        )}
      </div>
    </div>
  );
}
