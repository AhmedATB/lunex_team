"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Award, BookOpen, MessageSquare, Bookmark as BookmarkIcon, Bell, Settings2, Lock } from "lucide-react";
import { useSession } from "@/store/session";
import { useBookmarks, useReadingProgress } from "@/store/reader-settings";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { useRewards, computeStreak } from "@/store/rewards";
import { useComments } from "@/store/comments";
import { useAchievements } from "@/store/achievements";
import { ACHIEVEMENTS, type AchievementMetric } from "@/lib/achievements";
import { getMockDatabase } from "@/lib/mock/generate";
import { GLOBAL_ROLE_LABELS, TEAM_ROLE_LABELS } from "@/lib/rbac";
import { resolveAvatarUrl, formatNumber, timeAgo, cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/notification-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeriesCard } from "@/components/shared/series-card";

export default function ProfilePage() {
  useEffect(() => {
    document.title = "الملف الشخصي | LUNEX TEAM";
  }, []);
  const currentUserId = useSession((s) => s.currentUserId);
  const db = useMemo(() => getMockDatabase(), []);
  const user = db.users.find((u) => u.id === currentUserId);
  const team = db.teams.find((t) => t.id === user?.teamId);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);

  const bookmarkIds = useBookmarks((s) => s.bookmarks);
  const progress = useReadingProgress((s) => s.progress);
  const bookmarkedSeries = db.series.filter((s) => bookmarkIds.includes(s.id));
  const historyEntries = Object.entries(progress)
    .map(([seriesId, chapter]) => ({ series: db.series.find((s) => s.id === seriesId), chapter }))
    .filter((e) => e.series);

  const chaptersReadCount = useRewards((s) => s.allTimeReadKeys.length);
  const readDates = useRewards((s) => s.readDates);
  const ownCommentCount = useComments((s) => {
    const removed = new Set(s.removedCommentIds);
    return s.addedComments.filter((c) => c.userId === currentUserId && !removed.has(c.id)).length;
  });
  const unlockedAchievements = useAchievements((s) => s.unlocked);
  const achievementValues: Record<AchievementMetric, number> = {
    chaptersRead: chaptersReadCount,
    comments: ownCommentCount,
    bookmarks: bookmarkIds.length,
    streak: computeStreak(readDates),
  };

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  useEffect(() => {
    if (!currentUserId) {
      setNotifLoading(false);
      return;
    }
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setNotifications(body?.items ?? []))
      .finally(() => setNotifLoading(false));
  }, [currentUserId]);

  if (!user) {
    return (
      <div className="container py-16 text-center text-lunex-gray">
        الرجاء تسجيل الدخول لعرض ملفك الشخصي.
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <Card className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-24 bg-lunex-gradient opacity-20" aria-hidden="true" />
        <CardContent className="relative flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="art-glow relative h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ring-primary-500/30">
            <Image
              src={resolveAvatarUrl(user.id, user.avatarVersion, effectiveAvatarSeed(user, avatarOverrides))}
              alt={user.displayName}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex-1 space-y-2 text-center sm:text-start">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-display text-2xl font-bold text-white">{user.displayName}</h1>
              <Badge>{GLOBAL_ROLE_LABELS[user.role]}</Badge>
              {team && user.teamRole && (
                <Badge variant="outline">
                  {TEAM_ROLE_LABELS[user.teamRole]} @ {team.name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-lunex-gray" dir="ltr">@{user.username}</p>
            {user.bio && <p className="mx-auto max-w-md text-sm text-lunex-gray sm:mx-0">{user.bio}</p>}

            <div className="mx-auto max-w-xs space-y-1 sm:mx-0">
              <div className="flex justify-between text-xs text-lunex-gray">
                <span>المستوى {user.level}</span>
                <span>{user.xp}/{user.xpToNext} XP</span>
              </div>
              <Progress value={(user.xp / user.xpToNext) * 100} />
            </div>

            {user.badges.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 pt-1 sm:justify-start">
                {user.badges.map((b) => (
                  <Badge key={b} variant="secondary" className="flex items-center gap-1">
                    <Award className="h-3 w-3" /> {b}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3 sm:items-end">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/profile/settings">
                <Settings2 className="h-4 w-4" /> إعدادات الحساب
              </Link>
            </Button>
            <div className="grid grid-cols-3 gap-4 text-center sm:flex sm:gap-3">
              <Stat icon={BookOpen} label="فصل مقروء" value={chaptersReadCount} />
              <Stat icon={MessageSquare} label="تعليق" value={ownCommentCount} />
              <Stat icon={BookmarkIcon} label="مفضلة" value={bookmarkedSeries.length} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">سجل القراءة</TabsTrigger>
          <TabsTrigger value="bookmarks">المفضلة</TabsTrigger>
          <TabsTrigger value="achievements">الإنجازات</TabsTrigger>
          <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          {historyEntries.length === 0 ? (
            <EmptyState text="لم تبدأ القراءة بعد، اختر سلسلة وابدأ رحلتك!" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {historyEntries.map(({ series, chapter }) => (
                <div key={series!.id} className="relative">
                  <SeriesCard series={series!} />
                  <Badge className="absolute end-2 top-2">الفصل {chapter}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookmarks">
          {bookmarkedSeries.length === 0 ? (
            <EmptyState text="قائمة مفضلتك فارغة حالياً." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {bookmarkedSeries.map((s) => <SeriesCard key={s.id} series={s} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="achievements">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {ACHIEVEMENTS.map((a) => {
              const isUnlocked = Boolean(unlockedAchievements[a.id]);
              const value = achievementValues[a.metric];
              const pct = Math.min(100, Math.round((value / a.target) * 100));
              const Icon = a.icon;
              return (
                <div
                  key={a.id}
                  className={cn(
                    "panel flex flex-col items-center gap-2 p-4 text-center transition-all",
                    isUnlocked ? "art-glow ring-1 ring-primary-400/40" : "opacity-60"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      isUnlocked ? "bg-lunex-gradient" : "bg-white/5"
                    )}
                  >
                    {isUnlocked ? <Icon className="h-6 w-6 text-white" /> : <Lock className="h-5 w-5 text-lunex-gray" />}
                  </div>
                  <p className="text-sm font-bold text-white">{a.title}</p>
                  <p className="text-xs text-lunex-gray">{a.description}</p>
                  {!isUnlocked && (
                    <div className="w-full space-y-1">
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-[10px] text-lunex-gray/70">{Math.min(value, a.target)}/{a.target}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          {notifLoading ? (
            <EmptyState text="جارِ التحميل..." />
          ) : notifications.length === 0 ? (
            <EmptyState text="لا توجد إشعارات حتى الآن." />
          ) : (
            <Card>
              <CardContent className="divide-y divide-white/5 p-0">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 p-4">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-sm text-lunex-gray">{n.body}</p>}
                      <p className="mt-1 text-xs text-lunex-gray/70">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return (
    <div className="panel flex flex-col items-center gap-1 px-4 py-3">
      <Icon className="h-4 w-4 text-primary-300" />
      <span className="font-display text-sm font-bold text-white">{formatNumber(value)}</span>
      <span className="text-[10px] text-lunex-gray">{label}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="panel p-12 text-center text-lunex-gray">
      {text}
    </div>
  );
}

