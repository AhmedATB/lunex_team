"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Award,
  BookOpen,
  MessageSquare,
  Bookmark as BookmarkIcon,
  Bell,
  Settings,
  Moon,
  Shield,
} from "lucide-react";
import { useSession } from "@/store/session";
import { useBookmarks, useReadingProgress } from "@/store/reader-settings";
import { getMockDatabase } from "@/lib/mock/generate";
import { GLOBAL_ROLE_LABELS, TEAM_ROLE_LABELS } from "@/lib/rbac";
import { avatarUrl, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SeriesCard } from "@/components/shared/series-card";

export default function ProfilePage() {
  useEffect(() => {
    document.title = "الملف الشخصي | LUNEX TEAM";
  }, []);
  const currentUserId = useSession((s) => s.currentUserId);
  const db = useMemo(() => getMockDatabase(), []);
  const user = db.users.find((u) => u.id === currentUserId);
  const team = db.teams.find((t) => t.id === user?.teamId);

  const bookmarkIds = useBookmarks((s) => s.bookmarks);
  const progress = useReadingProgress((s) => s.progress);
  const bookmarkedSeries = db.series.filter((s) => bookmarkIds.includes(s.id));
  const historyEntries = Object.entries(progress)
    .map(([seriesId, chapter]) => ({ series: db.series.find((s) => s.id === seriesId), chapter }))
    .filter((e) => e.series);

  if (!user) {
    return (
      <div className="container py-16 text-center text-lunex-gray">
        الرجاء تسجيل الدخول لعرض ملفك الشخصي.
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ring-primary-500/30">
            <Image src={avatarUrl(user.avatarSeed)} alt={user.displayName} fill className="object-cover" />
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
            <p className="text-sm text-lunex-gray">@{user.username}</p>
            <p className="mx-auto max-w-md text-sm text-lunex-gray sm:mx-0">{user.bio}</p>

            <div className="mx-auto max-w-xs space-y-1 sm:mx-0">
              <div className="flex justify-between text-xs text-lunex-gray">
                <span>المستوى {user.level}</span>
                <span>{user.xp}/{user.xpToNext} XP</span>
              </div>
              <Progress value={(user.xp / user.xpToNext) * 100} />
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 pt-1 sm:justify-start">
              {user.badges.map((b) => (
                <Badge key={b} variant="secondary" className="flex items-center gap-1">
                  <Award className="h-3 w-3" /> {b}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center sm:flex sm:flex-col sm:gap-3">
            <Stat icon={BookOpen} label="فصل مقروء" value={user.readCount} />
            <Stat icon={MessageSquare} label="تعليق" value={user.commentCount} />
            <Stat icon={BookmarkIcon} label="مفضلة" value={bookmarkedSeries.length} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">سجل القراءة</TabsTrigger>
          <TabsTrigger value="bookmarks">المفضلة</TabsTrigger>
          <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
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

        <TabsContent value="notifications">
          <Card>
            <CardContent className="divide-y divide-white/5 p-0">
              {[
                "تم نشر فصل جديد من سلسلة تتابعها",
                "علّق أحدهم على تعليقك",
                "تم قبول طلب انضمامك لفريق Aurora",
                "تحديث في سياسة النشر",
              ].map((n, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <Bell className="h-4 w-4 shrink-0 text-primary-300" />
                  <p className="text-sm text-lunex-gray">{n}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold text-white">
                <Settings className="h-4 w-4" /> تفضيلات عامة
              </h3>
              <SettingRow icon={Moon} label="الوضع الداكن" defaultChecked />
              <Separator />
              <SettingRow icon={Bell} label="إشعارات الفصول الجديدة" defaultChecked />
              <Separator />
              <SettingRow icon={Shield} label="المصادقة الثنائية (2FA)" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return (
    <div className="glass flex flex-col items-center gap-1 rounded-xl px-4 py-3">
      <Icon className="h-4 w-4 text-primary-300" />
      <span className="font-display text-sm font-bold text-white">{formatNumber(value)}</span>
      <span className="text-[10px] text-lunex-gray">{label}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl p-12 text-center text-lunex-gray">
      {text}
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  defaultChecked,
}: {
  icon: typeof Moon;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="flex items-center gap-2 text-white">
        <Icon className="h-4 w-4 text-lunex-gray" /> {label}
      </Label>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
