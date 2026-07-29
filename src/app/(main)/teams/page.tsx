"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Users, Crown, Trophy, Plus, Sparkle } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useTeamManagement } from "@/store/team-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";

export default function TeamsPage() {
  useEffect(() => {
    document.title = "الفرق | LUNEX TEAM";
  }, []);

  const db = useMemo(() => getMockDatabase(), []);
  const createdTeams = useTeamManagement((s) => s.createdTeams);

  const teamsWithCounts = useMemo(() => {
    const all = [...db.teams, ...createdTeams];
    return all.map((team) => ({
      team,
      seriesCount: db.series.filter((s) => s.teamId === team.id).length,
    }));
  }, [db, createdTeams]);

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-title font-display text-2xl font-bold text-white sm:text-3xl">فرق الترجمة</h1>
          <p className="mt-2 text-sm text-lunex-gray">كل فريق يعمل باستقلالية على مشاريعه الخاصة ضمن منظومة LUNEX TEAM.</p>
        </div>
        <Button asChild>
          <Link href="/teams/create"><Plus className="h-4 w-4" /> إنشاء فريق جديد</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamsWithCounts.map(({ team, seriesCount }, i) => (
          <FadeIn key={team.id} delay={i * 0.04}>
            <Link
              href={`/teams/${team.slug}`}
              className="group panel panel-hover relative flex flex-col gap-3 overflow-hidden p-5 transition-all hover:-translate-y-1 hover:border-primary-400/40 active:scale-[0.98] active:border-primary-400/40"
            >
              {team.rank <= 3 && (
                <Sparkle className="hover-pop pointer-events-none absolute end-3 top-3 h-4 w-4 fill-amber-300 text-amber-300 opacity-70" />
              )}
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "art-glow shine flex h-12 w-12 items-center justify-center rounded-2xl font-display text-lg font-black text-white transition-transform duration-300 group-hover:scale-110 group-active:scale-110",
                    team.rank <= 3 && "magic-border"
                  )}
                  style={{ background: `linear-gradient(135deg, ${team.color}, #C084FC)` }}
                >
                  {team.name[0]}
                </div>
                <Badge variant={team.recruiting ? "success" : "secondary"}>
                  {team.recruiting ? "يستقبل طلبات" : "مكتمل العدد"}
                </Badge>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white group-hover:text-primary-300 group-active:text-primary-300">
                  {team.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-lunex-gray">{team.description}</p>
              </div>
              <div className="mt-auto flex items-center gap-4 border-t-2 border-white/15 pt-3 text-xs text-lunex-gray">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {team.memberIds.length} عضو</span>
                <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> #{team.rank}</span>
                <span className="flex items-center gap-1"><Crown className="h-3.5 w-3.5" /> {seriesCount} مشروع</span>
              </div>
            </Link>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
