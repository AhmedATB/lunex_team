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

/** At most this many pages are being fetched at once, across the whole chapter — a phone on a weak network, or a fast scroll through a long chapter, would otherwise trip the server's rate limit and lose pages. */
const MAX_PARALLEL = 6;
let running = 0;
const waiting: (() => void)[] = [];
function acquireSlot(): Promise<void> {
  if (running < MAX_PARALLEL) {
    running++;
    return Promise.resolve();
  }
  return new Promise((resolve) =>
    waiting.push(() => {
      running++;
      resolve();
    })
  );
}
function releaseSlot() {
  running--;
  waiting.shift()?.();
}

/** A failed load: whether trying again can help (a dropped connection, a busy server, a rate limit) or not (not signed in, not there). */
class LoadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}
/** A response that says "try again later" rather than "no". */
const retryableStatus = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500;

/** How long to wait before attempt number `attempt` (1, 2, 3, …): 1 s, 2 s, 4 s, 8 s, 16 s, then every 30 s, a little randomised so a page-full of failures does not retry in lockstep. */
const backoffMs = (attempt: number) => Math.min(30_000, 1_000 * 2 ** (attempt - 1)) * (0.75 + Math.random() * 0.5);
/** A page that fails for a reason that keeps repeating (a corrupt file) stops after this many tries and waits for the reader's tap. */
const MAX_ATTEMPTS = 20;

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
  onLoginRequired,
}: {
  chapterId: string;
  pageNumber: number;
  alt: string;
  priority?: boolean;
  className?: string;
  /** Called when the server says this visitor is not signed in (page images are only issued to signed-in readers). */
  onLoginRequired?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [started, setStarted] = useState(priority);
  const [aspect, setAspect] = useState<number | null>(null);
  /** How many times this page has failed so far in the current run (0 while the first try is still going). */
  const [failures, setFailures] = useState(0);
  /** Bumped by the reader's own "try again" tap: starts a fresh run. */
  const [retryNonce, setRetryNonce] = useState(0);

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    /** Set while waiting to try again: runs the next try right away (the connection came back, or the reader returned to the tab). */
    let wake: (() => void) | undefined;
    setState("loading");
    setFailures(0);

    /** One try: fetch, decrypt and draw the page. Throws a LoadError. */
    async function fetchAndDraw() {
      let tokenRes: Response;
      let token: string;
      try {
        tokenRes = await fetch(`/api/chapters/${chapterId}/pages/${pageNumber}/token`, { method: "POST" });
      } catch {
        throw new LoadError("network", true);
      }
      if (tokenRes.status === 401) {
        if (!cancelled) onLoginRequired?.();
        throw new LoadError("login_required", false);
      }
      if (!tokenRes.ok) throw new LoadError("token_failed", retryableStatus(tokenRes.status));
      try {
        ({ token } = await tokenRes.json());
      } catch {
        throw new LoadError("token_unreadable", true);
      }

      let assetId: string;
      let bundleKey: string;
      try {
        ({ assetId, bundleKey } = decodeTokenPayload(token));
      } catch {
        throw new LoadError("token_invalid", true);
      }

      let encrypted: Uint8Array;
      try {
        const streamRes = await fetch(`/api/images/${assetId}/stream?token=${encodeURIComponent(token)}`);
        if (!streamRes.ok) throw new LoadError("stream_failed", retryableStatus(streamRes.status));
        encrypted = new Uint8Array(await streamRes.arrayBuffer()); // a connection that drops mid-download throws here
      } catch (err) {
        throw err instanceof LoadError ? err : new LoadError("network", true);
      }

      try {
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
        // a truncated or garbled download does not decrypt: the same fetch usually works the next time
        throw new LoadError("decode_failed", true);
      }
    }

    async function load() {
      attempt++;
      await acquireSlot();
      if (cancelled) {
        releaseSlot();
        return;
      }
      try {
        await fetchAndDraw();
      } catch (err) {
        releaseSlot();
        if (cancelled) return;
        const retryable = err instanceof LoadError ? err.retryable : true;
        if (!retryable || attempt >= MAX_ATTEMPTS) {
          setState("error");
          return;
        }
        setFailures(attempt);
        // Try again — right away when the connection comes back or the reader returns to this tab, otherwise after a growing pause.
        const again = () => {
          wake = undefined;
          clearTimeout(timer);
          void load();
        };
        wake = again;
        if (typeof navigator !== "undefined" && navigator.onLine === false) return; // the `online` event wakes it
        timer = setTimeout(again, backoffMs(attempt));
        return;
      }
      releaseSlot();
    }

    const onOnline = () => wake?.();
    const onVisible = () => document.visibilityState === "visible" && wake?.();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // onLoginRequired is a plain notification; re-running the load because its identity changed would re-download the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, chapterId, pageNumber, retryNonce]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", minHeight: state === "loading" ? 480 : state === "error" ? 160 : undefined }}
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
      {state === "loading" && failures >= 2 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-lunex-gray">
          <span>جاري إعادة تحميل الصفحة…</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRetryNonce((n) => n + 1);
            }}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
          >
            أعد المحاولة الآن
          </button>
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/5 text-sm text-lunex-gray">
          <span>تعذر تحميل هذه الصفحة</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRetryNonce((n) => n + 1);
            }}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
    </div>
  );
}
