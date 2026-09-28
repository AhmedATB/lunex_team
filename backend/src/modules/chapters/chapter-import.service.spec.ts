import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { zipSync } from "fflate";
import { ChapterImportService, inOrder } from "./chapter-import.service";
import type { ChaptersService } from "./chapters.service";
import { DriveError, FOLDER_MIME } from "./drive/google-drive.client";

const FOLDER = "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const ZIP_LINK = "https://drive.google.com/file/d/1ZipZipZipZipZipZipZipZip012345/view?usp=sharing";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const finished = async (service: ChapterImportService, chapterId = "ch1") => {
  for (let i = 0; i < 200 && service.status(chapterId)?.state === "running"; i++) await wait(5);
};

type Image = { id: string; name: string; mimeType: string };
const three: Image[] = [
  { id: "a", name: "1.jpg", mimeType: "image/jpeg" },
  { id: "b", name: "2.jpg", mimeType: "image/jpeg" },
  { id: "c", name: "3.jpg", mimeType: "image/jpeg" },
];

function build(
  options: {
    images?: Image[];
    file?: { name: string; mimeType: string; size: number | null };
    fileError?: DriveError;
    existingPages?: number[];
    storeFails?: boolean;
    configured?: boolean;
    pagesPerImage?: Record<string, number>;
    zipBytes?: Buffer;
    downloadDelay?: (id: string) => number;
  } = {}
) {
  const images = options.images ?? three;
  const file = options.file ?? { name: "chapter", mimeType: FOLDER_MIME, size: null };
  let inFlight = 0;
  let mostInFlight = 0;
  const drive = {
    serviceEmail: "reader@project.iam.gserviceaccount.com",
    getFile: jest.fn(async (id: string) => {
      if (options.fileError) throw options.fileError;
      return { id, ...file };
    }),
    listImages: jest.fn(async () => images),
    download: jest.fn(async (id: string, _options?: { maxBytes?: number }) => {
      inFlight++;
      mostInFlight = Math.max(mostInFlight, inFlight);
      await wait(options.downloadDelay?.(id) ?? 0);
      inFlight--;
      return options.zipBytes && id.startsWith("1Zip") ? options.zipBytes : Buffer.from(`bytes-${id}`);
    }),
  };
  const chapters = {
    requirePublisher: jest.fn((role: string) => {
      if (role !== "owner") throw new ForbiddenException({ code: "insufficient_permissions" });
    }),
    get: jest.fn(async () => ({ id: "ch1", pages: (options.existingPages ?? []).map((pageNumber) => ({ pageNumber })) })),
    // The pictures are prepared first (a long one is cut into several pages), then linked in reading order.
    preparePages: jest.fn(async (bytes: Buffer) => {
      const name = bytes.toString();
      const count = options.pagesPerImage?.[name.replace("bytes-", "")] ?? 1;
      return Array.from({ length: count }, (_, i) => ({ data: Buffer.from(`${name}#${i}`), width: 1, height: 1 }));
    }),
    storePrepared: jest.fn(async (_chapterId: string, _page: number, slices: unknown[]) => {
      if (options.storeFails) throw new Error("disk full");
      return { pages: slices.length };
    }),
  };
  const service = new ChapterImportService(chapters as unknown as ChaptersService, { get: () => undefined } as unknown as ConfigService, () => (options.configured === false ? null : drive));
  return { service, drive, chapters, mostInFlight: () => mostInFlight };
}

