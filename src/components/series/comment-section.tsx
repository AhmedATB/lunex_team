"use client";

import { useState } from "react";
import Image from "next/image";
import { ThumbsUp, ThumbsDown, Pin, Send } from "lucide-react";
import type { Comment, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { avatarUrl, timeAgo } from "@/lib/utils";
import { useSession } from "@/store/session";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { getMockDatabase } from "@/lib/mock/generate";

export function CommentSection({
  seriesId,
  initialComments,
  users,
}: {
  seriesId: string;
  initialComments: Comment[];
  users: User[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike" | undefined>>({});
  const currentUserId = useSession((s) => s.currentUserId);
  const currentUser = getMockDatabase().users.find((u) => u.id === currentUserId);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const userMap = new Map(users.map((u) => [u.id, u]));

  function post() {
    if (!draft.trim() || !currentUser) return;
    const newComment: Comment = {
      id: `local-${Date.now()}`,
      seriesId,
      userId: currentUser.id,
      content: draft.trim(),
      likes: 0,
      dislikes: 0,
      createdAt: new Date().toISOString(),
      isPinned: false,
    };
    setComments((c) => [newComment, ...c]);
    userMap.set(currentUser.id, currentUser);
    setDraft("");
  }

  function react(commentId: string, type: "like" | "dislike") {
    setReactions((r) => ({ ...r, [commentId]: r[commentId] === type ? undefined : type }));
  }

  return (
    <div className="space-y-4">
      {currentUser && (
        <div className="flex gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/40 shadow-[0_0_14px_rgba(168,85,247,0.35)]">
            <Image src={avatarUrl(effectiveAvatarSeed(currentUser, avatarOverrides))} alt={currentUser.displayName} fill className="object-cover" />
          </div>
          <div className="flex-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="شارك رأيك حول هذا العمل..."
              rows={2}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={post} disabled={!draft.trim()}>
                <Send className="h-3.5 w-3.5" /> نشر
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {comments.map((c) => {
          const user = userMap.get(c.userId) ?? getMockDatabase().users.find((u) => u.id === c.userId);
          if (!user) return null;
          const reaction = reactions[c.id];
          const likes = c.likes + (reaction === "like" ? 1 : 0);
          const dislikes = c.dislikes + (reaction === "dislike" ? 1 : 0);
          return (
            <div key={c.id} className="panel panel-hover flex gap-3 p-4">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                <Image src={avatarUrl(effectiveAvatarSeed(user, avatarOverrides))} alt={user.displayName} fill className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{user.displayName}</p>
                  {c.isPinned && (
                    <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                      <Pin className="h-2.5 w-2.5" /> مثبّت
                    </Badge>
                  )}
                  <p className="text-[11px] text-lunex-gray">{timeAgo(c.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-lunex-gray">{c.content}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => react(c.id, "like")}
                    className={`hover-pop flex items-center gap-1 text-xs transition-colors ${reaction === "like" ? "text-primary-300" : "text-lunex-gray hover:text-white"}`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" /> {likes}
                  </button>
                  <button
                    onClick={() => react(c.id, "dislike")}
                    className={`hover-pop flex items-center gap-1 text-xs transition-colors ${reaction === "dislike" ? "text-red-400" : "text-lunex-gray hover:text-white"}`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" /> {dislikes}
                  </button>
                  <button className="text-xs text-lunex-gray hover:text-white">رد</button>
                </div>
              </div>
            </div>
          );
        })}
        {comments.length === 0 && (
          <p className="py-8 text-center text-sm text-lunex-gray">كن أول من يعلّق على هذا العمل.</p>
        )}
      </div>
    </div>
  );
}
