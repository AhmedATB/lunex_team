import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { ChapterImportService } from "./chapter-import.service";
import type { ChaptersService } from "./chapters.service";
import { DriveError } from "./drive/google-drive.client";

const FOLDER = "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

function build(options: { images?: { id: string; name: string; mimeType: string }[]; folderError?: DriveError; existingPages?: number[]; storeFails?: boolean; configured?: boolean } = {}) {
  const images = options.images ?? [{ id: "a", name: "1.jpg", mimeType: "image/jpeg" }, { id: "b", name: "2.jpg", mimeType: "image/jpeg" }, { id: "c", name: "3.jpg", mimeType: "image/jpeg" }];
  const drive = {
    serviceEmail: "reader@project.iam.gserviceaccount.com",
    assertFolder: jest.fn(async () => {
      if (options.folderError) throw options.folderError;
    }),
    listImages: jest.fn(async () => images),
    download: jest.fn(async (id: string) => Buffer.from(`bytes-${id}`)),
  };
  const chapters = {
    requirePublisher: jest.fn((role: string) => {
      if (role !== "owner") throw new ForbiddenException({ code: "insufficient_permissions" });
    }),
    get: jest.fn(async () => ({ id: "ch1", pages: (options.existingPages ?? []).map((pageNumber) => ({ pageNumber })) })),
    storePage: jest.fn(async (_chapterId: string, _page: number, _bytes: Buffer) => {
      if (options.storeFails) throw new Error("disk full");
    }),
  };
  const service = new ChapterImportService(chapters as unknown as ChaptersService, { get: () => undefined } as unknown as ConfigService, () => (options.configured === false ? null : drive));
  return { service, drive, chapters };
}

describe("Drive import", () => {
  it("fetches every image of the folder, in order, into the chapter's next pages", async () => {
    const { service, drive, chapters } = build({ existingPages: [1, 2] });
    await expect(service.startDrive("owner", "ch1", FOLDER)).resolves.toEqual({ total: 3 });
    expect(service.status("ch1")?.state).toBe("running");
    await flush();
    await flush();
    expect(service.status("ch1")).toMatchObject({ state: "done", total: 3, done: 3, error: null });
    expect(drive.download.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(chapters.storePage.mock.calls.map((c) => c[1])).toEqual([3, 4, 5]); // after the two pages it already had
    expect(chapters.storePage.mock.calls[0][2]).toEqual(Buffer.from("bytes-a"));
  });

  it("is for people who publish, and needs a working link, a set-up account and a folder with images", async () => {
    const { service } = build();
    await expect(service.startDrive("reader", "ch1", FOLDER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.startDrive("owner", "ch1", "https://example.com/nothing")).rejects.toMatchObject({ response: { code: "invalid_drive_link" } });
    await expect(build({ configured: false }).service.startDrive("owner", "ch1", FOLDER)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(build({ images: [] }).service.startDrive("owner", "ch1", FOLDER)).rejects.toMatchObject({ response: { code: "no_images" } });
    await expect(build({ images: Array.from({ length: 301 }, (_, i) => ({ id: `${i}`, name: `${i}.jpg`, mimeType: "image/jpeg" })) }).service.startDrive("owner", "ch1", FOLDER)).rejects.toMatchObject({ response: { code: "too_many_images" } });
  });

  it("names the address to share with when the folder is private", async () => {
    const { service } = build({ folderError: new DriveError("not_shared", "private") });
    const error = await service.startDrive("owner", "ch1", FOLDER).catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.response).toMatchObject({ code: "drive_folder_not_shared", serviceEmail: "reader@project.iam.gserviceaccount.com" });
    await expect(build({ folderError: new DriveError("not_a_folder", "file") }).service.startDrive("owner", "ch1", FOLDER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not start a second import of the same chapter while one is running", async () => {
    const { service } = build();
    await service.startDrive("owner", "ch1", FOLDER);
    await expect(service.startDrive("owner", "ch1", FOLDER)).rejects.toBeInstanceOf(ConflictException);
    await flush();
    await flush();
  });

  it("stops and says why when a page cannot be stored", async () => {
    const { service } = build({ storeFails: true });
    await service.startDrive("owner", "ch1", FOLDER);
    await flush();
    await flush();
    expect(service.status("ch1")).toMatchObject({ state: "failed", done: 0, error: "disk full" });
  });

  it("reports whether it is set up and the address to share folders with", () => {
    expect(build().service.driveInfo()).toEqual({ configured: true, serviceEmail: "reader@project.iam.gserviceaccount.com" });
    expect(build({ configured: false }).service.driveInfo()).toEqual({ configured: false, serviceEmail: null });
  });
});
