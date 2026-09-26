import sharp from "sharp";
import { MAX_PAGE_HEIGHT, MAX_PAGE_WIDTH, PageImageError, preparePage } from "./page-image.util";

jest.setTimeout(60_000);

const solid = (width: number, height: number, color: string) => sharp({ create: { width, height, channels: 3, background: color } });

/** Artwork: 100-pixel blocks of black and white side by side, so every row of it has plenty of detail (a solid band would be as empty as a gap). */
const artwork = (width: number, height: number) => {
  const raw = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw[y * width + x] = Math.floor(x / 100) % 2 ? 255 : 0;
  return sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
};

/** A white strip with artwork at the given rows, so the empty gaps between them are where a cut should fall. */
async function strip(width: number, height: number, bands: [top: number, height: number][]) {
  const overlays = await Promise.all(bands.map(async ([top, bandHeight]) => ({ input: await artwork(width, bandHeight), top, left: 0 })));
  return solid(width, height, "#ffffff").composite(overlays).png().toBuffer();
}

/** The brightness (0-255) of the first and last row of a WebP page. */
async function edges(data: Buffer) {
  const { data: raw, info } = await sharp(data).greyscale().raw().toBuffer({ resolveWithObject: true });
  const mean = (row: number) => raw.subarray(row * info.width, (row + 1) * info.width).reduce((sum, v) => sum + v, 0) / info.width;
  return { first: mean(0), last: mean(info.height - 1) };
}

describe("preparePage (cutting)", () => {
  it("keeps an ordinary page as one WebP page", async () => {
    const png = await solid(1200, 1800, "#336699").png().toBuffer();
    const pages = await preparePage(png, { cut: true });
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ width: 1200, height: 1800 });
    expect((await sharp(pages[0].data).metadata()).format).toBe("webp");
  });

  it("cuts a long strip into even pieces that together are the whole picture, each one within the page height", async () => {
    const png = await strip(800, 12000, [[100, 600], [1500, 900], [3000, 700], [5200, 1000], [7000, 800], [9500, 900], [11000, 800]]);
    const pages = await preparePage(png, { cut: true });
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages.reduce((sum, p) => sum + p.height, 0)).toBe(12000);
    for (const page of pages) {
      expect(page.width).toBe(800);
      expect(page.height).toBeLessThanOrEqual(MAX_PAGE_HEIGHT);
      expect((await sharp(page.data).metadata()).height).toBe(page.height);
    }
  });

  it("puts the cuts in the empty gaps, not through the artwork", async () => {
    // The even lines (4000 and 8000) fall inside a piece of artwork; the gaps next to it are the place to cut.
    const png = await strip(800, 12000, [[3700, 700], [7700, 700], [500, 600], [10500, 700]]);
    const pages = await preparePage(png, { cut: true });
    expect(pages).toHaveLength(3);
    for (const page of pages) {
      const { first, last } = await edges(page.data);
      expect(first).toBeGreaterThan(250); // blank rows at both ends of every piece,
      expect(last).toBeGreaterThan(250); // so no piece starts or ends inside the artwork
    }
  });

  it("still cuts a strip that has no gap at all, evenly", async () => {
    const png = await solid(600, 9000, "#000000").png().toBuffer();
    const pages = await preparePage(png, { cut: true });
    expect(pages.map((p) => p.height).reduce((a, b) => a + b, 0)).toBe(9000);
    expect(pages.length).toBe(3);
  });

  it("shrinks a very wide picture to the width limit, keeping its proportions", async () => {
    const png = await solid(4800, 3200, "#224466").png().toBuffer();
    const pages = await preparePage(png, { cut: true });
    expect(pages).toHaveLength(1);
    expect(pages[0].width).toBe(MAX_PAGE_WIDTH);
    expect(pages[0].height).toBe(1600);
  });

  it("shrinks first, then cuts: a wide, tall picture becomes a few pages of the limited width", async () => {
    const png = await solid(3000, 15000, "#888888").jpeg().toBuffer();
    const pages = await preparePage(png, { cut: true });
    expect(pages.every((p) => p.width === MAX_PAGE_WIDTH)).toBe(true);
    expect(pages.reduce((sum, p) => sum + p.height, 0)).toBe(12000);
  });

  it("refuses bytes that are not a picture", async () => {
    await expect(preparePage(Buffer.from("not an image"), { cut: true })).rejects.toMatchObject({ code: "invalid_image" });
  });
});

describe("preparePage (one page)", () => {
  it("makes exactly one WebP page and never cuts", async () => {
    const png = await solid(900, 5500, "#336699").png().toBuffer();
    const pages = await preparePage(png, { cut: false });
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ width: 900, height: 5500 });
  });

  it("refuses a side over 6000, as the bot's route always did", async () => {
    const png = await solid(300, 6001, "#000000").png().toBuffer();
    const error = await preparePage(png, { cut: false }).catch((e) => e);
    expect(error).toBeInstanceOf(PageImageError);
    expect(error.code).toBe("image_too_large");
  });
});
