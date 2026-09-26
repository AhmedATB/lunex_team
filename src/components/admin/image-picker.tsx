"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { imageProblem } from "@/lib/series-api";
import { cn } from "@/lib/utils";

/**
 * Choose a picture from the device (not a link): the current one, or the new one, is previewed in the frame's own
 * proportions, so what will be cropped is visible before saving. Picking a file hands it to `onChange`; the caller uploads it.
 */
export function ImagePicker({
  label,
  hint,
  current,
  file,
  onChange,
  aspect = "aspect-[2/3]",
  className,
}: {
  label: string;
  hint?: string;
  /** Address of the picture the item has now, if any. */
  current?: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  /** A Tailwind aspect-ratio class for the frame. */
  aspect?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(picked: File | undefined) {
    if (!picked) return;
    const problem = imageProblem(picked);
    setError(problem ?? "");
    if (!problem) onChange(picked);
  }

  const shown = preview ?? current ?? null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium text-white">{label}</p>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          aria-label={`${label}: اختر صورة من جهازك`}
          className={cn(
            "relative flex w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/25 bg-white/[0.03] text-lunex-gray transition-colors hover:border-primary-400/60",
            aspect
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6" aria-hidden />
          )}
        </button>
        <div className="space-y-1.5 pt-1 text-xs text-lunex-gray">
          <button type="button" onClick={() => input.current?.click()} className="font-semibold text-primary-300 hover:underline">
            {shown ? "تغيير الصورة" : "اختيار صورة من الجهاز"}
          </button>
          {file && (
            <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-lunex-gray hover:text-white">
              <X className="h-3 w-3" /> إلغاء الصورة المختارة
            </button>
          )}
          {hint && <p>{hint}</p>}
          {error && <p className="text-red-400" role="alert">{error}</p>}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
