"use client";

import { useState } from "react";
import { applyThumbnailChoice, ThumbnailPicker, type ThumbnailChoice } from "@/components/admin/thumbnail-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { chapterApi } from "@/lib/chapter-api";
import { imageProblem } from "@/lib/series-api";
import { useToast } from "@/store/toast";

/** Choosing or changing a chapter's featured picture after it was made: the same suggestions as when uploading, then save. */
export function ThumbnailDialog({ chapterId, label, current, onDone }: { chapterId: string; label: string; current?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ThumbnailChoice>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setChoice(null);
      setError("");
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    const problem = await applyThumbnailChoice(chapterId, choice);
    setBusy(false);
    if (problem) return setError(problem);
    useToast.getState().push({ title: "حُفظت الصورة البارزة", description: label });
    close(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-primary-300">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt="" className="h-4 w-7 rounded-sm object-cover" />
          ) : null}
          صورة بارزة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>الصورة البارزة — {label}</DialogTitle></DialogHeader>
        {open && <ThumbnailPicker chapterId={chapterId} current={current} value={choice} onChange={setChoice} disabled={busy} />}
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        <Button type="button" className="w-full" onClick={save} disabled={busy || !choice}>
          {busy ? "جارِ الحفظ..." : "حفظ الصورة البارزة"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Fixing one page of a chapter without redoing it: which page, and the new picture from the device. */
export function ReplacePageDialog({ chapterId, label, pageCount, onDone }: { chapterId: string; label: string; pageCount: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setPage("1");
      setFile(null);
      setError("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const number = Number(page);
    if (!Number.isInteger(number) || number < 1 || number > pageCount) return setError(`اكتب رقم صفحة من 1 إلى ${pageCount}.`);
    if (!file) return setError("اختر الصورة الجديدة من جهازك.");
    const problem = imageProblem(file);
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    const result = await chapterApi.replacePage(chapterId, number, file);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    useToast.getState().push({ title: "تم استبدال الصفحة", description: `${label} — صفحة ${number}` });
    close(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="text-primary-300">استبدال صفحة</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>استبدال صفحة — {label}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="replace-page-number">رقم الصفحة (من 1 إلى {pageCount})</Label>
            <Input id="replace-page-number" type="number" inputMode="numeric" min={1} max={pageCount} value={page} onChange={(e) => setPage(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="replace-page-file">الصورة الجديدة (من جهازك)</Label>
            <Input id="replace-page-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="h-auto py-2" />
            <p className="text-xs text-lunex-gray">تحلّ محل الصفحة نفسها بنفس رقمها. الصورة الطويلة لا تُقسَّم هنا، فارفعها بحجم صفحة واحدة.</p>
          </div>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !file}>
            {busy ? "جاري الاستبدال..." : "استبدال الصفحة"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
