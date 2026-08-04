"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Pin, Trash2, ThumbsUp, ThumbsDown } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { avatarUrl, timeAgo } from "@/lib/utils";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";

export default function AdminCommentsPage() {
  useEffect(() => {
    document.title = "إدارة التعليقات | LUNEX TEAM";
  }, []);
  const db = useMemo(() => getMockDatabase(), []);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const userMap = new Map(db.users.map((u) => [u.id, u]));
  const seriesMap = new Map(db.series.map((s) => [s.id, s]));
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const comments = [...db.comments]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .filter((c) => !removed.has(c.id))
    .slice(0, 30);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">إدارة التعليقات</h1>
      <div className="space-y-3">
        {comments.map((c) => {
          const user = userMap.get(c.userId);
          const series = seriesMap.get(c.seriesId);
          if (!user || !series) return null;
          return (
            <Card key={c.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                  <Image src={avatarUrl(effectiveAvatarSeed(user, avatarOverrides))} alt={user.displayName} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{user.displayName}</p>
                    <span className="text-xs text-lunex-gray">على {series.titleAr}</span>
                    {c.isPinned && <Badge variant="outline" className="text-[10px]">مثبّت</Badge>}
                    <span className="text-[11px] text-lunex-gray/70">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-lunex-gray">{c.content}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-lunex-gray">
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {c.likes}</span>
                    <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> {c.dislikes}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label="تثبيت"><Pin className="h-4 w-4" /></Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="حذف"
                    className="text-red-400 hover:bg-red-500/10"
                    onClick={() => setRemoved((s) => new Set(s).add(c.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
