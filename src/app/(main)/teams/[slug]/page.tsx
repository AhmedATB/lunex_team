import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { Users, ExternalLink, Crown } from "lucide-react";
import { getTeamBySlug, getSeriesForTeam } from "@/lib/mock/repo";
import { getMockDatabase } from "@/lib/mock/generate";
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeriesRow } from "@/components/shared/series-card";
import { avatarUrl, safeDecodeURIComponent } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamBySlug(safeDecodeURIComponent(slug));
  return { title: team ? team.name : "غير موجود" };
}

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getTeamBySlug(safeDecodeURIComponent(slug));
  if (!team) notFound();

  const db = getMockDatabase();
  const members = team.memberIds.map((id) => db.users.find((u) => u.id === id)).filter(Boolean);
  const leader = db.users.find((u) => u.id === team.leaderId);
  const projects = await getSeriesForTeam(team.id);

  return (
    <div className="container space-y-8 py-6">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 p-8"
        style={{ background: `linear-gradient(135deg, ${team.color}33, transparent)` }}
      >
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl font-display text-3xl font-black text-white shadow-glow-lg"
            style={{ background: `linear-gradient(135deg, ${team.color}, #C084FC)` }}
          >
            {team.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-display text-3xl font-black text-white">{team.name}</h1>
              <Badge variant={team.recruiting ? "success" : "secondary"}>
                {team.recruiting ? "يستقبل طلبات انضمام" : "مكتمل العدد"}
              </Badge>
            </div>
            <p className="mt-2 max-w-xl text-sm text-lunex-gray">{team.description}</p>
          </div>
          <div className="flex gap-2">
            {team.recruiting && <Button>قدّم للانضمام</Button>}
            {team.discordUrl && (
              <Button variant="secondary" asChild>
                <a href={team.discordUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Discord
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="المشاريع" value={projects.length} />
        <MiniStat label="الأعضاء" value={members.length} />
        <MiniStat label="الترتيب" value={team.rank} prefix="#" />
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-white">الأعضاء</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <div key={m!.id} className="glass flex items-center gap-3 rounded-2xl p-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                <Image src={avatarUrl(m!.avatarSeed)} alt={m!.displayName} fill className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{m!.displayName}</p>
                <p className="text-xs text-primary-300">{m!.teamRole ? TEAM_ROLE_LABELS[m!.teamRole] : "عضو"}</p>
              </div>
              {m!.id === leader?.id && <Crown className="h-4 w-4 shrink-0 text-amber-300" />}
            </div>
          ))}
        </div>
      </section>

      {projects.length > 0 && <SeriesRow title="مشاريع الفريق" series={projects} />}
    </div>
  );
}

function MiniStat({ label, value, prefix = "" }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="glass flex flex-col items-center gap-1 rounded-2xl py-4 text-center">
      <span className="flex items-center gap-1 font-display text-xl font-bold text-white">
        <Users className="h-4 w-4 text-primary-300" /> {prefix}{value}
      </span>
      <span className="text-xs text-lunex-gray">{label}</span>
    </div>
  );
}
