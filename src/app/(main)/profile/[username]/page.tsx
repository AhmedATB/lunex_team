"use client";

import { useEffect, useMemo, useState } from "react";
import { ProgressSummary } from "@/components/profile/progress-summary";
import { useParams, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Bookmark as BookmarkIcon,
  CalendarDays,
  Lock,
  MessageCircle,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react";
import { useSession } from "@/store/session";
import { useProfile, avatarSrcFor } from "@/store/profile";
import { useCatalog } from "@/components/catalog-provider";
import { GLOBAL_ROLE_LABELS, TEAM_ROLE_LABELS } from "@/lib/rbac";
import { VISIBILITY_LABELS, type ServerProfile } from "@/lib/profile-types";
import type { GlobalRole, Series, User } from "@/lib/types";
import { formatNumber, safeDecodeURIComponent, timeAgo } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SeriesCard } from "@/components/shared/series-card";
import { ModerationPanel } from "@/components/moderation/moderation-panel";
import { ProfileSkeleton } from "@/components/shared/skeletons";

type Lookup = { status: "loading" } | { status: "ready"; profile: ServerProfile | null };

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = safeDecodeURIComponent(params.username);

  const db = useCatalog();
  const mockUser = db.users.find((u) => u.username === username);

  // Real accounts live on the server; the demo catalogue's members only exist in the local dataset. The server is asked first.
  const [lookup, setLookup] = useState<Lookup>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    setLookup({ status: "loading" });
    fetch(`/api/profiles/${encodeURIComponent(username)}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as ServerProfile) : null))
      .catch(() => null)
      .then((profile) => {
        if (!cancelled) setLookup({ status: "ready", profile });
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const displayName = lookup.status === "ready" ? lookup.profile?.displayName ?? mockUser?.displayName : undefined;
  useEffect(() => {
    document.title = displayName ? `${displayName} | LUNEX TEAM` : "الملف الشخصي | LUNEX TEAM";
  }, [displayName]);

  if (lookup.status === "loading") return <ProfileSkeleton />;
  if (lookup.profile) return <ServerProfileView profile={lookup.profile} series={db.series} />;
  if (mockUser) return <MockProfileView user={mockUser} />;
  notFound();
}

function roleLabel(role: string): string {
  return GLOBAL_ROLE_LABELS[role as GlobalRole] ?? role;
}

function joinedLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "long" }).format(new Date(iso));
}

function ServerProfileView({ profile, series }: { profile: ServerProfile; series: Series[] }) {
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const src = avatarSrcFor({ id: profile.id, avatarSeed: profile.id, avatarVersion: profile.avatarVersion }, avatarOverrides);
  const byId = useMemo(() => new Map(series.map((s) => [s.id, s])), [series]);
  const viewerRole = useSession((s) => s.user?.role);
  const canModerate = !profile.isSelf && (viewerRole === "owner" || viewerRole === "super_administrator" || viewerRole === "moderator");

  const favorites = (profile.bookmarks ?? []).map((id) => byId.get(id)).filter((s): s is Series => Boolean(s));
  const history = (profile.history ?? []).flatMap((h) => {
    const s = byId.get(h.seriesId);
    return s ? [{ ...h, series: s }] : [];
  });
  const joined = joinedLabel(profile.createdAt);

  return (
    <div className="container space-y-6 py-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="art-glow relative h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ring-primary-500/30">
            <Image src={src} alt={profile.displayName} fill sizes="96px" className="object-cover" />
          </div>

          <div className="flex-1 space-y-2 text-center sm:text-start">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-display text-2xl font-bold text-white">{profile.displayName}</h1>
              <Badge>{roleLabel(profile.role)}</Badge>
            </div>
            <p className="text-sm text-lunex-gray" dir="ltr">@{profile.username}</p>
            {!profile.restricted && profile.bio && (
              <p className="mx-auto max-w-md whitespace-pre-line text-sm text-lunex-gray sm:mx-0">{profile.bio}</p>
            )}
            {joined && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-lunex-gray sm:justify-start">
                <CalendarDays className="h-3.5 w-3.5" /> انضم في {joined}
              </p>
            )}
            {profile.progress && <ProgressSummary progress={profile.progress} />}

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 sm:justify-start">
              {profile.isSelf ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href="/profile/settings">
                    <SettingsIcon className="h-3.5 w-3.5" /> تعديل الملف والخصوصية
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href={`/messages?to=${profile.id}`}>
                    <MessageCircle className="h-3.5 w-3.5" /> مراسلة
                  </Link>
                </Button>
              )}
            </div>

            {profile.visibility && !profile.restricted && (
              <p className="pt-1 text-xs text-lunex-gray">
                {profile.isSelf ? "اختياراتك الحالية" : "اختيارات صاحب الحساب"}: الملف «{VISIBILITY_LABELS[profile.visibility.profile]}»، سجل
                القراءة «{VISIBILITY_LABELS[profile.visibility.history]}»، المفضلة «{VISIBILITY_LABELS[profile.visibility.favorites]}».
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {canModerate && <ModerationPanel userId={profile.id} />}

      {profile.restricted ? (
        <PrivateNotice title="هذا الملف الشخصي خاص" text="اختار صاحب الحساب ألا يشارك تفاصيل ملفه." />
      ) : (
        <>
          <section className="space-y-3">
            <SectionTitle icon={BookmarkIcon} title="المفضلة" count={profile.access.favorites ? favorites.length : undefined} />
            {!profile.access.favorites ? (
              <PrivateNotice title="المفضلة غير متاحة" text="صاحب الحساب لا يشارك مفضلته." compact />
            ) : favorites.length === 0 ? (
              <EmptyNote text="لا توجد أعمال في المفضلة بعد." />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {favorites.map((s) => (
                  <SeriesCard key={s.id} series={s} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionTitle icon={BookOpen} title="سجل القراءة" count={profile.access.history ? history.length : undefined} />
            {!profile.access.history ? (
              <PrivateNotice title="سجل القراءة غير متاح" text="صاحب الحساب لا يشارك سجل قراءته." compact />
            ) : history.length === 0 ? (
              <EmptyNote text="لم يقرأ أي عمل بعد." />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {history.map((h) => (
                  <li key={h.seriesId}>
                    <Link
                      href={`/series/${encodeURIComponent(h.series.slug)}`}
                      className="panel panel-hover flex items-center gap-3 p-2.5"
                    >
                      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md">
                        <Image src={h.series.cover} alt="" fill sizes="44px" className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{h.series.titleAr || h.series.title}</p>
                        <p className="text-xs text-lunex-gray">وصل إلى الفصل {h.chapterNumber}</p>
                        <p className="text-[11px] text-lunex-gray/80">{timeAgo(h.lastReadAt)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, count }: { icon: typeof BookOpen; title: string; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
      <Icon className="h-4 w-4 text-primary-300" /> {title}
      {count !== undefined && <span className="text-sm font-normal text-lunex-gray">({count})</span>}
    </h2>
  );
}

function PrivateNotice({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <div className={`panel flex items-center gap-3 ${compact ? "p-3" : "p-6"} text-lunex-gray`}>
      <Lock className="h-5 w-5 shrink-0 text-primary-300" />
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs">{text}</p>
      </div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="panel p-4 text-center text-sm text-lunex-gray">{text}</p>;
}

/** The demo catalogue's members — they only exist in the local dataset, so this is the pre-existing view unchanged. */
function MockProfileView({ user }: { user: User }) {
  const db = useCatalog();
  const team = db.teams.find((t) => t.id === user.teamId);
  const currentUserId = useSession((s) => s.currentUserId);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const isSelf = user.id === currentUserId;

  return (
    <div className="container space-y-6 py-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="art-glow relative h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ring-primary-500/30">
            <Image src={avatarSrcFor(user, avatarOverrides)} alt={user.displayName} fill sizes="96px" className="object-cover" />
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

            {!isSelf && (
              <div className="pt-2">
                <Button asChild size="sm">
                  <Link href={`/messages?to=${user.id}`}>
                    <MessageCircle className="h-3.5 w-3.5" /> مراسلة
                  </Link>
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center sm:flex sm:flex-col sm:gap-3">
            <Stat icon={BookOpen} label="فصل مقروء" value={user.readCount} />
            <Stat icon={MessageSquare} label="تعليق" value={user.commentCount} />
            <Stat icon={BookmarkIcon} label="مفضلة" value={user.bookmarkCount} />
          </div>
        </CardContent>
      </Card>
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
