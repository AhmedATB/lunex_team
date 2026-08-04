import type { Metadata } from "next";
import { Layers, BookOpen, Users, MessageSquare, Eye, Activity } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { getPlatformStats } from "@/lib/mock/repo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChaptersOverTimeChart, StatusPieChart, TeamActivityBarChart } from "@/components/admin/charts";
import { formatNumber, timeAgo } from "@/lib/utils";
import { GLOBAL_ROLE_LABELS } from "@/lib/rbac";
import { UserAvatar } from "@/components/shared/user-avatar";

export const metadata: Metadata = { title: "لوحة التحكم" };

const STATUS_LABEL: Record<string, string> = {
  ongoing: "مستمر",
  completed: "مكتمل",
  hiatus: "متوقف",
  dropped: "متروك",
};

export default async function AdminDashboardPage() {
  const db = getMockDatabase();
  const stats = await getPlatformStats();

  const now = Date.now();
  const buckets = Array.from({ length: 8 }).map((_, i) => {
    const weeksAgo = 7 - i;
    const start = now - (weeksAgo + 1) * 7 * 86400000;
    const end = now - weeksAgo * 7 * 86400000;
    const count = db.chapters.filter((c) => {
      const t = +new Date(c.releasedAt);
      return t >= start && t < end;
    }).length;
    return { label: `أ${8 - weeksAgo}`, chapters: count };
  });

  const statusCounts = db.series.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: STATUS_LABEL[name] ?? name,
    value,
  }));

  const teamActivity = db.teams
    .map((t) => ({ name: t.name, tasks: db.kanbanTasks.filter((k) => k.teamId === t.id).length }))
    .sort((a, b) => b.tasks - a.tasks)
    .slice(0, 6);

  const recentActivity = [
    ...db.chapters.slice(0, 4).map((c) => ({
      icon: BookOpen,
      text: `نُشر ${c.title} لسلسلة ${db.series.find((s) => s.id === c.seriesId)?.titleAr ?? ""}`,
      at: c.releasedAt,
    })),
    ...db.users
      .slice()
      .sort((a, b) => +new Date(b.joinedAt) - +new Date(a.joinedAt))
      .slice(0, 3)
      .map((u) => ({ icon: Users, text: `انضم عضو جديد: ${u.displayName}`, at: u.joinedAt })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">نظرة عامة</h1>
        <p className="text-sm text-lunex-gray">إحصائيات ومؤشرات أداء المنصة والفرق.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Layers} label="السلاسل" value={stats.totalSeries} />
        <StatCard icon={BookOpen} label="الفصول" value={stats.totalChapters} />
        <StatCard icon={Users} label="المستخدمون" value={stats.totalUsers} />
        <StatCard icon={MessageSquare} label="التعليقات" value={stats.totalComments} />
        <StatCard icon={Eye} label="المشاهدات" value={stats.totalViews} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>الفصول المنشورة أسبوعياً</CardTitle></CardHeader>
          <CardContent><ChaptersOverTimeChart data={buckets} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>حالة السلاسل</CardTitle></CardHeader>
          <CardContent>
            <StatusPieChart data={statusData} />
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-lunex-gray">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <span>{s.name}</span>
                  <span className="text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>مهام Kanban حسب الفريق</CardTitle></CardHeader>
          <CardContent><TeamActivityBarChart data={teamActivity} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> آخر النشاطات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-300" />
                  <div>
                    <p className="text-lunex-gray">{a.text}</p>
                    <p className="text-[10px] text-lunex-gray/60">{timeAgo(a.at)}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>أعلى الأدوار نشاطاً</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {db.users
            .filter((u) => u.role !== "reader")
            .slice(0, 8)
            .map((u) => (
              <div key={u.id} className="panel flex items-center gap-2 px-3 py-2">
                <div className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-white/10">
                  <UserAvatar user={u} alt={u.displayName} sizes="28px" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{u.displayName}</p>
                  <p className="text-[10px] text-primary-300">{GLOBAL_ROLE_LABELS[u.role]}</p>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: number }) {
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
