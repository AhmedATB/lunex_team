"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a chapter page onto a <canvas> instead of an <img>:
 *
 * - No image element or URL exists in the DOM, so "Save image as", drag-to-save,
 *   and "open image in new tab" have nothing to grab. Saving the page as HTML
 *   serializes the canvas as an EMPTY element — the pixels are not part of the
 *   document.
 * - The canvas backing store uses the image's FULL natural resolution
 *   (e.g. 800×11000) and is only scaled down by CSS, so quality is preserved
 *   exactly — no recompression, no resampling of the source.
 * - A transparent overlay sits above the canvas so right-click/long-press hit
 *   the overlay (a plain div with no save options), and the context menu is
 *   suppressed as a second layer of defense.
 *
 * If the image host blocks CORS (canvas would be blank), it falls back to a
 * protected <img>: pointer-events disabled, drag blocked, overlay on top.
 */
export function ProtectedImage({
  src,
  alt,
  priority = false,
  style,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "canvas" | "img-fallback">("loading");
  const [aspect, setAspect] = useState<number | null>(null);
  const [started, setStarted] = useState(priority);

  // Lazy start: begin fetching only when the placeholder nears the viewport.
  useEffect(() => {
    if (started) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "1200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      setAspect(img.naturalHeight / img.naturalWidth);
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setState("img-fallback");
        return;
      }
      try {
        ctx.drawImage(img, 0, 0);
        // Verify the canvas isn't tainted (CORS silently failing would show blank).
        ctx.getImageData(0, 0, 1, 1);
        setState("canvas");
      } catch {
        setState("img-fallback");
      }
    };
    img.onerror = () => {
      if (!cancelled) setState("img-fallback");
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, started]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        minHeight: state === "loading" ? 480 : undefined,
        ...style,
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {state !== "img-fallback" && (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={alt}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      )}
      {state === "img-fallback" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            pointerEvents: "none",
            aspectRatio: aspect ? `1 / ${aspect}` : undefined,
          }}
        />
      )}
      {state === "loading" && (
        <div className="absolute inset-0 animate-pulse rounded-lg bg-white/5" />
      )}
      <div
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, background: "transparent" }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}
