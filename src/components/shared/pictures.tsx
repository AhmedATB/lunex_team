"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, RotateCw, X } from "lucide-react";
import { attachmentSrc, uploadPicture, type AttachmentInfo } from "@/lib/attachments-api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface PendingPicture {
  key: string;
  /** A local address for showing the chosen file at once, before (and after) it is uploaded. */
  preview: string;
  status: "uploading" | "ready" | "error";
  attachment?: AttachmentInfo;
  error?: string;
}

/**
 * The pictures being added to a comment or message: each is uploaded as soon as it is chosen (one after another, so they keep the
 * order they were picked in) and shown with its state. `ids` are the ones ready to go with the text.
 */
export function usePictures(max: number) {
  const [items, setItems] = useState<PendingPicture[]>([]);
  const [notice, setNotice] = useState("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef<PendingPicture[]>([]);
  latest.current = items;

  const patch = useCallback((key: string, change: Partial<PendingPicture>) => {
    setItems((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }, []);

  const upload = useCallback(
    (key: string, file: File) => {
      queue.current = queue.current.then(async () => {
        const result = await uploadPicture(file);
        if (result.ok) patch(key, { status: "ready", attachment: result.attachment, error: undefined });
        else patch(key, { status: "error", error: result.message });
      });
    },
    [patch]
  );

  const add = useCallback(
    (files: FileList | File[]) => {
      const room = max - latest.current.length;
      const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (picked.length === 0) {
        setNotice("اختر صورة.");
        return;
      }
      setNotice(picked.length > room ? (max === 1 ? "يمكن إرفاق صورة واحدة فقط." : `الحد الأقصى ${max} صور.`) : "");
      const accepted = picked.slice(0, Math.max(0, room));
      const created = accepted.map((file) => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, preview: URL.createObjectURL(file) }));
      setItems((list) => [...list, ...created.map(({ key, preview }): PendingPicture => ({ key, preview, status: "uploading" }))]);
      for (const c of created) upload(c.key, c.file);
    },
    [max, upload]
  );

  const remove = useCallback((key: string) => {
    setItems((list) => {
      const gone = list.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((p) => p.key !== key);
    });
    setNotice("");
  }, []);

  const clear = useCallback(() => {
    for (const p of latest.current) URL.revokeObjectURL(p.preview);
    setItems([]);
    setNotice("");
  }, []);

  useEffect(
    () => () => {
      for (const p of latest.current) URL.revokeObjectURL(p.preview);
    },
    []
  );

  return {
    items,
    notice,
    add,
    remove,
    clear,
    uploading: items.some((p) => p.status === "uploading"),
    failed: items.some((p) => p.status === "error"),
    ids: items.flatMap((p) => (p.status === "ready" && p.attachment ? [p.attachment.id] : [])),
    canAddMore: items.length < max,
  };
}

/** The button that opens the phone's gallery (or a computer's file picker). */
export function PictureButton({
  onPick,
  multiple = false,
  disabled,
  className,
  label = "إرفاق صورة",
}: {
  onPick: (files: FileList) => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => input.current?.click()}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn("flex shrink-0 items-center justify-center rounded-full text-lunex-gray transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40", className)}
      >
        <ImagePlus className="h-5 w-5" />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** The chosen pictures, each with its state (uploading, ready, or failed with a way to remove it). */
export function PicturePreviews({ items, onRemove, className }: { items: PendingPicture[]; onRemove: (key: string) => void; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("flex gap-2 overflow-x-auto pb-1", className)} aria-label="الصور المرفقة">
      {items.map((p, i) => (
        <li key={p.key} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.preview} alt={`الصورة ${i + 1}`} className={cn("h-full w-full object-cover", p.status !== "ready" && "opacity-50")} />
          {p.status === "uploading" && (
            <span className="absolute inset-0 flex items-center justify-center" role="status" aria-label="جاري الرفع">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </span>
          )}
          {p.status === "error" && (
            <span className="absolute inset-0 flex items-center justify-center bg-red-950/60 text-red-200" title={p.error}>
              <RotateCw className="h-4 w-4" aria-hidden />
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(p.key)}
            aria-label={`إزالة الصورة ${i + 1}`}
            className="absolute end-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
          >
            <X className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One picture of a comment or message: the small version in place, the full one when tapped. */
export function Picture({
  image,
  className,
  fit = "cover",
  onOpen,
}: {
  image: AttachmentInfo;
  className?: string;
  fit?: "cover" | "natural";
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn("block overflow-hidden rounded-xl bg-white/5 transition-opacity hover:opacity-90", className)}
      style={fit === "natural" ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
      aria-label="فتح الصورة"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachmentSrc(image.id, "thumb")}
        alt=""
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")}
      />
    </button>
  );
}

/** The pictures of a message: one shown large, several as a grid; tapping one opens all of them full size. */
export function PictureGrid({ images, className }: { images: AttachmentInfo[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const single = images.length === 1;
  return (
    <>
      <div className={cn(single ? "" : "grid grid-cols-2 gap-1", className)}>
        {images.map((image, i) => (
          <Picture
            key={image.id}
            image={image}
            fit={single ? "natural" : "cover"}
            onOpen={() => setOpen(i)}
            className={cn(single ? "max-h-72 w-full max-w-[16rem] sm:max-w-xs" : "aspect-square", !single && images.length % 2 === 1 && i === images.length - 1 && "col-span-2 aspect-[2/1]")}
          />
        ))}
      </div>
      <PictureViewer images={images} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </>
  );
}

/** The full-size viewer: the picture on a dark screen, with arrows (and the arrow keys) when there are several. */
export function PictureViewer({ images, index, onClose, onIndex }: { images: AttachmentInfo[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const current = index !== null ? images[index] : undefined;
  const many = images.length > 1;
  const go = useCallback((step: number) => onIndex(((index ?? 0) + step + images.length) % images.length), [index, images.length, onIndex]);

  useEffect(() => {
    if (index === null || !many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(1);
      if (e.key === "ArrowRight") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, many, go]);

  return (
    <Dialog open={index !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-5xl items-center justify-center border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">عرض الصورة</DialogTitle>
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachmentSrc(current.id)} alt="" className="max-h-[88dvh] max-w-full rounded-lg object-contain" />
        )}
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="السابقة" className="absolute start-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
              <ChevronRight className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="التالية" className="absolute end-1 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <span className="absolute bottom-2 start-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white" dir="ltr">
              {(index ?? 0) + 1} / {images.length}
            </span>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
