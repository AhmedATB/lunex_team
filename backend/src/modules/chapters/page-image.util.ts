import sharp, { type Sharp } from "sharp";

export type PageImageErrorCode = "invalid_image" | "image_too_large";

export class PageImageError extends Error {
  constructor(readonly code: PageImageErrorCode, message: string) {
    super(message);
  }
}

export interface PageSlice {
  /** WebP bytes (EXIF is dropped). */
  data: Buffer;
  width: number;
  height: number;
}

/** A picture wider than this is shrunk to it: canvases wider than that fail on phones, and a page is shown at a fraction of it anyway. */
export const MAX_PAGE_WIDTH = 2400;
/** A picture taller than this is cut into several pages (a webtoon strip); anything up to it stays one page. */
export const MAX_PAGE_HEIGHT = 4500;
/** How tall the pieces of a cut picture aim to be (they are cut evenly, so none is a thin leftover). */
const TARGET_SLICE_HEIGHT = 4000;
/** A picture with more pixels than this is refused instead of decoded. */
const MAX_SOURCE_PIXELS = 150_000_000;
/** The plain limit on either side of a picture that is not cut. */
const MAX_UNCUT_SIDE = 6000;
/** Rows of a cut are looked for this far (as a share of a piece's height) either side of the even line. */
const CUT_SEARCH_SHARE = 0.12;
/** A row whose brightest and darkest sampled points differ by no more than this (0-255) counts as an empty gap. */
const QUIET_RANGE = 12;
const SAMPLE_COLUMNS = 96;
const WEBP_QUALITY = 90;

const options = { limitInputPixels: MAX_SOURCE_PIXELS };

/**
 * Turns an uploaded picture into the WebP page(s) a chapter stores.
 *
 * With `cut` (the admin upload and the Drive import): a picture wider than {@link MAX_PAGE_WIDTH} is shrunk to it, and one
 * taller than {@link MAX_PAGE_HEIGHT} (a webtoon strip) is cut into even pieces, each cut moved to the emptiest stretch of rows
 * near its even line so a speech bubble or a face is not sliced through. Without `cut` it stays one page, as before, and a
 * side over {@link MAX_UNCUT_SIDE} is refused.
 */
export async function preparePage(bytes: Buffer, { cut }: { cut: boolean }): Promise<PageSlice[]> {
  const open = () => sharp(bytes, options).rotate();

  let sourceWidth: number;
  let sourceHeight: number;
  try {
    const meta = await sharp(bytes, options).metadata();
    // EXIF orientations 5-8 turn the picture a quarter, so its width and height swap.
    const turned = (meta.orientation ?? 1) >= 5;
    sourceWidth = (turned ? meta.height : meta.width) ?? 0;
    sourceHeight = (turned ? meta.width : meta.height) ?? 0;
  } catch {
    throw new PageImageError("invalid_image", "This file could not be read as an image.");
  }
  if (!sourceWidth || !sourceHeight) throw new PageImageError("invalid_image", "This file could not be read as an image.");
  if (sourceWidth * sourceHeight > MAX_SOURCE_PIXELS) {
    throw new PageImageError("image_too_large", "Page image dimensions exceed the allowed maximum.");
  }

  try {
    if (!cut) {
      if (sourceWidth > MAX_UNCUT_SIDE || sourceHeight > MAX_UNCUT_SIDE) {
        throw new PageImageError("image_too_large", "Page image dimensions exceed the allowed maximum.");
      }
      return [{ data: await open().webp({ quality: WEBP_QUALITY }).toBuffer(), width: sourceWidth, height: sourceHeight }];
    }

    const width = Math.min(sourceWidth, MAX_PAGE_WIDTH);
    const height = Math.max(1, Math.round(sourceHeight * (width / sourceWidth)));
    // An exact size (fill, not a ratio-kept one) so the rows counted for the cuts below are the rows that are cut.
    const scaled = () => (width < sourceWidth ? open().resize(width, height, { fit: "fill" }) : open());

    if (height <= MAX_PAGE_HEIGHT) {
      return [{ data: await scaled().webp({ quality: WEBP_QUALITY }).toBuffer(), width, height }];
    }

    const pieces = Math.ceil(height / TARGET_SLICE_HEIGHT);
    const lines = await chooseCuts(scaled, height, pieces);
    const edges = [0, ...lines, height];
    const slices: PageSlice[] = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const top = edges[i];
      const pieceHeight = edges[i + 1] - top;
      const data = await scaled().extract({ left: 0, top, width, height: pieceHeight }).webp({ quality: WEBP_QUALITY }).toBuffer();
      slices.push({ data, width, height: pieceHeight });
    }
    return slices;
  } catch (error) {
    if (error instanceof PageImageError) throw error;
    throw new PageImageError("invalid_image", "This file could not be read as an image.");
  }
}

/** The rows a picture of `height` rows is cut at into `pieces` pieces: the even lines, each nudged into the nearest empty gap. */
async function chooseCuts(scaled: () => Sharp, height: number, pieces: number): Promise<number[]> {
  const even = Array.from({ length: pieces - 1 }, (_, i) => Math.round(((i + 1) * height) / pieces));

  let ranges: number[];
  try {
    // A thin greyscale copy, one sample row per picture row: enough to tell a blank gutter from artwork.
    const { data, info } = await scaled().greyscale().resize(SAMPLE_COLUMNS, height, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    ranges = rowRanges(data, info.width * info.channels, info.height);
  } catch {
    return even;
  }

  const reach = Math.floor((height / pieces) * CUT_SEARCH_SHARE);
  const cuts: number[] = [];
  for (const line of even) {
    const from = Math.max((cuts[cuts.length - 1] ?? 0) + 1, line - reach);
    const to = Math.min(height - 1, line + reach);
    cuts.push(emptiestRow(ranges, from, to, line));
  }
  return cuts;
}

function rowRanges(data: Buffer, stride: number, rows: number): number[] {
  const ranges = new Array<number>(rows);
  for (let y = 0; y < rows; y++) {
    let low = 255;
    let high = 0;
    for (let x = 0, at = y * stride; x < stride; x++, at++) {
      const value = data[at];
      if (value < low) low = value;
      if (value > high) high = value;
    }
    ranges[y] = high - low;
  }
  return ranges;
}

/** The middle of the longest run of empty rows in [from, to] (the one nearest `line` on a tie); with none, the calmest row. */
function emptiestRow(ranges: number[], from: number, to: number, line: number): number {
  let best = -1;
  let bestLength = 0;
  let bestDistance = Infinity;
  let runStart = -1;
  const close = (end: number) => {
    if (runStart < 0) return;
    const length = end - runStart;
    const middle = Math.floor((runStart + end - 1) / 2);
    const distance = Math.abs(middle - line);
    if (length > bestLength || (length === bestLength && distance < bestDistance)) {
      best = middle;
      bestLength = length;
      bestDistance = distance;
    }
    runStart = -1;
  };
  for (let y = from; y <= to; y++) {
    if (ranges[y] <= QUIET_RANGE) {
      if (runStart < 0) runStart = y;
    } else {
      close(y);
    }
  }
  close(to + 1);
  if (best >= 0) return best;

  let calmest = Math.min(Math.max(line, from), to);
  for (let y = from; y <= to; y++) {
    const better = ranges[y] < ranges[calmest] || (ranges[y] === ranges[calmest] && Math.abs(y - line) < Math.abs(calmest - line));
    if (better) calmest = y;
  }
  return calmest;
}
