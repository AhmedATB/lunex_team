"use client";

import { useEffect, useMemo, useState } from "react";
import { UploadCloud, Trash2, Search, Plus, BookText } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useSession } from "@/store/session";
import { useTeamManagement } from "@/store/team-management";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { timeAgo, cn } from "@/lib/utils";
import type { SeriesType } from "@/lib/types";

export default function AdminChaptersPage() {
  useEffect(() => {
    document.title = "إدارة الفصول | LUNEX TEAM";
  }, []);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [droppedCount, setDroppedCount] = useState<number | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const db = useMemo(() => getMockDatabase(), []);
  const currentUserId = useSession((s) => s.currentUserId);
  const store = useTeamManagement();
  const seriesMap = useMemo(() => new Map([...db.series, ...store.addedSeries].map((s) => [s.id, s])), [db.series, store.addedSeries]);

  const removedIds = new Set(store.removedChapterIds);
  const allChapters = [...db.chapters, ...store.addedChapters]
    .filter((c) => !removedIds.has(c.id))
    .map((c) => ({ ...c, ...store.chapterOverrides[c.id] }));

  const chapters = useMemo(
    () =>
      [...allChapters]
        .sort((a, b) => +new Date(b.releasedAt) - +new Date(a.releasedAt))
        .filter((c) => !query || seriesMap.get(c.seriesId)?.titleAr.includes(query))
        .slice(0, 40),
    [allChapters, query, seriesMap]
  );

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function deleteSelected() {
    if (!currentUserId) return;
    for (const id of selected) {
      const chapter = allChapters.find((c) => c.id === id);
      if (chapter) store.removeChapter(chapter.id, chapter.teamId, currentUserId);
    }
    setSelected(new Set());
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-white">إدارة الفصول</h1>

      <Card>
        <CardHeader><CardTitle>رفع فصل جديد</CardTitle></CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              setDroppedCount(e.dataTransfer.files.length || undefined);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-primary-400 bg-primary-500/10" : "border-white/15 bg-white/[0.02]"
            }`}
          >
            <UploadCloud className="h-10 w-10 text-primary-300" />
            <p className="text-sm text-white">اسحب وأفلت ملفات الصور أو ZIP هنا لسلاسل المانهوا</p>
            <p className="text-xs text-lunex-gray">يدعم JPG, PNG, WebP وملفات ZIP (حد أقصى 200 ميجابايت) — أو أنشئ فصلاً نصياً لسلسلة رواية من الزر أدناه</p>
            {currentUserId && (
              <div className="flex gap-2 pt-2">
                <CreateChapterDialog
                  series={[...db.series, ...store.addedSeries].map((s) => ({ id: s.id, titleAr: s.titleAr, teamId: s.teamId, type: s.type }))}
                  defaultPages={droppedCount}
                  onCreate={(c) => store.createChapter(c, currentUserId)}
                  trigger={<Button size="sm"><Plus className="h-4 w-4" /> فصل جديد</Button>}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالسلسلة..." className="ps-9" />
        </div>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={deleteSelected}>
            <Trash2 className="h-4 w-4" /> حذف المحدد ({selected.size})
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-lunex-gray">
                <th className="w-10 p-3"></th>
                <th className="p-3 text-start font-medium">السلسلة</th>
                <th className="p-3 text-start font-medium">الفصل</th>
                <th className="p-3 text-start font-medium">المحتوى</th>
                <th className="p-3 text-start font-medium">الحالة</th>
                <th className="p-3 text-start font-medium">تاريخ النشر</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="p-3">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  </td>
                  <td className="max-w-[200px] truncate p-3 font-medium text-white">
                    {seriesMap.get(c.seriesId)?.titleAr}
                  </td>
                  <td className="p-3 text-lunex-gray">{c.title}</td>
                  <td className="p-3 text-lunex-gray">
                    {c.content ? (
                      <span className="flex items-center gap-1.5">
                        <BookText className="h-3.5 w-3.5" /> {c.content.trim().split(/\s+/).length} كلمة
                      </span>
                    ) : (
                      `${c.pages} صفحة`
                    )}
                  </td>
                  <td className="p-3"><Badge variant={c.isPublished ? "success" : "secondary"}>{c.isPublished ? "منشور" : "مسودة"}</Badge></td>
                  <td className="p-3 text-lunex-gray">{timeAgo(c.releasedAt)}</td>
                </tr>
              ))}
              {chapters.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-lunex-gray">لا توجد فصول مطابقة.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateChapterDialog({
  series,
  defaultPages,
  onCreate,
  trigger,
}: {
  series: { id: string; titleAr: string; teamId: string; type: SeriesType }[];
  defaultPages?: number;
  onCreate: (chapter: { seriesId: string; teamId: string; number: number; title: string; pages?: number; content?: string }) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? "");
  const [number, setNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState(defaultPages ?? 20);
  const [content, setContent] = useState("");

  const selected = series.find((x) => x.id === seriesId);
  const isNovel = selected?.type === "novel";

  function submit() {
    const s = series.find((x) => x.id === seriesId);
    if (!s || !title.trim() || number < 1) return;
    if (isNovel) {
      if (!content.trim()) return;
      onCreate({ seriesId: s.id, teamId: s.teamId, number, title: title.trim(), content: content.trim() });
    } else {
      if (pages < 1) return;
      onCreate({ seriesId: s.id, teamId: s.teamId, number, title: title.trim(), pages });
    }
    setTitle(""); setNumber(1); setPages(defaultPages ?? 20); setContent(""); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isNovel ? "إضافة فصل رواية جديد" : "رفع فصل جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>السلسلة</Label>
            <Select value={seriesId} onValueChange={setSeriesId}>
              <SelectTrigger><SelectValue placeholder="اختر سلسلة" /></SelectTrigger>
              <SelectContent>
                {series.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.titleAr} {s.type === "novel" && "— رواية"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={cn("grid gap-3", !isNovel && "sm:grid-cols-2")}>
            <div className="space-y-1.5">
              <Label>رقم الفصل</Label>
              <Input type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
            </div>
            {!isNovel && (
              <div className="space-y-1.5">
                <Label>عدد الصفحات</Label>
                <Input type="number" min={1} value={pages} onChange={(e) => setPages(Number(e.target.value))} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>عنوان الفصل</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: الفصل الأول" />
          </div>
          {isNovel && (
            <div className="space-y-1.5">
              <Label>نص الفصل (بالعربية)</Label>
              <Textarea
                dir="rtl"
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="الصق أو اكتب نص الفصل هنا. افصل بين الفقرات بسطر فارغ."
                className="resize-y"
              />
              <p className="text-xs text-lunex-gray">{content.trim() ? content.trim().split(/\s+/).length : 0} كلمة</p>
            </div>
          )}
          <Button onClick={submit} className="w-full">{isNovel ? "نشر الفصل" : "رفع الفصل"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
