"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Plus, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { ChapterUploadDialog } from "@/components/admin/chapter-upload-dialog";
import { ChapterPreviewDialog } from "@/components/admin/chapter-preview";
import { ReplacePageDialog, ThumbnailDialog } from "@/components/admin/chapter-tools";
import { chapterThumbnailUrl } from "@/components/admin/thumbnail-picker";
import { chapterApi } from "@/lib/chapter-api";
import { chapterLabel } from "@/lib/chapter-label";
import type { TeamLevel } from "@/lib/auth-types";
import { canPublishAt, TEAM_LEVEL_LABELS } from "@/lib/team-access";
import { timeAgo } from "@/lib/utils";
import { useToast } from "@/store/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface TeamChapter {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  isPublished: boolean;
  createdAt: string;
  pages: { id: string; pageNumber: number }[];
  thumbnailAssetId?: string | null;
}

export interface TeamSeriesOption {
  id: string;
  titleAr: string;
  teamId: string;
  type: string;
  latestChapterNumber: number;
}

const say = (title: string, description?: string) => useToast.getState().push({ title, description });

/**
 * A team's chapters: upload one (pictures, a ZIP or a Google Drive folder), preview it as readers will see it and fix it there, put it live or take it down, fix a page, choose its
 * featured picture. What shows is what the server will honour for the person's level: a lead does everything, a publisher uploads
 * and publishes, an uploader only uploads (the chapter stays a draft). The server returns only this team's chapters.
 */
export function TeamChaptersPanel({ series, level }: { series: TeamSeriesOption[]; level: TeamLevel }) {
  const [chapters, setChapters] = useState<TeamChapter[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const titles = useMemo(() => new Map(series.map((s) => [s.id, s.titleAr])), [series]);
  const imageSeries = useMemo(() => series.filter((s) => s.type !== "novel"), [series]);
  const canPublish = canPublishAt(level);

  const load = useCallback(() => {
    fetch("/api/chapters/admin/recent")
      .then((res) => (res.ok ? res.json() : []))
      .then((body) => setChapters(Array.isArray(body) ? body : []))
      .catch(() => setChapters([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function setPublished(chapter: TeamChapter, next: boolean) {
    setBusyId(chapter.id);
    const result = await chapterApi.setPublished(chapter.id, next);
    setBusyId(null);
    if (!result.ok) return say(next ? "تعذر نشر الفصل" : "تعذر إلغاء النشر", result.message);
    say(next ? "نُشر الفصل" : "أُلغي نشر الفصل", chapterLabel(chapter));
    load();
  }

  async function remove(chapter: TeamChapter) {
    if (!window.confirm(`حذف ${chapterLabel(chapter)} نهائيًا مع كل صفحاته؟`)) return;
    setBusyId(chapter.id);
    const result = await chapterApi.remove(chapter.id);
    setBusyId(null);
    if (!result.ok) return say("تعذر حذف الفصل", result.message);
    load();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-5 text-center">
          <UploadCloud className="h-9 w-9 text-primary-300" />
          <p className="text-sm text-white">ارفع صور الفصل أو ملف ZIP من جهازك أو من مجلد Google Drive</p>
          <p className="max-w-md text-xs leading-relaxed text-lunex-gray">
            صلاحيتك: {TEAM_LEVEL_LABELS[level]}
            {canPublish ? " — ترفع الفصول وتنشرها." : " — ترفع الفصول وتبقى مسودة حتى ينشرها قائد الفريق أو الناشر."}
          </p>
          <Button size="sm" onClick={() => setUploadOpen(true)} disabled={imageSeries.length === 0}>
            <Plus className="h-4 w-4" /> فصل جديد (صور / ZIP / درايف)
          </Button>
          {imageSeries.length === 0 && (
            <p className="text-xs text-amber-300">لا يوجد عمل معتمد للفريق بعد. أضيفوا سلسلة من تبويب «السلاسل» وانتظروا موافقة الإدارة.</p>
          )}
        </CardContent>
      </Card>

      <ChapterPreviewDialog chapterId={previewId} canPublish={canPublish} onClose={() => setPreviewId(null)} onChanged={load} />
      <ChapterUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} series={imageSeries} canPublish={canPublish} onDone={load} />

      {chapters === null && <Loader2 className="mx-auto h-5 w-5 animate-spin text-lunex-gray" aria-label="جارِ التحميل" />}
      {chapters?.length === 0 && <p className="p-6 text-center text-sm text-lunex-gray">لا توجد فصول للفريق بعد.</p>}
      {chapters?.map((chapter) => {
        const label = chapterLabel(chapter);
        const thumbnail = chapter.thumbnailAssetId ? chapterThumbnailUrl(chapter.id, chapter.thumbnailAssetId) : undefined;
        return (
          <Card key={chapter.id} className="panel-hover">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="line-clamp-1 font-bold text-white">{titles.get(chapter.seriesId) ?? "عمل بانتظار الموافقة"}</p>
                  <p className="text-sm text-lunex-gray">{label}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="hidden items-center gap-1 text-[10px] sm:flex">
                    <ShieldCheck className="h-2.5 w-2.5" /> محمي
                  </Badge>
                  <Badge variant={chapter.isPublished ? "success" : "secondary"}>{chapter.isPublished ? "منشور" : "مسودة"}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-lunex-gray">
                <span>{chapter.pages.length} صفحة</span>
                <span>· {timeAgo(chapter.createdAt)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {chapter.pages.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setPreviewId(chapter.id)}>
                    <Eye className="h-3.5 w-3.5" /> معاينة وتعديل
                  </Button>
                )}
                {canPublish && (
                  <Button size="sm" variant="secondary" disabled={busyId === chapter.id} onClick={() => setPublished(chapter, !chapter.isPublished)}>
                    {busyId === chapter.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {chapter.isPublished ? "إلغاء النشر" : "نشر"}
                  </Button>
                )}
                {chapter.pages.length > 0 && (
                  <>
                    <ReplacePageDialog chapterId={chapter.id} label={label} pageCount={chapter.pages.length} onDone={load} />
                    <ThumbnailDialog chapterId={chapter.id} label={label} current={thumbnail} onDone={load} />
                  </>
                )}
                {level === "lead" && (
                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" disabled={busyId === chapter.id} onClick={() => remove(chapter)}>
                    <Trash2 className="h-3.5 w-3.5" /> حذف
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
