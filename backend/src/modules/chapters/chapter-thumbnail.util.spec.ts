import sharp from "sharp";
import { makeThumbnail, previewOf, scorePage, suggestionGroups, THUMB_HEIGHT, THUMB_WIDTH, ThumbnailImageError } from "./chapter-thumbnail.util";

const solid = (width: number, height: number, background: string) => sharp({ create: { width, height, channels: 3, background } }).jpeg().toBuffer();
const block = (width: number, height: number, background: string) => sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();

/** A page with plain paper and one bold coloured block low down: the only interesting part. */
async function paperWithBlock(width: number, height: number, blockTop: number, blockHeight: number) {
  const red = await block(Math.round(width * 0.8), blockHeight, "#e11d48");
  const dark = await block(Math.round(width * 0.8), Math.round(blockHeight / 3), "#0f172a");
  return sharp({ create: { width, height, channels: 3, background: "#f5f5f0" } })
    .composite([
      { input: red, top: blockTop, left: Math.round(width * 0.1) },
      { input: dark, top: blockTop + Math.round(blockHeight / 3), left: Math.round(width * 0.1) },
    ])
    .jpeg()
    .toBuffer();
}

describe("makeThumbnail", () => {
  it("cuts a tall page to one wide frame, around the interesting part rather than the top", async () => {
    const page = await paperWithBlock(900, 3000, 2000, 500);
    const { data, width, height } = await makeThumbnail(page, "crop");
    expect([width, height]).toEqual([THUMB_WIDTH, THUMB_HEIGHT]);
    const { channels } = await sharp(data).stats();
    // The plain paper at the top would make the frame nearly grey-white; the coloured block makes the red channel stand out from the blue.
    expect(channels[0].mean - channels[2].mean).toBeGreaterThan(20);
  });

  it("keeps a picture the person chose in its own shape, only shrunk to fit", async () => {
    const tall = await makeThumbnail(await solid(675, 1200, "#3366cc"), "keep");
    expect([tall.width, tall.height]).toEqual([675, 1200]); // already small enough: not enlarged, not cropped
    const big = await makeThumbnail(await solid(3000, 1500, "#3366cc"), "keep");
    expect([big.width, big.height]).toEqual([1280, 640]);
    expect((await sharp(big.data).metadata()).format).toBe("webp");
  });

  it("refuses something that is not a picture", async () => {
    await expect(makeThumbnail(Buffer.from("not an image"), "crop")).rejects.toBeInstanceOf(ThumbnailImageError);
  });

  it("gives a small preview a page can show at once", async () => {
    const preview = await previewOf(await makeThumbnail(await solid(900, 1300, "#22aa66"), "crop"));
    expect(preview.startsWith("data:image/webp;base64,")).toBe(true);
    const bytes = Buffer.from(preview.split(",")[1], "base64");
    expect((await sharp(bytes).metadata()).width).toBeLessThanOrEqual(480);
    expect(bytes.length).toBeLessThan(60_000);
  });
});

describe("scorePage", () => {
  it("scores artwork above a blank page, a page of nearly nothing but white, and a black page", async () => {
    const art = await paperWithBlock(600, 900, 300, 300);
    const colourful = await sharp({ create: { width: 600, height: 900, channels: 3, background: "#2244aa" } })
      .composite([{ input: await block(300, 500, "#ffcc00"), top: 100, left: 150 }])
      .jpeg()
      .toBuffer();
    const blank = await solid(600, 900, "#ffffff");
    const black = await solid(600, 900, "#000000");
    const words = await sharp({ create: { width: 600, height: 900, channels: 3, background: "#ffffff" } })
      .composite([{ input: await block(400, 6, "#000000"), top: 400, left: 100 }])
      .jpeg()
      .toBuffer();
    const [a, c, b, k, w] = await Promise.all([art, colourful, blank, black, words].map(async (bytes) => (await scorePage(bytes)).score));
    expect(a).toBeGreaterThan(w);
    expect(c).toBeGreaterThan(b);
    expect(a).toBeGreaterThan(b);
    expect(a).toBeGreaterThan(k);
    expect(b).toBeLessThan(0.1);
    expect(k).toBeLessThan(0.1);
  });
});

describe("suggestionGroups", () => {
  const pages = (scores: number[]) => scores.map((score, i) => ({ pageNumber: i + 1, score }));

  it("deals the pages best first into groups of four, every page once", () => {
    const groups = suggestionGroups(pages([0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6, 0.5, 0.05]), 4);
    expect(groups.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(groups.map((g) => g.length)).toEqual([4, 4, 2]);
    expect(groups[0]).toContain(2); // the best page leads the first group
  });

  it("keeps neighbouring pages (the same scene) out of one group when it can", () => {
    // pages 2, 3 and 4 all score high: they must not fill a group together
    const groups = suggestionGroups(pages([0.1, 0.95, 0.94, 0.93, 0.1, 0.1, 0.9, 0.1, 0.1, 0.85, 0.1, 0.1]), 4);
    const first = groups[0];
    for (const a of first) for (const b of first) if (a !== b) expect(Math.abs(a - b)).toBeGreaterThan(1);
  });

  it("gives whatever there is when the chapter is short", () => {
    expect(suggestionGroups(pages([0.5, 0.4]), 4)).toEqual([[1, 2]]);
    expect(suggestionGroups([], 4)).toEqual([]);
  });
});
