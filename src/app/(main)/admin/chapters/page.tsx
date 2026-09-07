"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UploadCloud, Trash2, Search, Plus, BookText, ShieldCheck, X, GripVertical } from "lucide-react";
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
import { timeAgo } from "@/lib/utils";
import type { SeriesType } from "@/lib/types";

interface RealChapter {
  id: string;
  seriesId: string;
  teamId: string;
  number: number;
  title: string;
  isPublished: boolean;
  createdAt: string;
  pages: { id: string; pageNumber: number }[];
}

interface Row {
  id: string;
  seriesId: string;
  teamId: string;
  title: string;
  contentLabel: string;
  isPublished: boolean;
  at: string;
  isReal: boolean;
}

export default function AdminChaptersPage() {
  useEffect(() => {
    document.title = "إدارة الفصول | LUNEX TEAM";
  }, []);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [realChapters, setRealChapters] = useState<RealChapter[]>([]);
  const db = useMemo(() => getMockDatabase(), []);
  const currentUserId = useSession((s) => s.currentUserId);
  const store = useTeamManagement();
  const seriesMap = useMemo(() => new Map([...db.series, ...store.addedSeries].map((s) => [s.id, s])), [db.series, store.addedSeries]);

  const loadRealChapters = useCallback(() => {
    fetch("/api/chapters/admin/recent")
      .then((res) => (res.ok ? res.json() : []))
      .then((body) => setRealChapters(Array.isArray(body) ? body : []))
      .catch(() => setRealChapters([]));
  }, []);
  useEffect(() => {
    loadRealChapters();
  }, [loadRealChapters]);

  const removedIds = new Set(store.removedChapterIds);
  const mockChapters = [...db.chapters, ...store.addedChapters]
    .filter((c) => !removedIds.has(c.id))
    .map((c) => ({ ...c, ...store.chapterOverrides[c.id] }));

  const rows: Row[] = useMemo(() => {
    const mockRows: Row[] = mockChapters.map((c) => ({
      id: c.id,
      seriesId: c.seriesId,
      teamId: c.teamId,
      title: c.title,
      contentLabel: c.content ? `${c.content.trim().split(/\s+/).length} كلمة` : `${c.pages} صفحة`,
      isPublished: c.isPublished,
      at: c.releasedAt,
      isReal: false,
    }));
    const realRows: Row[] = realChapters.map((c) => ({
      id: c.id,
      seriesId: c.seriesId,
      teamId: c.teamId,
      title: c.title,
      contentLabel: `${c.pages.length} صفحة`,
      isPublished: c.isPublished,
      at: c.createdAt,
      isReal: true,
    }));
    return [...mockRows, ...realRows]
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .filter((r) => !query || seriesMap.get(r.seriesId)?.titleAr.includes(query))
      .slice(0, 40);
  }, [mockChapters, realChapters, query, seriesMap]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (!currentUserId) return;
    for (const id of selected) {
      const mockMatch = mockChapters.find((c) => c.id === id);
      if (mockMatch) {
        store.removeChapter(mockMatch.id, mockMatch.teamId, currentUserId);
        continue;
      }
      await fetch(`/api/chapters/${id}`, { method: "DELETE" }).catch(() => {});
    }
    setSelected(new Set());
    loadRealChapters();
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
              const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
              if (files.length) setDroppedFiles(files.sort((a, b) => a.name.localeCompare(b.name)));
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-primary-400 bg-primary-500/10" : "border-white/15 bg-white/[0.02]"
            }`}
          >
            <UploadCloud className="h-10 w-10 text-primary-300" />
            <p className="text-sm text-white">اسحب وأفلت صور الفصل هنا (001.webp, 002.webp...) لسلاسل المانهوا</p>
            <p className="text-xs text-lunex-gray">تُحفظ الصور بشكل خاص ومحمي تلقائياً — أو أنشئ فصلاً نصياً لسلسلة رواية من الزر أدناه</p>
            {currentUserId && (
              <div className="flex gap-2 pt-2">
                <CreateChapterDialog
                  series={[...db.series, ...store.addedSeries].map((s) => ({ id: s.id, titleAr: s.titleAr, teamId: s.teamId, type: s.type }))}
                  defaultFiles={droppedFiles}
                  onCreateNovel={(c) => store.createChapter(c, currentUserId)}
                  onUploaded={loadRealChapters}
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
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="p-3">
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                  </td>
                  <td className="max-w-[200px] truncate p-3 font-medium text-white">
                    {seriesMap.get(r.seriesId)?.titleAr}
                  </td>
                  <td className="p-3 text-lunex-gray">{r.title}</td>
                  <td className="p-3 text-lunex-gray">
                    <span className="flex items-center gap-1.5">
                      {r.contentLabel.includes("كلمة") ? <BookText className="h-3.5 w-3.5" /> : null}
                      {r.contentLabel}
                      {r.isReal && (
                        <Badge variant="outline" className="flex items-center gap-1 text-[10px]">
                          <ShieldCheck className="h-2.5 w-2.5" /> محمي
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="p-3"><Badge variant={r.isPublished ? "success" : "secondary"}>{r.isPublished ? "منشور" : "مسودة"}</Badge></td>
                  <td className="p-3 text-lunex-gray">{timeAgo(r.at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
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
  defaultFiles,
  onCreateNovel,
  onUploaded,
  trigger,
}: {
  series: { id: string; titleAr: string; teamId: string; type: SeriesType }[];
  defaultFiles?: File[];
  onCreateNovel: (chapter: { seriesId: string; teamId: string; number: number; title: string; content: string }) => void;
  onUploaded: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? "");
  const [number, setNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>(defaultFiles ?? []);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultFiles) setFiles(defaultFiles);
  }, [defaultFiles]);

  const selectedSeries = series.find((x) => x.id === seriesId);
  const isNovel = selectedSeries?.type === "novel";

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list)
      .filter((f) => f.type.startsWith("image/"))
      .sort((a, b) => a.name.localeCompare(b.name));
    setFiles(picked);
  }

  function moveFile(index: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitNovel() {
    const s = series.find((x) => x.id === seriesId);
    if (!s || !title.trim() || number < 1 || !content.trim()) return;
    onCreateNovel({ seriesId: s.id, teamId: s.teamId, number, title: title.trim(), content: content.trim() });
    reset();
  }

  async function submitImages() {
    const s = series.find((x) => x.id === seriesId);
    if (!s || !title.trim() || number < 1 || files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      setProgress("إنشاء الفصل...");
      const createRes = await fetch("/api/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId: s.id, teamId: s.teamId, number, title: title.trim() }),
      });
      const chapter = await createRes.json();
      if (!createRes.ok) {
        setError(chapter?.message ?? "تعذر إنشاء الفصل.");
        return;
      }

      for (let i = 0; i < files.length; i++) {
        setProgress(`رفع الصفحة ${i + 1} من ${files.length}...`);
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("pageNumber", String(i + 1));
        const pageRes = await fetch(`/api/chapters/${chapter.id}/pages`, { method: "POST", body: formData });
        if (!pageRes.ok) {
          const body = await pageRes.json().catch(() => null);
          setError(body?.message ?? `تعذر رفع الصفحة ${i + 1}.`);
          return;
        }
      }

      setProgress("نشر الفصل...");
      await fetch(`/api/chapters/${chapter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      });

      onUploaded();
      reset();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى.");
    } finally {
      setUploading(false);
      setProgress("");
    }
  }

  function reset() {
    setTitle("");
    setNumber(1);
    setContent("");
    setFiles([]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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
          <div className="space-y-1.5">
            <Label>رقم الفصل</Label>
            <Input type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>عنوان الفصل</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: الفصل الأول" />
          </div>

          {isNovel ? (
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
          ) : (
            <div className="space-y-1.5">
              <Label>صفحات الفصل بالترتيب</Label>
              <Input type="file" multiple accept="image/*" onChange={(e) => pickFiles(e.target.files)} />
              {files.length > 0 && (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5 text-xs">
                      <GripVertical className="h-3 w-3 shrink-0 text-lunex-gray" />
                      <span className="w-6 shrink-0 text-center font-bold text-primary-300">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-white">{f.name}</span>
                      <button type="button" onClick={() => moveFile(i, -1)} disabled={i === 0} className="text-lunex-gray hover:text-white disabled:opacity-30">▲</button>
                      <button type="button" onClick={() => moveFile(i, 1)} disabled={i === files.length - 1} className="text-lunex-gray hover:text-white disabled:opacity-30">▼</button>
                      <button type="button" onClick={() => removeFile(i)} className="text-lunex-gray hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-lunex-gray">{files.length} صفحة محددة — بالترتيب الظاهر أعلاه.</p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {uploading && progress && <p className="text-sm text-primary-300">{progress}</p>}

          <Button
            onClick={isNovel ? submitNovel : submitImages}
            disabled={uploading || (!isNovel && files.length === 0)}
            className="w-full"
          >
            {uploading ? progress || "جارِ الرفع..." : isNovel ? "نشر الفصل" : "رفع ونشر الفصل"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
