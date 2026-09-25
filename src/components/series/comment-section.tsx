"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, Pin, PinOff, Send, Pencil, Trash2, EyeOff, AlertTriangle, AlertCircle, Check, X, Flag, Loader2 } from "lucide-react";
import type { Comment, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo, cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { useProfile, avatarSrcFor } from "@/store/profile";
import { useTeamManagement, applyTeamOverride } from "@/store/team-management";
import { useComments, mergeComments } from "@/store/comments";
import { getTeamAuthRoles, getEffectiveCustomRoles } from "@/lib/team-auth";
import { canInTeam } from "@/lib/rbac";
import { getMockDatabase } from "@/lib/mock/generate";
import { useMuteStatus } from "@/lib/use-mute-status";
import {
  authorAsUser,
  commentApi,
  commentErrorMessage,
  fetchSeriesComments,
  serverToRow,
  type CommentRow,
  type Reaction,
  type ServerComment,
} from "@/lib/server-comments";
import { MuteNotice } from "@/components/moderation/mute-notice";

const REPORT_REASONS = ["محتوى غير مناسب", "تحرش أو إساءة", "معلومات مضللة", "سبام", "أخرى"];
const STAFF_ROLES = new Set(["owner", "super_administrator", "moderator"]);

/** What a comment row reads off its author — satisfied by a mock `User` and by a real account's public author alike. */
interface Person {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  avatarVersion?: string | null;
}

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
  const [serverRows, setServerRows] = useState<CommentRow[]>([]);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const currentUserId = useSession((s) => s.currentUserId);
  const viewerRole = useSession((s) => s.user?.role);
  const isStaff = viewerRole !== undefined && STAFF_ROLES.has(viewerRole);
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
  /** For the demo catalogue's comments, which still use the team-based permission model. */
  const canModerateMock = Boolean(
    effectiveCurrentUser &&
      (isGlobalAdmin || (isMember && canInTeam(effectiveCurrentUser, "moderate_comments", customRoles)))
  );

  // Real accounts' comments come from the server (re-fetched when who is looking changes, so each carries the viewer's own reaction).
  useEffect(() => {
    let cancelled = false;
    fetchSeriesComments(seriesId).then((rows) => {
      if (!cancelled && rows) setServerRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId, currentUserId]);

  const comments: CommentRow[] = [...serverRows, ...mergeComments(initialComments, commentsStore)].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });

  const mute = useMuteStatus();

  function replaceServerRow(updated: ServerComment) {
    const row = serverToRow(updated);
    setServerRows((rows) => rows.map((r) => (r.id === row.id ? row : r)));
  }

  async function post() {
    if (!draft.trim() || !currentUser || mute.muted || busy) return;
    setActionError("");
    setBusy("post");
    const res = await commentApi<ServerComment>("POST", "", { seriesId, content: draft, isSpoiler: draftIsSpoiler });
    setBusy(null);
    if (!res.ok || !res.body) {
      setActionError(commentErrorMessage(res));
      return;
    }
    setServerRows((rows) => [serverToRow(res.body as ServerComment), ...rows]);
    commentsStore.notePostedOnServer(currentUser.id);
    setDraft("");
    setDraftIsSpoiler(false);
  }

  function startEdit(c: Comment) {
    setEditingId(c.id);
    setEditDraft(c.content);
  }

  async function saveEdit() {
    if (!editingId || !editDraft.trim()) return;
    const target = comments.find((c) => c.id === editingId);
    if (target?.server) {
      setActionError("");
      setBusy(editingId);
      const res = await commentApi<ServerComment>("PATCH", `/${editingId}`, { content: editDraft });
      setBusy(null);
      if (!res.ok || !res.body) {
        setActionError(commentErrorMessage(res));
        return;
      }
      replaceServerRow(res.body);
    } else {
      commentsStore.editComment(editingId, editDraft.trim());
    }
    setEditingId(null);
    setEditDraft("");
  }

  async function remove(c: CommentRow) {
    if (!c.server) {
      commentsStore.deleteComment(c.id);
      return;
    }
    setActionError("");
    setBusy(c.id);
    const res = await commentApi("DELETE", `/${c.id}`);
    setBusy(null);
    if (!res.ok) {
      setActionError(commentErrorMessage(res));
      return;
    }
    setServerRows((rows) => rows.filter((r) => r.id !== c.id));
  }

  async function patch(c: CommentRow, body: { isPinned?: boolean; isSpoiler?: boolean }) {
    if (!c.server) {
      if (body.isPinned !== undefined) commentsStore.setPinned(c.id, body.isPinned);
      if (body.isSpoiler !== undefined) commentsStore.setSpoiler(c.id, body.isSpoiler);
      return;
    }
    setActionError("");
    setBusy(c.id);
    const res = await commentApi<ServerComment>("PATCH", `/${c.id}`, body);
    setBusy(null);
    if (!res.ok || !res.body) {
      setActionError(commentErrorMessage(res));
      return;
    }
    replaceServerRow(res.body);
  }

  async function react(c: CommentRow, kind: Reaction) {
    if (!c.server) {
      commentsStore.react(c.id, kind);
      return;
    }
    if (!currentUserId) {
      setActionError("سجّل الدخول للتفاعل مع التعليقات.");
      return;
    }
    const before = c;
    const next: Reaction | null = c.myReaction === kind ? null : kind;
    // Optimistic: the buttons respond at once, the server's counts replace this when they arrive.
    setServerRows((rows) =>
      rows.map((r) => {
        if (r.id !== c.id) return r;
        let { likes, dislikes } = r;
        if (r.myReaction === "like") likes -= 1;
        if (r.myReaction === "dislike") dislikes -= 1;
        if (next === "like") likes += 1;
        if (next === "dislike") dislikes += 1;
        return { ...r, likes, dislikes, myReaction: next };
      })
    );
    setActionError("");
    const res = await commentApi<{ likes: number; dislikes: number; myReaction: Reaction | null }>("PUT", `/${c.id}/reaction`, {
      kind: next ?? "none",
    });
    if (!res.ok || !res.body) {
      setServerRows((rows) => rows.map((r) => (r.id === c.id ? before : r)));
      setActionError(commentErrorMessage(res));
      return;
    }
    const counts = res.body;
    setServerRows((rows) => rows.map((r) => (r.id === c.id ? { ...r, ...counts } : r)));
  }

  function reveal(id: string) {
    setRevealedIds((s) => new Set(s).add(id));
  }

  async function report(c: CommentRow, reason: string) {
    if (!currentUserId) return;
    if (!c.server) {
      commentsStore.reportComment(c.id, currentUserId, reason);
      return;
    }
    setActionError("");
    const res = await commentApi("POST", `/${c.id}/report`, { reason });
    if (!res.ok) {
      setActionError(commentErrorMessage(res));
      return;
    }
    setReportedIds((ids) => new Set(ids).add(c.id));
  }

  function hasReported(id: string) {
    return reportedIds.has(id) || Boolean(currentUserId && commentsStore.reports[id]?.some((r) => r.reporterId === currentUserId));
  }

  return (
    <div className="space-y-4">
      {currentUser && (
        <div className="flex gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/40 shadow-[0_0_14px_rgba(168,85,247,0.35)]">
            <Image src={avatarSrcFor(currentUser, avatarOverrides)} alt={currentUser.displayName} fill sizes="40px" className="object-cover" />
          </div>
          <div className="flex-1 space-y-2">
            <MuteNotice />
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="شارك رأيك حول هذا العمل..."
              rows={2}
              maxLength={2000}
              disabled={mute.muted}
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
              <Button size="sm" onClick={post} disabled={!draft.trim() || mute.muted || busy === "post"}>
                {busy === "post" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} نشر
              </Button>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {actionError}
        </p>
      )}

      <div className="space-y-3">
        {comments.map((c) => {
          const user: Person | undefined =
            c.server && c.author ? authorAsUser(c.author) : (userMap.get(c.userId) ?? getMockDatabase().users.find((u) => u.id === c.userId));
          if (!user) return null;
          const reaction = c.server ? (c.myReaction ?? undefined) : commentsStore.reactions[c.id];
          const likes = c.server ? c.likes : c.likes + (reaction === "like" ? 1 : 0);
          const dislikes = c.server ? c.dislikes : c.dislikes + (reaction === "dislike" ? 1 : 0);
          const isOwn = c.userId === currentUserId;
          const isEditing = editingId === c.id;
          const isBlurred = c.isSpoiler && !revealedIds.has(c.id) && !isEditing;
          const canModerate = c.server ? isStaff : canModerateMock;
          const working = busy === c.id;

          return (
            <div key={c.id} className={cn("panel panel-hover flex gap-3 p-4", working && "opacity-70")}>
              <Link
                href={`/profile/${encodeURIComponent(user.username)}`}
                className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10 transition-shadow hover:ring-primary-400/60"
                aria-label={`الملف الشخصي لـ ${user.displayName}`}
              >
                <Image src={avatarSrcFor(user, avatarOverrides)} alt={user.displayName} fill sizes="36px" className="object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${encodeURIComponent(user.username)}`} className="text-sm font-semibold text-white hover:text-primary-300">
                    {user.displayName}
                  </Link>
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
                    <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={2} maxLength={2000} />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" /> إلغاء
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={!editDraft.trim() || working}>
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
                  <p className="mt-1 whitespace-pre-line text-sm text-lunex-gray">{c.content}</p>
                )}

                {!isEditing && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => react(c, "like")}
                      disabled={c.server && isOwn}
                      className={cn(
                        "hover-pop flex items-center gap-1 text-xs transition-colors disabled:cursor-default disabled:opacity-60",
                        reaction === "like" ? "text-primary-300" : "text-lunex-gray hover:text-white"
                      )}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" /> {likes}
                    </button>
                    <button
                      onClick={() => react(c, "dislike")}
                      disabled={c.server && isOwn}
                      className={cn(
                        "hover-pop flex items-center gap-1 text-xs transition-colors disabled:cursor-default disabled:opacity-60",
                        reaction === "dislike" ? "text-red-400" : "text-lunex-gray hover:text-white"
                      )}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" /> {dislikes}
                    </button>
                    <button className="text-xs text-lunex-gray hover:text-white">رد</button>

                    {!isOwn && currentUserId && (
                      hasReported(c.id) ? (
                        <span className="flex items-center gap-1 text-xs text-lunex-gray/60">
                          <Flag className="h-3 w-3" /> تم الإبلاغ
                        </span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 text-xs text-lunex-gray hover:text-red-400">
                              <Flag className="h-3 w-3" /> بلاغ
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel>سبب البلاغ</DropdownMenuLabel>
                            {REPORT_REASONS.map((reason) => (
                              <DropdownMenuItem key={reason} onClick={() => report(c, reason)}>
                                {reason}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )
                    )}

                    {isOwn && (
                      <>
                        <button
                          onClick={() => startEdit(c)}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-white"
                        >
                          <Pencil className="h-3 w-3" /> تعديل
                        </button>
                        <button
                          onClick={() => remove(c)}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" /> حذف
                        </button>
                      </>
                    )}

                    {canModerate && !isOwn && (
                      <>
                        <button
                          onClick={() => patch(c, { isPinned: !c.isPinned })}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-white"
                        >
                          {c.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          {c.isPinned ? "إلغاء التثبيت" : "تثبيت"}
                        </button>
                        <button
                          onClick={() => patch(c, { isSpoiler: !c.isSpoiler })}
                          className="flex items-center gap-1 text-xs text-lunex-gray hover:text-white"
                        >
                          <EyeOff className="h-3 w-3" /> {c.isSpoiler ? "إلغاء التشويش" : "تشويش (حرق)"}
                        </button>
                        <button
                          onClick={() => remove(c)}
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
