"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileArchive, GripVertical, HardDrive, ImageIcon, Loader2, X } from "lucide-react";
import { chapterApi, type DriveInfo } from "@/lib/chapter-api";
import { imagesFromZip, naturalCompare, ZipError } from "@/lib/zip-reader";
import { useToast } from "@/store/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface UploadTarget {
  id: string;
  titleAr: string;
  teamId: string;
  /** The newest chapter number it has, to suggest the next one. */
  latestChapterNumber: number;
}

type Source = "images" | "zip" | "drive";

const POLL_MS = 1500;
const POLL_LIMIT_MS = 20 * 60_000;
const isImage = (file: File) => file.type.startsWith("image/");

/**
 * Upload a chapter's pages: pictures chosen from the device, a ZIP of them (opened here, in the browser), or a Google Drive
 * folder (fetched by the server). Pages go up in reading order, one after the other, because a long picture is cut into
 * several pages by the server and the next one is numbered after them; the chapter is published when they are all there (or
 * kept as a draft). If anything fails the half-made chapter is removed, so nothing is left behind. A work with no team can
 * be published too: the chapter then belongs to no team.
 */
export function ChapterUploadDialog({
  open,
  onClose,
  series,
  initialFiles,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  series: UploadTarget[];
  /** Files dropped on the page's upload area: pictures, or one ZIP. */
  initialFiles?: File[];
  onDone: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        {open && <Form series={series} initialFiles={initialFiles} onClose={onClose} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ series, initialFiles, onClose, onDone }: { series: UploadTarget[]; initialFiles?: File[]; onClose: () => void; onDone: () => void }) {
  const [seriesId, setSeriesId] = useState(series[0]?.id ?? "");
  const target = series.find((s) => s.id === seriesId);
  const [number, setNumber] = useState(() => (series[0] ? series[0].latestChapterNumber + 1 : 1));
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<Source>("images");
  const [files, setFiles] = useState<File[]>([]);
  const [zipName, setZipName] = useState("");
  const [zipBusy, setZipBusy] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [drive, setDrive] = useState<DriveInfo | null>(null);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    void chapterApi.driveInfo().then((r) => setDrive(r.ok ? r.body : { configured: false, serviceEmail: null }));
  }, []);

  const suggested = useMemo(() => (target ? target.latestChapterNumber + 1 : 1), [target]);
  useEffect(() => setNumber(suggested), [suggested]);

  // Files dropped on the upload area: a ZIP is opened, pictures are used as they are.
  useEffect(() => {
    if (!initialFiles?.length) return;
    const zip = initialFiles.find((f) => /\.zip$/i.test(f.name));
    if (zip) {
      setSource("zip");
      void openZip(zip);
    } else {
      setSource("images");
      setFiles(initialFiles.filter(isImage).sort((a, b) => naturalCompare(a.name, b.name)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  function pickImages(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list).filter(isImage).sort((a, b) => naturalCompare(a.name, b.name)));
    setError("");
  }

  async function openZip(zip: File) {
    setZipBusy(true);
    setError("");
    setFiles([]);
    setZipName(zip.name);
    try {
      const images = await imagesFromZip(zip);
      if (images.length === 0) setError("لم أجد أي صور داخل الملف.");
      setFiles(images);
    } catch (e) {
      setError(e instanceof ZipError ? e.message : "تعذر فتح الملف. تأكد أنه ملف ZIP سليم.");
    } finally {
      setZipBusy(false);
    }
  }

  function move(index: number, by: -1 | 1) {
    setFiles((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const ready = !!target && title.trim() && number >= 0 && (source === "drive" ? driveLink.trim().length >= 10 && drive?.configured : files.length > 0);

  async function submit() {
    if (!target || !ready || busy) return;
    setBusy(true);
    setError("");
    setProgress({ label: "إنشاء الفصل...", done: 0, total: 1 });

    const created = await chapterApi.create({ seriesId: target.id, teamId: target.teamId || undefined, number, title: title.trim() });
    if (!created.ok) return fail(created.message);
    const chapterId = created.body.id;
    const undo = () => void chapterApi.remove(chapterId);

    if (source === "drive") {
      const started = await chapterApi.importDrive(chapterId, driveLink.trim());
      if (!started.ok) {
        undo();
        return fail(started.message);
      }
      const total = started.body.total;
      const deadline = Date.now() + POLL_LIMIT_MS;
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        if (cancelled.current) return;
        const status = await chapterApi.importStatus(chapterId);
        if (status.ok && status.body) {
          setProgress({ label: "جلب الصفحات من درايف...", done: status.body.done, total });
          if (status.body.state === "done") break;
          if (status.body.state === "failed") {
            undo();
            return fail(`توقف الجلب بعد ${status.body.done} من ${total} صفحة: ${status.body.error ?? "خطأ غير معروف"}`);
          }
        } else if (Date.now() > deadline) {
          undo();
          return fail("استغرق الجلب وقتًا طويلًا جدًا.");
        }
      }
    } else {
      setProgress({ label: "رفع الصفحات...", done: 0, total: files.length });
      // One by one: a long picture becomes several pages, so each upload is numbered after the pages the last one made.
      let nextPage = 1;
      for (const [i, file] of files.entries()) {
        if (cancelled.current) return;
        const result = await chapterApi.uploadPage(chapterId, nextPage, file);
        if (!result.ok) {
          undo();
          return fail(`تعذر رفع الصورة ${i + 1} (${file.name}): ${result.message}`);
        }
        nextPage += result.body?.pages ?? 1;
        setProgress({ label: "رفع الصفحات...", done: i + 1, total: files.length });
      }
    }

    if (publish) {
      setProgress({ label: "نشر الفصل...", done: 1, total: 1 });
      const published = await chapterApi.setPublished(chapterId, true);
      if (!published.ok) return fail(`رُفعت الصفحات لكن تعذر النشر: ${published.message}. ستجد الفصل في القائمة كمسودة.`, true);
    }

    useToast.getState().push({ title: publish ? "نُشر الفصل" : "حُفظ الفصل كمسودة", description: `${target.titleAr} — ${title.trim()}` });
    setBusy(false);
    onDone();
    onClose();
  }

  function fail(message: string, keep = false) {
    setBusy(false);
    setProgress(null);
    setError(message);
    if (keep) onDone();
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>رفع فصل جديد</DialogTitle>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>السلسلة</Label>
        <Select value={seriesId} onValueChange={setSeriesId} disabled={busy}>
          <SelectTrigger><SelectValue placeholder="اختر سلسلة" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {series.map((s) => <SelectItem key={s.id} value={s.id}>{s.titleAr}</SelectItem>)}
          </SelectContent>
        </Select>
        {target && !target.teamId && <p className="text-xs text-lunex-gray">هذا العمل بلا فريق: سيُنشر الفصل كعمل حر غير تابع لأي فريق.</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="ch-number">رقم الفصل</Label>
          <Input id="ch-number" type="number" min={0} step="any" value={number} onChange={(e) => setNumber(Number(e.target.value))} disabled={busy} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ch-title">عنوان الفصل</Label>
          <Input id="ch-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: الفصل الأول" disabled={busy} maxLength={200} />
        </div>
      </div>

      <Tabs value={source} onValueChange={(v) => { setSource(v as Source); setError(""); }}>
        <TabsList className="w-full">
          <TabsTrigger value="images" className="flex-1 gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> صور</TabsTrigger>
          <TabsTrigger value="zip" className="flex-1 gap-1.5"><FileArchive className="h-3.5 w-3.5" /> ZIP</TabsTrigger>
          <TabsTrigger value="drive" className="flex-1 gap-1.5"><HardDrive className="h-3.5 w-3.5" /> درايف</TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-2">
          <Label htmlFor="ch-images">صور الصفحات (من الجهاز)</Label>
          <Input id="ch-images" type="file" multiple accept="image/*" onChange={(e) => pickImages(e.target.files)} disabled={busy} />
          <p className="text-xs text-lunex-gray">تُرتّب تلقائيًا بأسماء الملفات (1، 2، 10...) ويمكنك تعديل الترتيب أدناه.</p>
        </TabsContent>

        <TabsContent value="zip" className="space-y-2">
          <Label htmlFor="ch-zip">ملف ZIP فيه صور الفصل</Label>
          <Input id="ch-zip" type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(e) => e.target.files?.[0] && openZip(e.target.files[0])} disabled={busy || zipBusy} />
          <p className="text-xs text-lunex-gray">يُفتح الملف في متصفحك ولا يُرفع كاملًا: تُرفع الصور فقط، مرتبة بأسمائها.</p>
          {zipBusy && <p className="flex items-center gap-2 text-sm text-primary-300"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ فتح {zipName}...</p>}
        </TabsContent>

        <TabsContent value="drive" className="space-y-2">
          <Label htmlFor="ch-drive">رابط مجلد Google Drive</Label>
          <Input id="ch-drive" dir="ltr" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." disabled={busy} />
          {drive === null ? null : drive.configured ? (
            <div className="space-y-1 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-lunex-gray">
              <p>إن كان المجلد <b className="text-white">عامًا</b> (أي شخص لديه الرابط) فلا تحتاج شيئًا.</p>
              <p>إن كان <b className="text-white">خاصًا</b> فشاركه (بصلاحية عارض) مع هذا الحساب:</p>
              <p dir="ltr" className="select-all break-all rounded bg-black/30 px-2 py-1 font-mono text-[11px] text-primary-200">{drive.serviceEmail}</p>
              <p>تُجلب الصور من المجلد وحده (لا المجلدات الفرعية) بترتيب أسمائها.</p>
            </div>
          ) : (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              الرفع من درايف غير مفعّل بعد على الموقع: يحتاج المالك إلى إضافة مفتاح حساب الخدمة (GOOGLE_DRIVE_CREDENTIALS_JSON) في إعدادات الخادم.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-lunex-gray">
        تُحوَّل كل الصور إلى WebP تلقائيًا. الصورة الطويلة (ويبتون) تُقسَّم عند أقرب فراغ بين المشاهد إلى صفحات متتابعة، والعريضة جدًا تُصغَّر.
      </p>

      {source !== "drive" && files.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-lunex-gray">{files.length} صفحة بالترتيب الظاهر:</p>
          <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1.5 text-xs">
                <GripVertical className="h-3 w-3 shrink-0 text-lunex-gray" aria-hidden />
                <span className="w-6 shrink-0 text-center font-bold text-primary-300">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-white">{f.name}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || busy} className="text-lunex-gray hover:text-white disabled:opacity-30" aria-label="تقديم">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === files.length - 1 || busy} className="text-lunex-gray hover:text-white disabled:opacity-30" aria-label="تأخير">▼</button>
                <button type="button" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))} disabled={busy} className="text-lunex-gray hover:text-red-400" aria-label="إزالة">
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
        <span>
          <span className="block text-sm font-semibold text-white">نشر الفصل بعد الرفع</span>
          <span className="block text-xs text-lunex-gray">عند النشر يصل إشعار لمن أضاف العمل إلى مفضلته. أوقفه لتحفظ الفصل مسودة.</span>
        </span>
        <Switch checked={publish} onCheckedChange={setPublish} disabled={busy} />
      </label>

      {progress && (
        <div className="space-y-1.5" role="status">
          <div className="flex justify-between text-xs text-primary-300">
            <span>{progress.label}</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
        </div>
      )}
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      <Button onClick={submit} disabled={!ready || busy || zipBusy} className="w-full">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "جارِ العمل..." : publish ? "رفع ونشر الفصل" : "رفع وحفظ كمسودة"}
      </Button>
    </div>
  );
}
