"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Award, BookOpen, MessageSquare, Bookmark as BookmarkIcon, MessageCircle } from "lucide-react";
import { useSession } from "@/store/session";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { getMockDatabase } from "@/lib/mock/generate";
import { GLOBAL_ROLE_LABELS, TEAM_ROLE_LABELS } from "@/lib/rbac";
import { avatarUrl, formatNumber, safeDecodeURIComponent } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = safeDecodeURIComponent(params.username);

  const db = useMemo(() => getMockDatabase(), []);
  const user = db.users.find((u) => u.username === username);
  const team = db.teams.find((t) => t.id === user?.teamId);
  const currentUserId = useSession((s) => s.currentUserId);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);

  // Persisted stores rehydrate after mount — wait one tick before trusting "not found".
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    document.title = user ? `${user.displayName} | LUNEX TEAM` : "غير موجود | LUNEX TEAM";
  }, [user]);

  if (!ready) return null;
  if (!user) {
    notFound();
  }

  const isSelf = user.id === currentUserId;

  return (
    <div className="container space-y-6 py-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="art-glow relative h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ring-primary-500/30">
            <Image src={avatarUrl(effectiveAvatarSeed(user, avatarOverrides))} alt={user.displayName} fill className="object-cover" />
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
