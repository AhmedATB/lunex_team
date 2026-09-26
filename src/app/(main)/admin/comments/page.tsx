"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Pin, PinOff, Trash2, EyeOff, Eye, ThumbsUp, ThumbsDown, Flag, Loader2, AlertCircle } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { useSession } from "@/store/session";
import { authorAsUser, commentApi, commentErrorMessage, type ServerComment } from "@/lib/server-comments";
import { useProfile, avatarSrcFor } from "@/store/profile";
import { timeAgo } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportedComments } from "@/components/moderation/reported-comments";

type StaffComment = ServerComment & { reportCount: number };

const STAFF_ROLES = new Set(["owner", "super_administrator", "moderator"]);
const PAGE = 30;

/**
 * Every comment on the site, from the server (the newest first), for the moderators: pin, blur a spoiler, delete.
 * Reports have their own list above it. Nothing here is kept in the browser.
 */
export default function AdminCommentsPage() {
  useEffect(() => {
    document.title = "إدارة التعليقات | LUNEX TEAM";
  }, []);

  const catalog = useCatalog();
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const role = useSession((s) => s.user?.role);
  const isStaff = role !== undefined && STAFF_ROLES.has(role);
  const seriesById = useMemo(() => new Map(catalog.series.map((s) => [s.id, s])), [catalog.series]);

  const [reportedOnly, setReportedOnly] = useState(false);
  const [comments, setComments] = useState<StaffComment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (before) params.set("before", before);
      if (reportedOnly) params.set("reported", "true");
      const result = await commentApi<{ items: StaffComment[]; hasMore: boolean }>("GET", `/admin?${params}`);
      if (!result.ok || !result.body) {
        setError(commentErrorMessage(result));
        return null;
      }
      setError("");
      return result.body;
    },
    [reportedOnly]
  );

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    setLoading(true);
    load().then((page) => {
      if (cancelled) return;
      setComments(page?.items ?? []);
      setHasMore(page?.hasMore ?? false);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isStaff, load]);

  async function loadMore() {
    const last = comments[comments.length - 1];
    if (!last) return;
    setLoading(true);
    const page = await load(last.createdAt);
    if (page) {
      setComments((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
    }
    setLoading(false);
  }

  async function act(comment: StaffComment, kind: "pin" | "spoiler" | "delete") {
    setBusy(comment.id);
    setError("");
    const result =
      kind === "delete"
        ? await commentApi("DELETE", `/${comment.id}`)
        : await commentApi<ServerComment>("PATCH", `/${comment.id}`, kind === "pin" ? { isPinned: !comment.isPinned } : { isSpoiler: !comment.isSpoiler });
    setBusy(null);
    if (!result.ok) {
      setError(commentErrorMessage(result));
      return;
    }
    if (kind === "delete") setComments((current) => current.filter((c) => c.id !== comment.id));
    else setComments((current) => current.map((c) => (c.id === comment.id ? { ...c, isPinned: kind === "pin" ? !c.isPinned : c.isPinned, isSpoiler: kind === "spoiler" ? !c.isSpoiler : c.isSpoiler } : c)));
  }

  if (!isStaff) {
    return <div className="panel p-10 text-center text-lunex-gray">إدارة التعليقات للمشرفين ومن فوقهم فقط.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-white">إدارة التعليقات</h1>
        <Button variant={reportedOnly ? "default" : "secondary"} size="sm" onClick={() => setReportedOnly((v) => !v)}>
          <Flag className="h-3.5 w-3.5" /> {reportedOnly ? "عرض الكل" : "المُبلّغ عنها فقط"}
        </Button>
      </div>

      <ReportedComments />

      <h2 className="pt-2 font-display text-lg font-bold text-white">{reportedOnly ? "التعليقات المُبلّغ عنها" : "كل التعليقات"}</h2>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="space-y-3">
        {comments.map((c) => {
          const author = authorAsUser(c.author);
          const series = seriesById.get(c.seriesId);
          const working = busy === c.id;
          return (
            <Card key={c.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                  <Image src={avatarSrcFor(author, avatarOverrides)} alt="" fill sizes="36px" className="object-cover" unoptimized />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/profile/${encodeURIComponent(c.author.username)}`} className="text-sm font-semibold text-white hover:text-primary-300">
                      {c.author.displayName}
                    </Link>
                    {series ? (
                      <Link href={`/series/${series.slug}`} className="text-xs text-lunex-gray hover:text-white">على {series.titleAr}</Link>
                    ) : (
                      <span className="text-xs text-lunex-gray">على عمل محذوف</span>
                    )}
                    {c.isPinned && <Badge variant="outline" className="text-[10px]">مثبّت</Badge>}
                    {c.isSpoiler && <Badge variant="outline" className="text-[10px]">مشوّش (حرق)</Badge>}
                    {c.reportCount > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1 text-[10px]">
                        <Flag className="h-2.5 w-2.5" /> {c.reportCount} بلاغ
                      </Badge>
                    )}
                    <span className="text-[11px] text-lunex-gray/70">
                      {timeAgo(c.createdAt)}
                      {c.editedAt && " · معدّل"}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-lunex-gray">{c.content}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-lunex-gray">
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {c.likes}</span>
                    <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3" /> {c.dislikes}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" disabled={working} aria-label={c.isPinned ? "إلغاء التثبيت" : "تثبيت"} onClick={() => act(c, "pin")}>
                    {c.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" disabled={working} aria-label={c.isSpoiler ? "إلغاء التشويش" : "تشويش (حرق)"} onClick={() => act(c, "spoiler")}>
                    {c.isSpoiler ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" disabled={working} aria-label="حذف" className="text-red-400 hover:bg-red-500/10" onClick={() => act(c, "delete")}>
                    {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!loading && comments.length === 0 && <div className="panel p-10 text-center text-lunex-gray">لا توجد تعليقات مطابقة.</div>}
      </div>

      <div className="flex justify-center">
        {loading && <Loader2 className="h-5 w-5 animate-spin text-lunex-gray" />}
        {!loading && hasMore && <Button variant="secondary" onClick={loadMore}>عرض المزيد</Button>}
      </div>
    </div>
  );
}
