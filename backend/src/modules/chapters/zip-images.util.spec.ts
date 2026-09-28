import { unzipSync, zipSync } from "fflate";
import { listZipImages, readZipImage, ZipImportError } from "./zip-images.util";

const enc = (text: string) => new TextEncoder().encode(text);
const zip = (entries: Record<string, string | Uint8Array>) => zipSync(Object.fromEntries(Object.entries(entries).map(([name, data]) => [name, typeof data === "string" ? enc(data) : data])));

describe("listZipImages", () => {
  it("lists the pictures in reading order, folders included, and leaves out what is not a picture", () => {
    const archive = zip({
      "page-10.jpg": "x",
      "page-2.JPG": "x",
      "page-1.png": "x",
      "ch/3.webp": "x",
      "__MACOSX/._page-1.png": "x",
      ".DS_Store": "x",
      "Thumbs.db": "x",
      "notes.txt": "x",
    });
    expect(listZipImages(archive).map((i) => i.name)).toEqual(["ch/3.webp", "page-1.png", "page-2.JPG", "page-10.jpg"]);
  });

  it("reads one picture's bytes back", () => {
    const archive = zip({ "1.jpg": "first", "2.jpg": "second" });
    expect(readZipImage(archive, "2.jpg").toString()).toBe("second");
    expect(() => readZipImage(archive, "missing.jpg")).toThrow(ZipImportError);
  });

  it("says plainly when the bytes are not a ZIP", () => {
    expect(() => listZipImages(enc("this is not a zip"))).toThrow(ZipImportError);
    try {
      listZipImages(enc("nope"));
    } catch (error) {
      expect((error as ZipImportError).code).toBe("invalid_zip");
    }
  });

  it("refuses a picture that unpacks to something too large to be a page (a zip bomb)", () => {
    const bomb = zipSync({ "1.jpg": new Uint8Array(61 * 1024 * 1024) }, { level: 9 });
    expect(bomb.length).toBeLessThan(1024 * 1024);
    expect(() => listZipImages(bomb)).toThrow(ZipImportError);
    expect(unzipSync(bomb, { filter: () => false })).toEqual({}); // listing is cheap: nothing was unpacked
  });
});
