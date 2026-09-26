"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Side of the square the picture is shown in, in CSS pixels (it shrinks to fit a narrow dialog). */
const VIEW_PX = 280;
/** Side of the square that is uploaded. The server keeps 256; this leaves room for sharp edges on high-density screens. */
const OUTPUT_PX = 512;
const MAX_ZOOM = 4;
const KEY_STEP_PX = 12;

interface Point {
  x: number;
  y: number;
}

/**
 * Lets someone choose which part of their photo becomes the round profile picture: drag to move, slide (or scroll) to
 * zoom. The chosen square is drawn onto a canvas here, in the browser, and only that small image is uploaded — the
 * server used to cut a centred square by itself, which is what chopped faces off.
 */
export function AvatarCropper({
  file,
  saving,
  onCancel,
  onCropped,
}: {
  file: File;
  saving: boolean;
  onCancel: () => void;
  onCropped: (image: Blob) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [view, setView] = useState(VIEW_PX);
  const imageRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; start: Point; from: Point } | null>(null);

  // The picture the person chose, as a temporary address that is released when the dialog moves on.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNatural(null);
    setFailed(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Fit a narrow phone-sized dialog.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setView(Math.max(160, Math.min(VIEW_PX, Math.floor(box.clientWidth)))));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // At zoom 1 the photo just covers the square; zooming in only ever makes it bigger, so there is never an empty edge.
  const scale = natural ? (view / Math.min(natural.w, natural.h)) * zoom : 1;
  const limits = natural
    ? { x: Math.max(0, (natural.w * scale - view) / 2), y: Math.max(0, (natural.h * scale - view) / 2) }
    : { x: 0, y: 0 };
  const clamp = useCallback(
    (point: Point, lim: Point): Point => ({
      x: Math.min(lim.x, Math.max(-lim.x, point.x)),
      y: Math.min(lim.y, Math.max(-lim.y, point.y)),
    }),
    []
  );
  const shown = clamp(offset, limits);

  function changeZoom(next: number) {
    if (!natural) return;
    const value = Math.min(MAX_ZOOM, Math.max(1, next));
    const newScale = (view / Math.min(natural.w, natural.h)) * value;
    setZoom(value);
    // Keep the middle of the square on the same spot of the photo while zooming.
    const ratio = newScale / scale;
    setOffset(
      clamp(
        { x: shown.x * ratio, y: shown.y * ratio },
        { x: Math.max(0, (natural.w * newScale - view) / 2), y: Math.max(0, (natural.h * newScale - view) / 2) }
      )
    );
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!natural || saving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointer: e.pointerId, start: { x: e.clientX, y: e.clientY }, from: shown };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    setOffset(clamp({ x: d.from.x + (e.clientX - d.start.x), y: d.from.y + (e.clientY - d.start.y) }, limits));
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer === e.pointerId) drag.current = null;
  }
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    changeZoom(zoom - e.deltaY * 0.002);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, Point> = {
      ArrowLeft: { x: KEY_STEP_PX, y: 0 },
      ArrowRight: { x: -KEY_STEP_PX, y: 0 },
      ArrowUp: { x: 0, y: KEY_STEP_PX },
      ArrowDown: { x: 0, y: -KEY_STEP_PX },
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      setOffset(clamp({ x: shown.x + move.x, y: shown.y + move.y }, limits));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      changeZoom(zoom + 0.2);
    } else if (e.key === "-") {
      e.preventDefault();
      changeZoom(zoom - 0.2);
    }
  }

  function confirm() {
    const img = imageRef.current;
    if (!img || !natural) return;
    // The part of the photo inside the square, in the photo's own pixels.
    const side = view / scale;
    const sx = (natural.w * scale) / 2 / scale - view / 2 / scale - shown.x / scale;
    const sy = (natural.h * scale) / 2 / scale - view / 2 / scale - shown.y / scale;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingQuality = "high";
    context.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_PX, OUTPUT_PX);
    canvas.toBlob(
      (blob) => {
        if (blob) onCropped(blob);
        else setFailed(true);
      },
      "image/webp",
      0.9
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-lunex-gray">اسحب الصورة لتحريكها وكبّرها بالمقياس حتى يظهر وجهك داخل الدائرة.</p>

      <div ref={boxRef} className="flex justify-center">
        <div
          role="group"
          aria-label="منطقة قص الصورة، استعمل الأسهم للتحريك و + و - للتكبير"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          style={{ width: view, height: view, touchAction: "none" }}
          className="relative cursor-grab select-none overflow-hidden rounded-2xl bg-black/40 outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-primary-400 active:cursor-grabbing"
        >
          {src && !failed && (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob the browser draws itself; nothing to optimise
            <img
              ref={imageRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFailed(true)}
              style={
                natural
                  ? {
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: natural.w * scale,
                      height: natural.h * scale,
                      maxWidth: "none",
                      transform: `translate(calc(-50% + ${shown.x}px), calc(-50% + ${shown.y}px))`,
                    }
                  : { opacity: 0 }
              }
            />
          )}
          {/* the round window: what is outside it is dimmed, so the final circle is visible while choosing */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.55)] ring-2 ring-white/80" aria-hidden />
          {!natural && !failed && (
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            </div>
          )}
          {failed && (
            <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-red-300" role="alert">
              تعذر قراءة هذه الصورة. جرّب صورة أخرى.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => changeZoom(zoom - 0.25)}
          disabled={!natural || saving || zoom <= 1}
          aria-label="تصغير"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => changeZoom(Number(e.target.value))}
          disabled={!natural || saving}
          aria-label="مقدار التكبير"
          className="h-2 flex-1 cursor-pointer accent-primary-400"
        />
        <button
          type="button"
          onClick={() => changeZoom(zoom + 0.25)}
          disabled={!natural || saving || zoom >= MAX_ZOOM}
          aria-label="تكبير"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={confirm} disabled={!natural || failed || saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          حفظ الصورة
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          رجوع
        </Button>
      </div>
    </div>
  );
}
