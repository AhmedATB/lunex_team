"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Users, ExternalLink, Crown } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useTeamManagement } from "@/store/team-management";
import { TEAM_ROLE_LABELS } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeriesRow } from "@/components/shared/series-card";
import { TeamDashboardLink } from "@/components/series/team-dashboard-link";
import { avatarUrl, safeDecodeURIComponent } from "@/lib/utils";

export default function TeamDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = safeDecodeURIComponent(params.slug);

  const db = useMemo(() => getMockDatabase(), []);
  const createdTeams = useTeamManagement((s) => s.createdTeams);
  const team = [...db.teams, ...createdTeams].find((t) => t.slug === slug);

  // Persisted stores use skipHydration + rehydrate-on-mount (see StoreHydration), so
  // `createdTeams` is still empty on the very first client render after a hard reload.
  // Wait one tick before trusting a "not found" result, or a freshly created team 404s.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    document.title = team ? `${team.name} | LUNEX TEAM` : "غير موجود | LUNEX TEAM";
  }, [team]);

  if (!ready) return null;
  if (!team) {
    notFound();
  }

  const members = team.memberIds.map((id) => db.users.find((u) => u.id === id)).filter(Boolean);
  const leader = db.users.find((u) => u.id === team.leaderId);
  const projects = db.series.filter((s) => s.teamId === team.id);

  return (
    <div className="container space-y-8 py-6">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 p-8"
        style={{ background: `linear-gradient(135deg, ${team.color}33, transparent)` }}
      >
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl font-display text-3xl font-black text-white"
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
            <TeamDashboardLink teamId={team.id} teamSlug={team.slug} />
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
            <div key={m!.id} className="panel flex items-center gap-3 p-3">
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
    <div className="panel flex flex-col items-center gap-1 py-4 text-center">
      <span className="flex items-center gap-1 font-display text-xl font-bold text-white">
        <Users className="h-4 w-4 text-primary-300" /> {prefix}{value}
      </span>
      <span className="text-xs text-lunex-gray">{label}</span>
    </div>
  );
}
