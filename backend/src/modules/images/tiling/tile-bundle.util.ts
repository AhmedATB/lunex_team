import { createCipheriv, randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";

// Adaptive, never a blind fixed count — a 4000px-tall page and a 1200px one
// both stay in this range instead of one exploding into hundreds of cells.
// See the approved anti-piracy plan: one HTTP request per page, a small
// enough grid that the wire response is simply never a directly-openable
// image, without the 400-tiles-per-page request-count cost.
const MIN_GRID = 2;
const MAX_GRID = 5;
const TARGET_TILE_PX = 650;

export interface TileManifestEntry {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  byteLength: number;
}

export interface TileManifest {
  cols: number;
  rows: number;
  /** Shuffled send order, NOT row-major — this is the order the concatenated tile bytes actually appear in the payload. */
  tiles: TileManifestEntry[];
}

function computeGrid(width: number, height: number): { cols: number; rows: number } {
  const cols = Math.min(MAX_GRID, Math.max(MIN_GRID, Math.round(width / TARGET_TILE_PX)));
  const rows = Math.min(MAX_GRID, Math.max(MIN_GRID, Math.round(height / TARGET_TILE_PX)));
  return { cols, rows };
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Slices a full (already-watermarked) page image into the adaptive grid,
 * shuffles the send order, and returns one plaintext payload:
 * `[4-byte manifest length][manifest JSON][tile bytes, concatenated in
 * manifest order]`. Tile ids are random and never encode row/col/page —
 * the manifest is the only place that mapping exists, and it never leaves
 * the server unencrypted (encryptBundle wraps this whole payload).
 */
export async function buildTileBundle(image: Buffer, width: number, height: number): Promise<Buffer> {
  const { cols, rows } = computeGrid(width, height);
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);

  const cells: { row: number; col: number; x: number; y: number; w: number; h: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW;
      const y = row * cellH;
      // Last row/col absorbs any remainder pixels so the grid always covers the full image exactly.
      const w = col === cols - 1 ? width - x : cellW;
      const h = row === rows - 1 ? height - y : cellH;
      cells.push({ row, col, x, y, w, h });
    }
  }

  const order = shuffled(cells);
  const manifest: TileManifest = { cols, rows, tiles: [] };
  const tileBuffers: Buffer[] = [];

  for (const cell of order) {
    const tileBuf = await sharp(image)
      .extract({ left: cell.x, top: cell.y, width: cell.w, height: cell.h })
      .webp({ quality: 90 })
      .toBuffer();
    const id = randomUUID().replace(/-/g, "").slice(0, 12);
    manifest.tiles.push({ id, ...cell, byteLength: tileBuf.length });
    tileBuffers.push(tileBuf);
  }

  const manifestJson = Buffer.from(JSON.stringify(manifest), "utf8");
  const lengthPrefix = Buffer.alloc(4);
  lengthPrefix.writeUInt32BE(manifestJson.length, 0);

  return Buffer.concat([lengthPrefix, manifestJson, ...tileBuffers]);
}

/**
 * AES-256-GCM, wire format `[12-byte IV][ciphertext][16-byte auth tag]` —
 * matches the WebCrypto SubtleCrypto convention the client decrypts with
 * (ciphertext param includes the trailing tag). `bundleKeyBase64Url` rides
 * inside the already-issued signed token (crypto/image-token.util.ts) —
 * this function never touches the server's own master secret.
 */
export function encryptBundle(plaintext: Buffer, bundleKeyBase64Url: string): Buffer {
  const key = Buffer.from(bundleKeyBase64Url, "base64url");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]);
}
