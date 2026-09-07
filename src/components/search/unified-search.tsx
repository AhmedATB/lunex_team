"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, Users, Crown, Trophy, BookOpen, User as UserIcon } from "lucide-react";
import type { Genre, Team, User } from "@/lib/types";
import { getMockDatabase } from "@/lib/mock/generate";
import { useTeamManagement, applyTeamOverride } from "@/store/team-management";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { GLOBAL_ROLE_LABELS } from "@/lib/rbac";
import { resolveAvatarUrl } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeriesCard } from "@/components/shared/series-card";
import { SeriesExplorer } from "@/components/explore/series-explorer";

const PREVIEW_COUNT = 6;

export function UnifiedSearch({ genres }: { genres: Genre[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [tab, setTab] = useState<"all" | "series" | "teams" | "users">("all");

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function updateQuery(value: string) {
    setQ(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    router.replace(`/search${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const db = useMemo(() => getMockDatabase(), []);
  const createdTeams = useTeamManagement((s) => s.createdTeams);
  const teamInfoOverrides = useTeamManagement((s) => s.teamInfoOverrides);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);

  const allTeams = useMemo(
    () => [...db.teams, ...createdTeams].map((t) => applyTeamOverride(t, teamInfoOverrides)),
    [db, createdTeams, teamInfoOverrides]
  );

  const query = q.trim().toLowerCase();

  const matchedSeries = useMemo(() => {
    if (!query) return [];
    return db.series.filter(
      (s) => s.titleAr.toLowerCase().includes(query) || s.title.toLowerCase().includes(query) || s.author.toLowerCase().includes(query)
    );
  }, [db, query]);

  const matchedTeams = useMemo(() => {
    if (!query) return [];
    return allTeams.filter((t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query));
  }, [allTeams, query]);

  const matchedUsers = useMemo(() => {
    if (!query) return [];
    return db.users.filter(
      (u) => u.username.toLowerCase().includes(query) || u.displayName.toLowerCase().includes(query)
    );
  }, [db, query]);

  const hasQuery = query.length > 0;

  return (
    <div className="container space-y-6 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">البحث</h1>
        <p className="mt-1 text-sm text-lunex-gray">ابحث عن سلاسل، فرق ترجمة، أو مستخدمين في مكان واحد.</p>
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
        <Input
          value={q}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder="ابحث عن مانهوا، فريق، أو مستخدم..."
          className="ps-9"
          autoFocus
        />
      </div>

      {!hasQuery ? (
        <div className="panel p-10 text-center text-lunex-gray">اكتب كلمة للبحث عن سلاسل، فرق، أو مستخدمين.</div>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="series">السلاسل {matchedSeries.length > 0 && `(${matchedSeries.length})`}</TabsTrigger>
            <TabsTrigger value="teams">الفرق {matchedTeams.length > 0 && `(${matchedTeams.length})`}</TabsTrigger>
            <TabsTrigger value="users">المستخدمون {matchedUsers.length > 0 && `(${matchedUsers.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-8">
            <ResultSection
              title="السلاسل"
              icon={BookOpen}
              count={matchedSeries.length}
              onSeeAll={() => setTab("series")}
            >
              {matchedSeries.length === 0 ? (
                <EmptySection text="لا توجد سلاسل مطابقة." />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {matchedSeries.slice(0, PREVIEW_COUNT).map((s) => <SeriesCard key={s.id} series={s} />)}
                </div>
              )}
            </ResultSection>

            <ResultSection title="الفرق" icon={Users} count={matchedTeams.length} onSeeAll={() => setTab("teams")}>
              {matchedTeams.length === 0 ? (
                <EmptySection text="لا توجد فرق مطابقة." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {matchedTeams.slice(0, PREVIEW_COUNT).map((t) => <TeamResultCard key={t.id} team={t} db={db} />)}
                </div>
              )}
            </ResultSection>

            <ResultSection title="المستخدمون" icon={UserIcon} count={matchedUsers.length} onSeeAll={() => setTab("users")}>
              {matchedUsers.length === 0 ? (
                <EmptySection text="لا يوجد مستخدمون مطابقون." />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {matchedUsers.slice(0, PREVIEW_COUNT).map((u) => (
                    <UserResultRow key={u.id} user={u} avatarOverrides={avatarOverrides} />
                  ))}
                </div>
              )}
            </ResultSection>
          </TabsContent>

          <TabsContent value="series">
            <SeriesExplorer genres={genres} title="السلاسل" />
          </TabsContent>

          <TabsContent value="teams">
            {matchedTeams.length === 0 ? (
              <EmptySection text="لا توجد فرق مطابقة." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matchedTeams.map((t) => <TeamResultCard key={t.id} team={t} db={db} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            {matchedUsers.length === 0 ? (
              <EmptySection text="لا يوجد مستخدمون مطابقون." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {matchedUsers.map((u) => <UserResultRow key={u.id} user={u} avatarOverrides={avatarOverrides} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ResultSection({
  title,
  icon: Icon,
  count,
  onSeeAll,
  children,
}: {
  title: string;
  icon: typeof BookOpen;
  count: number;
  onSeeAll: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
          <Icon className="h-4 w-4 text-primary-300" /> {title}
        </h2>
        {count > PREVIEW_COUNT && (
          <button onClick={onSeeAll} className="text-sm font-medium text-primary-300 hover:text-primary-200">
            عرض الكل ({count}) ←
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptySection({ text }: { text: string }) {
  return <div className="panel p-6 text-center text-sm text-lunex-gray">{text}</div>;
}

function TeamResultCard({ team, db }: { team: Team; db: ReturnType<typeof getMockDatabase> }) {
  const seriesCount = db.series.filter((s) => s.teamId === team.id).length;
  return (
    <Link
      href={`/teams/${team.slug}`}
      className="group panel panel-hover flex items-center gap-3 p-4 transition-colors hover:border-primary-400/40"
    >
      <div
        className="art-glow relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl font-display text-base font-black text-white"
        style={team.logoUrl ? undefined : { background: `linear-gradient(135deg, ${team.color}, #C084FC)` }}
      >
        {team.logoUrl ? <Image src={team.logoUrl} alt={team.name} fill className="object-cover" unoptimized /> : team.name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-white group-hover:text-primary-300">{team.name}</p>
        <div className="flex items-center gap-3 text-xs text-lunex-gray">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {team.memberIds.length}</span>
          <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> #{team.rank}</span>
          <span className="flex items-center gap-1"><Crown className="h-3 w-3" /> {seriesCount}</span>
        </div>
      </div>
    </Link>
  );
}

function UserResultRow({
  user,
  avatarOverrides,
}: {
  user: User;
  avatarOverrides: Record<string, string>;
}) {
  return (
    <Link
      href={`/profile/${user.username}`}
      className="group panel panel-hover flex items-center gap-3 p-3 transition-colors hover:border-primary-400/40"
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
        <Image
          src={resolveAvatarUrl(user.id, user.avatarVersion, effectiveAvatarSeed(user, avatarOverrides))}
          alt={user.displayName}
          fill
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white group-hover:text-primary-300">{user.displayName}</p>
        <p className="truncate text-xs text-lunex-gray" dir="ltr">@{user.username}</p>
      </div>
      <Badge variant="outline" className="shrink-0 text-[10px]">{GLOBAL_ROLE_LABELS[user.role]}</Badge>
    </Link>
  );
}
