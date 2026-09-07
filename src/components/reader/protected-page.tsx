"use client";

import { useEffect, useRef, useState } from "react";

interface TileManifestEntry {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  byteLength: number;
}

interface TileManifest {
  cols: number;
  rows: number;
  tiles: TileManifestEntry[];
}

/** base64url (no padding, - / _ instead of + /) — what the token body actually uses, not plain base64. */
function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Extracts the (unencrypted, HMAC-signed-not-secret) token payload — same base64url decode the server does. Reading it needs no secret; forging one does, since the server re-verifies the signature. */
function decodeTokenPayload(token: string): { assetId: string; bundleKey: string } {
  const [body] = token.split(".");
  const json = new TextDecoder().decode(base64UrlToBytes(body));
  return JSON.parse(json);
}

/**
 * Renders one real, protected chapter page: requests a short-lived page
 * token, fetches the encrypted tile bundle it authorizes, decrypts with the
 * per-token bundle key (Web Crypto, never touches the server's master
 * secret), and draws each tile onto <canvas> at its manifest position. The
 * network response is opaque bytes end to end — no <img src> and no
 * directly-openable image ever exists in the DOM or on the wire.
 */
export function ProtectedPage({
  chapterId,
  pageNumber,
  alt,
  priority = false,
  className,
}: {
  chapterId: string;
  pageNumber: number;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [started, setStarted] = useState(priority);
  const [aspect, setAspect] = useState<number | null>(null);

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

    async function load() {
      try {
        const tokenRes = await fetch(`/api/chapters/${chapterId}/pages/${pageNumber}/token`, { method: "POST" });
        if (!tokenRes.ok) throw new Error("token_failed");
        const { token } = await tokenRes.json();
        const { assetId, bundleKey } = decodeTokenPayload(token);

        const streamRes = await fetch(`/api/images/${assetId}/stream?token=${encodeURIComponent(token)}`);
        if (!streamRes.ok) throw new Error("stream_failed");
        const encrypted = new Uint8Array(await streamRes.arrayBuffer());

        const iv = encrypted.slice(0, 12);
        const ciphertextAndTag = encrypted.slice(12);
        const key = await crypto.subtle.importKey("raw", base64UrlToBytes(bundleKey) as BufferSource, "AES-GCM", false, ["decrypt"]);
        const plaintext = new Uint8Array(
          await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertextAndTag as BufferSource)
        );

        const manifestLength = new DataView(plaintext.buffer, plaintext.byteOffset, 4).getUint32(0, false);
        const manifestJson = new TextDecoder().decode(plaintext.slice(4, 4 + manifestLength));
        const manifest: TileManifest = JSON.parse(manifestJson);

        let offset = 4 + manifestLength;
        const canvasWidth = Math.max(...manifest.tiles.map((t) => t.x + t.w));
        const canvasHeight = Math.max(...manifest.tiles.map((t) => t.y + t.h));

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no_canvas_context");

        for (const tile of manifest.tiles) {
          const tileBytes = plaintext.slice(offset, offset + tile.byteLength);
          offset += tile.byteLength;
          const bitmap = await createImageBitmap(new Blob([tileBytes], { type: "image/webp" }));
          if (cancelled) {
            bitmap.close();
            continue;
          }
          ctx.drawImage(bitmap, tile.x, tile.y, tile.w, tile.h);
          bitmap.close();
        }

        if (!cancelled) {
          setAspect(canvasHeight / canvasWidth);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [started, chapterId, pageNumber]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", minHeight: state === "loading" ? 480 : undefined }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        style={{
          display: state === "ready" ? "block" : "none",
          width: "100%",
          height: "auto",
          aspectRatio: aspect ? `1 / ${aspect}` : undefined,
        }}
      />
      {state === "loading" && <div className="absolute inset-0 animate-pulse rounded-lg bg-white/5" />}
      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/5 text-sm text-lunex-gray">
          تعذر تحميل هذه الصفحة
        </div>
      )}
    </div>
  );
}