describe("Drive import of a folder", () => {
  it("fetches every image of the folder, in order, into the chapter's next pages", async () => {
    const { service, drive, chapters } = build({ existingPages: [1, 2] });
    await expect(service.startDrive("owner", "ch1", FOLDER)).resolves.toEqual({ total: 3, kind: "folder" });
    expect(service.status("ch1")?.state).toBe("running");
    await finished(service);
    expect(service.status("ch1")).toMatchObject({ state: "done", phase: "importing", total: 3, done: 3, error: null });
    expect(drive.download.mock.calls.map((c) => c[0]).sort()).toEqual(["a", "b", "c"]);
    expect(chapters.storePrepared.mock.calls.map((c) => c[1])).toEqual([3, 4, 5]); // after the two pages it already had
  });

  it("links the pages in reading order even when a later picture arrives first", async () => {
    const delays: Record<string, number> = { a: 60, b: 30, c: 0 };
    const { service, chapters } = build({ downloadDelay: (id) => delays[id] ?? 0 });
    await service.startDrive("owner", "ch1", FOLDER);
    await finished(service);
    const linked = chapters.storePrepared.mock.calls.map((c) => (c[2] as { data: Buffer }[])[0].data.toString());
    expect(linked).toEqual(["bytes-a#0", "bytes-b#0", "bytes-c#0"]);
    expect(chapters.storePrepared.mock.calls.map((c) => c[1])).toEqual([1, 2, 3]);
  });

  it("fetches several pictures at once, but never more than four", async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `${i + 1}.jpg`, mimeType: "image/jpeg" }));
    const { service, mostInFlight } = build({ images: many, downloadDelay: () => 15 });
    await service.startDrive("owner", "ch1", FOLDER);
    await finished(service);
    expect(service.status("ch1")).toMatchObject({ state: "done", done: 12 });
    expect(mostInFlight()).toBeGreaterThan(1);
    expect(mostInFlight()).toBeLessThanOrEqual(4);
  });

  it("numbers the next picture after the pages a long one was cut into", async () => {
    const { service, chapters } = build({ pagesPerImage: { a: 3 } }); // the first picture became three pages
    await service.startDrive("owner", "ch1", FOLDER);
    await finished(service);
    expect(chapters.storePrepared.mock.calls.map((c) => c[1])).toEqual([1, 4, 5]);
    expect(service.status("ch1")).toMatchObject({ state: "done", total: 3, done: 3 });
  });

  it("is for people who publish, and needs a working link, a set-up account and a folder with images", async () => {
    const { service } = build();
    await expect(service.startDrive("reader", "ch1", FOLDER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.startDrive("owner", "ch1", "https://example.com/nothing")).rejects.toMatchObject({ response: { code: "invalid_drive_link" } });
    await expect(build({ configured: false }).service.startDrive("owner", "ch1", FOLDER)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(build({ images: [] }).service.startDrive("owner", "ch1", FOLDER)).rejects.toMatchObject({ response: { code: "no_images" } });
    await expect(build({ images: Array.from({ length: 301 }, (_, i) => ({ id: `${i}`, name: `${i}.jpg`, mimeType: "image/jpeg" })) }).service.startDrive("owner", "ch1", FOLDER)).rejects.toMatchObject({ response: { code: "too_many_images" } });
  });

  it("names the address to share with when the link is private", async () => {
    const { service } = build({ fileError: new DriveError("not_shared", "private") });
    const error = await service.startDrive("owner", "ch1", FOLDER).catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.response).toMatchObject({ code: "drive_folder_not_shared", serviceEmail: "reader@project.iam.gserviceaccount.com" });
  });

  it("refuses a link to something that is neither a folder nor a ZIP", async () => {
    const { service } = build({ file: { name: "cover.png", mimeType: "image/png", size: 100 } });
    await expect(service.startDrive("owner", "ch1", FOLDER)).rejects.toMatchObject({ response: { code: "drive_unsupported_file" } });
  });

  it("does not start a second import of the same chapter while one is running", async () => {
    const { service } = build({ downloadDelay: () => 20 });
    await service.startDrive("owner", "ch1", FOLDER);
    await expect(service.startDrive("owner", "ch1", FOLDER)).rejects.toBeInstanceOf(ConflictException);
    await finished(service);
  });

  it("stops and says why when a page cannot be stored", async () => {
    const { service } = build({ storeFails: true });
    await service.startDrive("owner", "ch1", FOLDER);
    await finished(service);
    expect(service.status("ch1")).toMatchObject({ state: "failed", done: 0, error: "disk full" });
  });

  it("reports whether it is set up and the address to share folders with", () => {
    expect(build().service.driveInfo()).toEqual({ configured: true, serviceEmail: "reader@project.iam.gserviceaccount.com" });
    expect(build({ configured: false }).service.driveInfo()).toEqual({ configured: false, serviceEmail: null });
  });
});

