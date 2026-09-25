"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Check, Flag, Loader2, Trash2 } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useProfile, avatarSrcFor } from "@/store/profile";
import { useSession } from "@/store/session";
import { authorAsUser, commentApi, commentErrorMessage, type ServerComment } from "@/lib/server-comments";
import { timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QueueItem {
  comment: ServerComment;
  reports: { reporter: string; reason: string; createdAt: string }[];
}

const STAFF_ROLES = new Set(["owner", "super_administrator", "moderator"]);

/**
 * Reports against real members' comments. The demo catalogue's own reports are
 * handled by the list below this on the admin page; these live on the server
 * and only global staff (moderator and above) can see or act on them.
 */
export function ReportedComments() {
  const role = useSession((s) => s.user?.role);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const seriesById = useMemo(() => new Map(getMockDatabase().series.map((s) => [s.id, s])), []);
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isStaff = role !== undefined && STAFF_ROLES.has(role);

  const load = useCallback(async () => {
    const res = await commentApi<{ items: QueueItem[] }>("GET", "/reports/queue");
    if (res.ok && res.body) setItems(res.body.items);
  }, []);

  useEffect(() => {
    if (isStaff) load();
  }, [isStaff, load]);

  if (!isStaff || items === null) return null;

  async function act(id: string, kind: "remove" | "dismiss") {
    setError("");
    setBusy(id);
    const res = kind === "remove" ? await commentApi("DELETE", `/${id}`) : await commentApi("DELETE", `/${id}/reports`);
    setBusy(null);
    if (!res.ok) {
      setError(commentErrorMessage(res));
      return;
    }
    setItems((current) => (current ?? []).filter((i) => i.comment.id !== id));
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
        <Flag className="h-4 w-4 text-red-400" /> بلاغات تعليقات الأعضاء
        <Badge variant={items.length > 0 ? "destructive" : "secondary"}>{items.length}</Badge>
      </h2>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-400" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="panel p-4 text-center text-sm text-lunex-gray">لا توجد بلاغات مفتوحة على تعليقات الأعضاء.</p>
      ) : (
        items.map(({ comment, reports }) => {
          const author = authorAsUser(comment.author);
          const series = seriesById.get(comment.seriesId);
          return (
            <Card key={comment.id} className="border-red-500/20">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                    <Image src={avatarSrcFor(author, avatarOverrides)} alt={author.displayName} fill sizes="36px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <Link href={`/profile/${encodeURIComponent(author.username)}`} className="font-semibold text-white hover:text-primary-300">
                        {author.displayName}
                      </Link>{" "}
                      {series && <span className="text-lunex-gray">على {series.titleAr}</span>}{" "}
                      <span className="text-[11px] text-lunex-gray/70">{timeAgo(comment.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-lunex-gray">{comment.content}</p>
                  </div>
                </div>

                <ul className="space-y-1 rounded-lg bg-red-500/5 p-3 text-xs text-lunex-gray">
                  {reports.map((r) => (
                    <li key={r.reporter}>
                      <span className="font-semibold text-white">@{r.reporter}</span>: {r.reason}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" disabled={busy !== null} onClick={() => act(comment.id, "remove")}>
                    {busy === comment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} حذف التعليق
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => act(comment.id, "dismiss")}>
                    <Check className="h-3.5 w-3.5" /> تجاهل البلاغات
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/profile/${encodeURIComponent(author.username)}`}>ملف صاحب التعليق</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
}
