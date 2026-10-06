"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, ImageUp, Loader2, Trash2 } from "lucide-react";
import { chapterApi, type ChapterDetails } from "@/lib/chapter-api";
import { chapterLabel } from "@/lib/chapter-label";
import { imageProblem } from "@/lib/series-api";
import { useToast } from "@/store/toast";
import { ProtectedPage } from "@/components/reader/protected-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const say = (title: string, description?: string) => useToast.getState().push({ title, description });

/**
 * The chapter as readers will see it, page under page, with what can still be fixed before (or after) it goes live: its number and
 * title, and each page — moved up or down, replaced with another picture, or taken out. Pages are drawn by the reader's own
 * protected viewer, so what shows here is exactly what is published.
 */
export function ChapterPreviewEditor({ chapterId, onChanged }: { chapterId: string; onChanged?: (details: ChapterDetails) => void }) {
  const [details, setDetails] = useState<ChapterDetails | null>(null);
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  /** Bumped for a page whose picture changed, so only that page is drawn again from the server. */
  const [versions, setVersions] = useState<Record<number, number>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<number | null>(null);
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  const load = useCallback(async () => {
    const result = await chapterApi.details(chapterId);
    if (!result.ok) return setError(result.message);
    setDetails(result.body);
    setNumber(String(result.body.number));
    setTitle(result.body.title);
    onChangedRef.current?.(result.body);
  }, [chapterId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one change; `redraw` are the page numbers whose picture is different afterwards. */
  async function run(key: string, work: () => Promise<{ ok: true } | { ok: false; message: string }>, done?: string, redraw: number[] = []) {
    setBusy(key);
    setError("");
    const result = await work();
    setBusy(null);
    if (!result.ok) return setError(result.message);
    if (done) say(done);
    if (redraw.length) setVersions((current) => Object.fromEntries([...Object.entries(current), ...redraw.map((n) => [n, (current[n] ?? 0) + 1])]));
    await load();
  }

  const parsedNumber = Number(number);
  const detailsChanged = details !== null && (parsedNumber !== details.number || title.trim() !== details.title);
  const detailsValid = number.trim() !== "" && Number.isFinite(parsedNumber) && parsedNumber >= 0 && title.trim().length > 0;

  function pickReplacement(pageNumber: number) {
    replacing.current = pageNumber;
    fileInput.current?.click();
  }

  function replaceWith(list: FileList | null) {
    const file = list?.[0];
    const pageNumber = replacing.current;
    if (fileInput.current) fileInput.current.value = "";
    if (!file || pageNumber === null) return;
    const problem = imageProblem(file);
    if (problem) return setError(problem);
    void run(`replace-${pageNumber}`, () => chapterApi.replacePage(chapterId, pageNumber, file), `استُبدلت الصفحة ${pageNumber}`, [pageNumber]);
  }

  function removePage(pageNumber: number) {
    if (!window.confirm(`حذف الصفحة ${pageNumber} من الفصل؟ الصفحات بعدها تتقدم مكانًا واحدًا.`)) return;
    // every page from this one on now shows the picture that was after it
    const shifted = (details?.pages ?? []).map((page) => page.pageNumber).filter((n) => n >= pageNumber);
    void run(`remove-${pageNumber}`, () => chapterApi.removePage(chapterId, pageNumber), `حُذفت الصفحة ${pageNumber}`, shifted);
  }

  if (!details) {
    return error ? <p className="text-sm text-red-400" role="alert">{error}</p> : <Loader2 className="mx-auto h-5 w-5 animate-spin text-lunex-gray" aria-label="جارِ التحميل" />;
  }

  const pages = details.pages;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[6rem_1fr] gap-2 rounded-xl border border-white/10 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="pv-number">رقم الفصل</Label>
          <Input id="pv-number" type="number" min={0} step="any" dir="ltr" value={number} onChange={(e) => setNumber(e.target.value)} disabled={busy !== null} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pv-title">عنوان الفصل</Label>
          <Input id="pv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={busy !== null} />
        </div>
        {detailsChanged && (
          <Button
            type="button"
            size="sm"
            className="col-span-2"
            disabled={!detailsValid || busy !== null}
            onClick={() => void run("details", () => chapterApi.updateDetails(chapterId, { number: parsedNumber, title: title.trim() }), "حُفظ رقم الفصل وعنوانه")}
          >
            {busy === "details" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} حفظ الرقم والعنوان
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white"><Eye className="h-4 w-4 text-primary-300" /> {pages.length} صفحة — كما سيراها القرّاء</p>
        <Badge variant={details.isPublished ? "success" : "secondary"}>{details.isPublished ? "منشور" : "مسودة"}</Badge>
      </div>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => replaceWith(e.target.files)} />

      <ol className="space-y-3">
        {pages.map(({ pageNumber }, index) => (
          <li key={`${pageNumber}-${versions[pageNumber] ?? 0}`} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
            <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-2 py-1.5">
              <span className="me-auto text-xs font-bold text-white">صفحة {pageNumber}</span>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`تقديم الصفحة ${pageNumber}`} disabled={index === 0 || busy !== null}
                onClick={() => void run(`move-${pageNumber}`, () => chapterApi.swapPages(chapterId, pageNumber, pages[index - 1].pageNumber), undefined, [pageNumber, pages[index - 1].pageNumber])}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`تأخير الصفحة ${pageNumber}`} disabled={index === pages.length - 1 || busy !== null}
                onClick={() => void run(`move-${pageNumber}`, () => chapterApi.swapPages(chapterId, pageNumber, pages[index + 1].pageNumber), undefined, [pageNumber, pages[index + 1].pageNumber])}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-primary-300" aria-label={`استبدال الصفحة ${pageNumber}`} disabled={busy !== null} onClick={() => pickReplacement(pageNumber)}>
                {busy === `replace-${pageNumber}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />} استبدال
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-red-400 hover:bg-red-500/10" aria-label={`حذف الصفحة ${pageNumber}`} disabled={pages.length <= 1 || busy !== null} onClick={() => removePage(pageNumber)}>
                {busy === `remove-${pageNumber}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} حذف
              </Button>
            </div>
            <ProtectedPage chapterId={chapterId} pageNumber={pageNumber} alt={`${chapterLabel(details)} — صفحة ${pageNumber}`} priority={index < 2} className="w-full" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Opens a chapter of the list for checking: the preview and its fixes, and — for the people who may — putting it live or taking it
 * down from here once it looks right.
 */
export function ChapterPreviewDialog({
  chapterId,
  canPublish,
  onClose,
  onChanged,
}: {
  chapterId: string | null;
  canPublish: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [details, setDetails] = useState<ChapterDetails | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!chapterId) setDetails(null);
  }, [chapterId]);

  async function togglePublished() {
    if (!chapterId || !details) return;
    setPublishing(true);
    const next = !details.isPublished;
    const result = await chapterApi.setPublished(chapterId, next);
    setPublishing(false);
    if (!result.ok) return say(next ? "تعذر نشر الفصل" : "تعذر إلغاء النشر", result.message);
    say(next ? "نُشر الفصل" : "أُلغي نشر الفصل", chapterLabel(details));
    onChanged();
    onClose();
  }

  return (
    <Dialog open={chapterId !== null} onOpenChange={(open) => !open && (onChanged(), onClose())}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>معاينة وتعديل — {details ? chapterLabel(details) : "الفصل"}</DialogTitle>
        </DialogHeader>
        {chapterId && <ChapterPreviewEditor chapterId={chapterId} onChanged={setDetails} />}
        {canPublish && details && (
          <Button type="button" className="sticky bottom-0 w-full" variant={details.isPublished ? "secondary" : "default"} disabled={publishing} onClick={() => void togglePublished()}>
            {publishing && <Loader2 className="h-4 w-4 animate-spin" />} {details.isPublished ? "إلغاء النشر" : "نشر الفصل"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