describe("Drive import of a ZIP", () => {
  const archive = (entries: Record<string, string>) => Buffer.from(zipSync(Object.fromEntries(Object.entries(entries).map(([name, text]) => [name, new TextEncoder().encode(text)]))));
  const zipFile = { name: "CH6_Speedrun open the guide.zip", mimeType: "application/zip", size: 1000 };

  it("fetches the ZIP, opens it on the server and links its pictures in reading order", async () => {
    const zipBytes = archive({ "10.jpg": "ten", "2.jpg": "two", "1.jpg": "one", "__MACOSX/._1.jpg": "junk", "notes.txt": "not a picture", "sub/": "" });
    const { service, drive, chapters } = build({ file: zipFile, zipBytes, existingPages: [1] });
    await expect(service.startDrive("owner", "ch1", ZIP_LINK)).resolves.toEqual({ total: 0, kind: "zip" });
    expect(service.status("ch1")).toMatchObject({ state: "running", phase: "downloading", total: 0 });
    await finished(service);
    expect(service.status("ch1")).toMatchObject({ state: "done", phase: "importing", total: 3, done: 3, error: null });
    expect(drive.download).toHaveBeenCalledTimes(1); // the archive itself, once
    expect(drive.download.mock.calls[0][1]).toMatchObject({ maxBytes: expect.any(Number) });
    const linked = chapters.preparePages.mock.calls.map((c) => c[0].toString());
    expect(linked).toEqual(["one", "two", "ten"]);
    expect(chapters.storePrepared.mock.calls.map((c) => c[1])).toEqual([2, 3, 4]);
  });

  it("also recognises a ZIP by its name when Drive files it as a plain binary", async () => {
    const { service } = build({ file: { name: "chapter.ZIP", mimeType: "application/octet-stream", size: null }, zipBytes: archive({ "1.jpg": "one" }) });
    await expect(service.startDrive("owner", "ch1", ZIP_LINK)).resolves.toMatchObject({ kind: "zip" });
    await finished(service);
    expect(service.status("ch1")).toMatchObject({ state: "done", total: 1 });
  });

  it("refuses a ZIP that is too big before fetching it", async () => {
    const { service, drive } = build({ file: { ...zipFile, size: 400 * 1024 * 1024 } });
    await expect(service.startDrive("owner", "ch1", ZIP_LINK)).rejects.toMatchObject({ response: { code: "drive_file_too_large" } });
    expect(drive.download).not.toHaveBeenCalled();
  });

  it("fails clearly for an archive with no pictures, or one that is not a ZIP", async () => {
    const none = build({ file: zipFile, zipBytes: archive({ "readme.txt": "nothing" }) });
    await none.service.startDrive("owner", "ch1", ZIP_LINK);
    await finished(none.service);
    expect(none.service.status("ch1")).toMatchObject({ state: "failed", error: "The ZIP has no images." });

    const broken = build({ file: zipFile, zipBytes: Buffer.from("this is not a zip at all") });
    await broken.service.startDrive("owner", "ch1", ZIP_LINK);
    await finished(broken.service);
    expect(broken.service.status("ch1")).toMatchObject({ state: "failed", error: "This file is not a readable ZIP archive." });
  });
});

describe("inOrder", () => {
  it("hands over results in order and never runs more than the limit at once", async () => {
    let running = 0;
    let most = 0;
    const seen: number[] = [];
    await inOrder(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async (n) => {
        running++;
        most = Math.max(most, running);
        await wait((10 - n) * 3); // the later ones finish first
        running--;
        return n * 2;
      },
      async (result) => {
        seen.push(result);
      }
    );
    expect(seen).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(most).toBeLessThanOrEqual(3);
  });

  it("stops at the first failure, in order, and leaves no unhandled rejection behind", async () => {
    const seen: number[] = [];
    const run = inOrder(
      [0, 1, 2, 3, 4],
      3,
      async (n) => {
        await wait(5);
        if (n === 2) throw new Error("bad picture");
        if (n === 3) throw new Error("later failure, never reported");
        return n;
      },
      async (n) => {
        seen.push(n);
      }
    );
    await expect(run).rejects.toThrow("bad picture");
    expect(seen).toEqual([0, 1]);
    await wait(30);
  });
});
