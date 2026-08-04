"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { Comment, Series, User } from "@/lib/types";
import { avatarUrl, timeAgo } from "@/lib/utils";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";

export function LatestComments({
  comments,
  users,
  seriesMap,
}: {
  comments: Comment[];
  users: User[];
  seriesMap: Map<string, Series>;
}) {
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white sm:text-2xl">
        <MessageCircle className="h-5 w-5 text-primary-300" /> آخر التعليقات
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {comments.slice(0, 6).map((c) => {
          const user = userMap.get(c.userId);
          const series = seriesMap.get(c.seriesId);
          if (!user || !series) return null;
          return (
            <Link
              key={c.id}
              href={`/series/${series.slug}`}
              className="panel panel-hover flex gap-3 p-4 transition-colors hover:border-primary-400/30"
            >
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                <Image src={avatarUrl(effectiveAvatarSeed(user, avatarOverrides))} alt={user.displayName} fill className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold text-white">{user.displayName}</span>{" "}
                  <span className="text-lunex-gray">على {series.titleAr}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-lunex-gray">{c.content}</p>
                <p className="mt-1 text-[11px] text-lunex-gray/70">{timeAgo(c.createdAt)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
