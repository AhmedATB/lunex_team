import { gcm } from "@noble/ciphers/aes.js";
import { fromByteArray, toByteArray } from "base64-js";
import { apiFetch, retryableStatus } from "./api";
import { utf8Decode } from "./utf8";

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

/** One tile of a page, ready to draw: where it goes and the picture itself. */
export interface PageTile {
  x: number;
  y: number;
  w: number;
  h: number;
  uri: string;
}

/** A decoded page: its full size in pixels and its tiles. */
export interface DecodedPage {
  width: number;
  height: number;
  tiles: PageTile[];
}

/** A failed load: whether trying again can help (a dropped connection, a busy server) or not (locked, signed out, gone). */
export class PageLoadError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly status = 0,
  ) {
    super(code);
  }
}

/** base64url (no padding, - / _ instead of + /) — what the token body uses. */
function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return toByteArray(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
}

/** The token's payload is signed, not secret: reading it needs no key, forging one does (the server re-checks the signature). */
function decodeTokenPayload(token: string): { assetId: string; bundleKey: string } {
  const [body] = token.split(".");
  return JSON.parse(utf8Decode(base64UrlToBytes(body)));
}

/**
 * Loads one protected chapter page, the same way the site's reader does: ask for a short-lived page token, fetch the encrypted
 * tile bundle it authorizes, decrypt it with the per-token key (AES-GCM), and split it into its tiles. The bundle is
 * `[4-byte manifest length][manifest JSON][tile bytes in manifest order]`, each tile a WebP.
 */
export async function loadPage(chapterId: string, pageNumber: number): Promise<DecodedPage> {
  const tokenRes = await apiFetch(`/api/chapters/${encodeURIComponent(chapterId)}/pages/${pageNumber}/token`, { method: "POST" }).catch(
    () => {
      throw new PageLoadError("network", true);
    },
  );
  if (tokenRes.status === 401) throw new PageLoadError("login_required", false, 401);
  if (tokenRes.status === 403) throw new PageLoadError("locked", false, 403);
  if (!tokenRes.ok) throw new PageLoadError("token_failed", retryableStatus(tokenRes.status), tokenRes.status);

  let token: string;
  let assetId: string;
  let bundleKey: string;
  try {
    ({ token } = await tokenRes.json());
    ({ assetId, bundleKey } = decodeTokenPayload(token));
  } catch {
    throw new PageLoadError("token_invalid", true);
  }

  let encrypted: Uint8Array;
  try {
    const streamRes = await apiFetch(`/api/images/${encodeURIComponent(assetId)}/stream?token=${encodeURIComponent(token)}`);
    if (!streamRes.ok) throw new PageLoadError("stream_failed", retryableStatus(streamRes.status), streamRes.status);
    encrypted = new Uint8Array(await streamRes.arrayBuffer());
  } catch (err) {
    throw err instanceof PageLoadError ? err : new PageLoadError("network", true);
  }

  try {
    const plaintext = gcm(base64UrlToBytes(bundleKey), encrypted.subarray(0, 12)).decrypt(encrypted.subarray(12));
    const manifestLength = new DataView(plaintext.buffer, plaintext.byteOffset, 4).getUint32(0, false);
    const manifest: { tiles: TileManifestEntry[] } = JSON.parse(utf8Decode(plaintext.subarray(4, 4 + manifestLength)));

    let offset = 4 + manifestLength;
    const tiles: PageTile[] = manifest.tiles.map((tile) => {
      const bytes = plaintext.subarray(offset, offset + tile.byteLength);
      offset += tile.byteLength;
      return { x: tile.x, y: tile.y, w: tile.w, h: tile.h, uri: `data:image/webp;base64,${fromByteArray(bytes)}` };
    });
    return {
      width: Math.max(...tiles.map((t) => t.x + t.w)),
      height: Math.max(...tiles.map((t) => t.y + t.h)),
      tiles,
    };
  } catch {
    // a truncated or garbled download does not decrypt: the same fetch usually works the next time
    throw new PageLoadError("decode_failed", true);
  }
}
