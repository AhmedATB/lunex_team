"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ThumbsUp, ThumbsDown, Pin, PinOff, Send, Pencil, Trash2, EyeOff, AlertTriangle, Check, X } from "lucide-react";
import type { Comment, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { avatarUrl, timeAgo, cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { useTeamManagement, applyTeamOverride } from "@/store/team-management";
import { useComments, mergeComments } from "@/store/comments";
import { getTeamAuthRoles, getEffectiveCustomRoles } from "@/lib/team-auth";
import { canInTeam } from "@/lib/rbac";
import { getMockDatabase } from "@/lib/mock/generate";

export function CommentSection({
  seriesId,
  teamId,
  initialComments,
  users,
}: {
  seriesId: string;
  teamId: string;
  initialComments: Comment[];
  users: User[];
}) {
  const [draft, setDraft] = useState("");
  const [draftIsSpoiler, setDraftIsSpoiler] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const currentUserId = useSession((s) => s.currentUserId);
  const currentUser = getMockDatabase().users.find((u) => u.id === currentUserId);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const db = useMemo(() => getMockDatabase(), []);
  const teamStore = useTeamManagement();
  const commentsStore = useComments();

  const rawTeam = [...db.teams, ...teamStore.createdTeams].find((t) => t.id === teamId);
  const team = rawTeam ? applyTeamOverride(rawTeam, teamStore.teamInfoOverrides) : undefined;
  const { isGlobalAdmin, isMember } = getTeamAuthRoles(team, currentUser, teamStore.memberRoleOverrides);
  const customRoles = getEffectiveCustomRoles(
    teamId, db.customRoles, teamStore.addedCustomRoles, teamStore.customRoleOverrides, teamStore.removedCustomRoleIds
  );
  const currentUserOverride = currentUser ? teamStore.memberRoleOverrides[currentUser.id] : undefined;
  const effectiveCurrentUser = currentUser
    ? { ...currentUser, customRoleId: currentUserOverride?.customRoleId ?? currentUser.customRoleId }
    : undefined;
  const canModerate = Boolean(
    effectiveCurrentUser &&
      (isGlobalAdmin || (isMember && canInTeam(effectiveCurrentUser, "moderate_comments", customRoles)))
  );

  const comments = mergeComments(initialComments, commentsStore).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });

  function post() {
    if (!draft.trim() || !currentUser) return;
    commentsStore.postComment({
      seriesId,
      userId: currentUser.id,
      content: draft.trim(),
      isSpoiler: draftIsSpoiler,
    });
    setDraft("");
    setDraftIsSpoiler(false);
  }

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditDraft(c.content);
  }

  function saveEdit() {
    if (!editingId || !editDraft.trim()) return;
    commentsStore.editComment(editingId, editDraft.trim());
    setEditingId(null);
    setEditDraft("");
  }

  function reveal(id: string) {
    setRevealedIds((s) => new Set(s).add(id));
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
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-lunex-gray">
                <input
                  type="checkbox"
                  checked={draftIsSpoiler}
                  onChange={(e) => setDraftIsSpoiler(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary-500"
                />
                هذا التعليق فيه حرق (سيظهر مشوشاً للآخرين)
              </label>
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
          const reaction = commentsStore.reactions[c.id];
          const likes = c.likes + (reaction === "like" ? 1 : 0);
          const dislikes = c.dislikes + (reaction === "dislike" ? 1 : 0);
          const isOwn = c.userId === currentUserId;
          const isEditing = editingId === c.id;
          const isBlurred = c.isSpoiler && !revealedIds.has(c.id) && !isEditing;

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
                  <p className="text-[11px] text-lunex-gray">
                    {timeAgo(c.createdAt)}
                    {c.editedAt && " · معدّل"}
                  </p>
                </div>

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={2} />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" /> إلغاء
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={!editDraft.trim()}>
                        <Check className="h-3.5 w-3.5" /> حفظ
                      </Button>
                    </div>
                  </div>
                ) : isBlurred ? (
                  <button
                    onClick={() => reveal(c.id)}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-start text-sm text-lunex-gray backdrop-blur-md transition-colors hover:bg-black/40"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span className="blur-sm select-none">{c.content}</span>
                    <span className="ms-auto shrink-0 whitespace-nowrap text-xs font-bold text-amber-300">حرق — اضغط للإظهار</span>
                  </button>
                ) : (
                  <p className="mt-1 text-sm text-lunex-gray">{c.content}</p>
                )}

                {!isEditing && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => commentsStore.react(c.id, "like")}
                      className={cn(
                        "hover-pop flex items-center gap-1 text-xs transition-colors",
                        reaction === "like" ? "text-primary-300" : "text-lunex-gray hover:text-white"
                      )}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" /> {likes}
                    </button>
                    <button
                      onClick={() => commentsStore.react(c.id, "dislike")}
                      className={cn(
                        "hover-pop flex items-center gap-1 text-xs transition-colors",
                        reaction === "dislike" ? "text-red-400" : "text-lunex-gray hover:text-white"
                      )}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" /> {dislikes}
                    </button>
                    <button className="text-xs text-lunex-gray hover:text-white">رد</button>

                    {isOwn && (
                      <>
                        <button
                          onClick={() => startEdit(c)}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-white"
                        >
                          <Pencil className="h-3 w-3" /> تعديل
                        </button>
                        <button
                          onClick={() => commentsStore.deleteComment(c.id)}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" /> حذف
                        </button>
                      </>
                    )}

                    {canModerate && !isOwn && (
                      <>
                        <button
                          onClick={() => commentsStore.setPinned(c.id, !c.isPinned)}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-white"
                        >
                          {c.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          {c.isPinned ? "إلغاء التثبيت" : "تثبيت"}
                        </button>
                        <button
                          onClick={() => commentsStore.setSpoiler(c.id, !c.isSpoiler)}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-white"
                        >
                          <EyeOff className="h-3 w-3" /> {c.isSpoiler ? "إلغاء التشويش" : "تشويش (حرق)"}
                        </button>
                        <button
                          onClick={() => commentsStore.deleteComment(c.id)}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" /> حذف
                        </button>
                      </>
                    )}
                  </div>
                )}
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
