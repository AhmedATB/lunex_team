"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImageOff, ImagePlus, RefreshCw, Sparkles } from "lucide-react";
import { chapterApi, type ThumbnailSuggestion } from "@/lib/chapter-api";
import { imageProblem } from "@/lib/series-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * What the person chose for a chapter's featured picture, not yet saved: a page of the chapter (the server cuts the best frame out
 * of it — what the preview shows), a picture from their device, or "none". `null` means nothing was chosen (leave it as it is).
 */
export type ThumbnailChoice =
  | { kind: "page"; pageNumber: number; preview: string }
  | { kind: "file"; file: File; preview: string }
  | { kind: "none" }
  | null;

/** Saves the choice on the chapter. Returns an Arabic reason when it fails. */
export async function applyThumbnailChoice(chapterId: string, choice: ThumbnailChoice): Promise<string | null> {
  if (!choice) return null;
  const result =
    choice.kind === "page"
      ? await chapterApi.thumbnailFromPage(chapterId, choice.pageNumber)
      : choice.kind === "file"
        ? await chapterApi.thumbnailUpload(chapterId, choice.file)
        : await chapterApi.thumbnailRemove(chapterId);
  return result.ok ? null : result.message;
}

/** The address of a chapter's featured picture, as the site serves it (the asset id versions it). */
export const chapterThumbnailUrl = (chapterId: string, assetId: string) => `/api/catalog/chapters/${chapterId}/thumbnail?v=${assetId.slice(0, 8)}`;

/**
 * The featured picture of a chapter: four suggestions taken from its own pages (the part of each page that looks best), "suggest
 * others" for four more, or a picture from the device. With `autoChoose` the first suggestion is chosen for the person, who can
 * change it or take it off. Nothing is saved here: the parent saves `value` with {@link applyThumbnailChoice}.
 */
export function ThumbnailPicker({
  chapterId,
  current,
  value,
  onChange,
  autoChoose = false,
  disabled = false,
}: {
  chapterId: string;
  /** The address of the featured picture the chapter has now, if any. */
  current?: string | null;
  value: ThumbnailChoice;
  onChange: (choice: ThumbnailChoice) => void;
  autoChoose?: boolean;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<ThumbnailSuggestion[]>([]);
  const [round, setRound] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const chosenAutomatically = useRef(false);
  // Held so the effect below can offer the first suggestion without running again when the parent's callback changes.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const load = useCallback(
    async (next: number) => {
      setLoading(true);
      setError("");
      const result = await chapterApi.thumbnailSuggestions(chapterId, next);
      setLoading(false);
      if (!result.ok) return setError(result.message);
      setItems(result.body.items);
      setRounds(result.body.rounds);
      setRound(next);
      if (autoChoose && !chosenAutomatically.current && result.body.items[0]) {
        chosenAutomatically.current = true;
        const first = result.body.items[0];
        onChangeRef.current({ kind: "page", pageNumber: first.pageNumber, preview: first.preview });
      }
    },
    [chapterId, autoChoose]
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  function pickFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const problem = imageProblem(file);
    if (problem) return setError(problem);
    setError("");
    onChange({ kind: "file", file, preview: URL.createObjectURL(file) });
    if (fileInput.current) fileInput.current.value = "";
  }

  const shown = value?.kind === "none" ? null : value ? value.preview : current ?? null;
  const shownLabel =
    value?.kind === "page" ? `من الصفحة ${value.pageNumber}` : value?.kind === "file" ? "صورتك" : value?.kind === "none" ? "بدون صورة بارزة" : current ? "الصورة الحالية" : "لم تُختر صورة بعد";

  return (
    <section aria-label="الصورة البارزة" className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-white">
          الصورة البارزة <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-lunex-gray">اختياري</span>
        </p>
        <p className="mt-0.5 text-xs text-lunex-gray">تظهر في قائمة الفصول وفي الإشعارات ومنشورات ديسكورد وتيليجرام.</p>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black/30">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="الصورة البارزة المختارة" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-lunex-gray">
            <ImageOff className="h-6 w-6 opacity-60" aria-hidden />
            {shownLabel}
          </div>
        )}
        {shown && <span className="absolute bottom-2 start-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white">{shownLabel}</span>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> مقترح من صفحاتك
          </p>
          {rounds > 1 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => load(round + 1)} disabled={loading || disabled} className="h-7 gap-1 px-2 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> اقترح غيرها
            </Button>
          )}
        </div>

        {loading && items.length === 0 ? (
          <div className="grid grid-cols-2 gap-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-video animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-lunex-gray">لا توجد صفحات لاقتراح صورة منها.</p>
        ) : (
          <ul className={cn("grid grid-cols-2 gap-2 transition-opacity", loading && "opacity-50")}>
            {items.map((item) => {
              const chosen = value?.kind === "page" && value.pageNumber === item.pageNumber;
              return (
                <li key={item.pageNumber}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ kind: "page", pageNumber: item.pageNumber, preview: item.preview })}
                    aria-pressed={chosen}
                    className={cn(
                      "group relative block aspect-video w-full overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                      chosen ? "border-primary-400" : "border-transparent hover:border-white/30"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.preview} alt={`اقتراح من الصفحة ${item.pageNumber}`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-1.5 start-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">صفحة {item.pageNumber}</span>
                    {chosen && (
                      <span className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => pickFile(e.target.files)} tabIndex={-1} aria-hidden />
        <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={disabled}>
          <ImagePlus className="h-4 w-4" /> ارفع صورتك
        </Button>
        {(value ? value.kind !== "none" : !!current) && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ kind: "none" })} disabled={disabled} className="text-red-300 hover:text-red-200">
            بدون صورة بارزة
          </Button>
        )}
      </div>
      <p className="text-xs text-lunex-gray">الصورة العريضة (16:9، مثل 1280×720) هي الأفضل. غيرها يظهر مقصوصًا من الوسط في القائمة.</p>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
