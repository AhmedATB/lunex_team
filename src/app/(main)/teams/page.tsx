import Link from "next/link";
import type { Metadata } from "next";
import { Users, Crown, Trophy } from "lucide-react";
import { getTeams, getSeriesForTeam } from "@/lib/mock/repo";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion/fade-in";

export const metadata: Metadata = {
  title: "الفرق",
  description: "تعرف على فرق الترجمة المنضوية تحت LUNEX TEAM وانضم إلى فريقك المفضل.",
};

export default async function TeamsPage() {
  const teams = await getTeams();
  const teamsWithCounts = await Promise.all(
    teams.map(async (t) => ({ team: t, seriesCount: (await getSeriesForTeam(t.id)).length }))
  );

  return (
    <div className="container space-y-6 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">فرق الترجمة</h1>
        <p className="mt-1 text-sm text-lunex-gray">كل فريق يعمل باستقلالية على مشاريعه الخاصة ضمن منظومة LUNEX TEAM.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamsWithCounts.map(({ team, seriesCount }, i) => (
          <FadeIn key={team.id} delay={i * 0.04}>
            <Link
              href={`/teams/${team.slug}`}
              className="group glass ease-premium flex flex-col gap-3 rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-glow active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl font-display text-lg font-black text-white"
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
              <div className="mt-auto flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-lunex-gray">
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
