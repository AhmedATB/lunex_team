"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Users, Crown, Trophy, Plus } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useTeamManagement } from "@/store/team-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

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
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">فرق الترجمة</h1>
          <p className="mt-1 text-sm text-lunex-gray">كل فريق يعمل باستقلالية على مشاريعه الخاصة ضمن منظومة LUNEX TEAM.</p>
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
              className="group panel panel-hover flex flex-col gap-3 p-5 transition-all hover:-translate-y-1 hover:border-primary-400/40 active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center font-display text-lg font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${team.color}, #C084FC)` }}
                >
                  {team.name[0]}
                </div>
                <Badge variant={team.recruiting ? "success" : "secondary"}>
                  {team.recruiting ? "يستقبل طلبات" : "مكتمل العدد"}
                </Badge>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white group-hover:text-primary-300">
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
