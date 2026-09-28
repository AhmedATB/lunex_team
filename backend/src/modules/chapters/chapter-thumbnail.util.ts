import sharp from "sharp";

/** A chapter's featured picture is a wide 16:9 picture of this size (at most). */
export const THUMB_WIDTH = 1280;
export const THUMB_HEIGHT = 720;
/** The small copy shown to choose from. */
const PREVIEW_WIDTH = 480;
const PREVIEW_HEIGHT = 270;
const WEBP_QUALITY = 88;
const MAX_SOURCE_PIXELS = 100_000_000;

export class ThumbnailImageError extends Error {}

export interface Thumbnail {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * A featured picture out of any picture. `crop`: cut to 16:9 around the most interesting part of it (faces, colour, contrast —
 * sharp's "attention" crop), which is how a tall page becomes one good frame. `keep`: a picture the person chose themselves keeps its
 * own shape, only shrunk to fit; the screens that show it cut it to their frame.
 */
export async function makeThumbnail(bytes: Buffer, mode: "crop" | "keep"): Promise<Thumbnail> {
  try {
    const base = () => sharp(bytes, { limitInputPixels: MAX_SOURCE_PIXELS }).rotate();
    const pipeline =
      mode === "crop"
        ? base().resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
        : base().resize(THUMB_WIDTH, THUMB_WIDTH, { fit: "inside", withoutEnlargement: true });
    const { data, info } = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new ThumbnailImageError("This file could not be read as an image.");
  }
}

/** A small copy of a featured picture, as a data address the page can show at once. */
export async function previewOf(thumbnail: Thumbnail): Promise<string> {
  const small = await sharp(thumbnail.data).resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, { fit: "inside" }).webp({ quality: 70 }).toBuffer();
  return `data:image/webp;base64,${small.toString("base64")}`;
}

/** How good a page looks as the face of a chapter: 0 (blank, all text, or nearly all black) to about 1 (colourful, contrasty, detailed). */
export interface PageScore {
  score: number;
}

/**
 * Looks at a small copy of the page: how much contrast it has, how colourful it is, how much detail (edges), and how much of it is
 * plain white (a page of speech and nothing else) or plain black. Artwork scores high; a blank page or a page of words scores low.
 */
export async function scorePage(bytes: Buffer): Promise<PageScore> {
  const { data, info } = await sharp(bytes, { limitInputPixels: MAX_SOURCE_PIXELS })
    .rotate()
    .resize(80, 80, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const pixels = width * height;
  if (pixels === 0) return { score: 0 };

  let sum = 0;
  let sumSquares = 0;
  let saturation = 0;
  let white = 0;
  let dark = 0;
  let edges = 0;
  const luminance = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    luminance[i] = l;
    sum += l;
    sumSquares += l * l;
    const max = Math.max(r, g, b);
    saturation += max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    if (l > 238) white++;
    if (l < 18) dark++;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * width + x;
      if (x + 1 < width) edges += Math.abs(luminance[at] - luminance[at + 1]);
      if (y + 1 < height) edges += Math.abs(luminance[at] - luminance[at + width]);
    }
  }

  const mean = sum / pixels;
  const spread = Math.sqrt(Math.max(0, sumSquares / pixels - mean * mean));
  const colour = saturation / pixels;
  const detail = edges / (pixels * 2) / 255;

  let score = 0.4 * Math.min(spread / 70, 1) + 0.3 * Math.min(colour / 0.45, 1) + 0.3 * Math.min(detail / 0.12, 1);
  if (white / pixels > 0.6) score *= 0.4;
  if (dark / pixels > 0.6) score *= 0.5;
  if (spread < 14) score *= 0.2;
  return { score };
}

/**
 * The pages best first, then dealt out in groups of `size` (a round of suggestions each) so that no two pages of a group are
 * neighbours — the same scene would fill the group with one picture. Pages that cannot be kept apart still fill the last group.
 */
export function suggestionGroups(scored: { pageNumber: number; score: number }[], size: number): number[][] {
  const remaining = [...scored].sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber).map((p) => p.pageNumber);
  const groups: number[][] = [];
  while (remaining.length > 0) {
    const group: number[] = [];
    for (const candidate of remaining) {
      if (group.length === size) break;
      if (!group.some((taken) => Math.abs(taken - candidate) <= 1)) group.push(candidate);
    }
    for (const candidate of remaining) {
      if (group.length === size) break;
      if (!group.includes(candidate)) group.push(candidate);
    }
    for (const taken of group) remaining.splice(remaining.indexOf(taken), 1);
    groups.push(group.sort((a, b) => a - b));
  }
  return groups;
}
