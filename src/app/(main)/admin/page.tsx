import type { Metadata } from "next";
import { Layers, BookOpen, Users, MessageSquare, Eye, Activity } from "lucide-react";
import { loadCatalog } from "@/lib/catalog-server";
import { loadAdminDashboard } from "@/lib/admin-dashboard";
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
  const [db, stats, dashboard] = await Promise.all([loadCatalog(), getPlatformStats(), loadAdminDashboard()]);

  // Counted from the database by the backend: the catalogue held here is only the site's short list of latest chapters.
  const buckets = Array.from({ length: 8 }).map((_, i) => ({ label: `أ${i + 1}`, chapters: dashboard?.weeks[i]?.chapters ?? 0 }));

  const statusCounts = db.series.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: STATUS_LABEL[name] ?? name,
    value,
  }));

  const teamActivity = (dashboard?.teams ?? []).map((t) => ({ name: t.name, value: t.chapters }));

  const ACTIVITY_ICONS = { chapter: BookOpen, series: Layers, member: Users } as const;
  const recentActivity = (dashboard?.recent ?? []).map((e) => ({ icon: ACTIVITY_ICONS[e.kind], text: e.text, at: e.at }));

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
          <CardHeader><CardTitle>الفصول المنشورة أسبوعيًا</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>الفصول المنشورة حسب الفريق (آخر 30 يومًا)</CardTitle></CardHeader>
          <CardContent><TeamActivityBarChart data={teamActivity} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> آخر النشاطات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 && <p className="text-xs text-lunex-gray">لا نشاط حديثًا.</p>}
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
        <CardHeader><CardTitle>أعلى الأدوار نشاطًا</CardTitle></CardHeader>
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
