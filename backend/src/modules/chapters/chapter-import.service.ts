import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { ChaptersService, type ChapterActor } from "./chapters.service";
import { DriveError, FOLDER_MIME, GoogleDriveClient, isZipFile, loadDriveCredentials, parseDriveLink } from "./drive/google-drive.client";
import { listZipImages, readZipImage, ZipImportError } from "./zip-images.util";

/** Most pages one import will take: a chapter is a few dozen images, and this stops a wrong folder (a whole series) from filling storage. */
const MAX_IMAGES = 300;
/** The biggest ZIP taken from Drive: it is held in memory while its pictures are unpacked. */
const ZIP_MAX_BYTES = 350 * 1024 * 1024;
/** How many pictures are fetched and turned into pages side by side (they are still linked into the chapter in reading order). */
const CONCURRENCY = 4;
/** How long a finished import's report stays available. */
const REPORT_TTL_MS = 60 * 60_000;

export interface ImportJob {
  state: "running" | "done" | "failed";
  /** `downloading`: a ZIP is still being fetched from Drive (its pictures are not counted yet). `importing`: pictures are being turned into pages. */
  phase: "downloading" | "importing";
  total: number;
  done: number;
  /** Set when the job stopped early. */
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

type DriveLike = Pick<GoogleDriveClient, "serviceEmail" | "getFile" | "listImages" | "download">;

/** One picture of what is being imported: its name (for the order and the messages) and a way to get its bytes. */
interface PictureSource {
  name: string;
  load: () => Promise<Buffer>;
}

/**
 * Runs `produce` for every item, up to `concurrency` at a time, and hands the results to `consume` strictly in order: pictures are
 * fetched and prepared side by side, but the pages are numbered and linked in reading order. Stops at the first failure.
 */
export async function inOrder<Item, Result>(
  items: Item[],
  concurrency: number,
  produce: (item: Item, index: number) => Promise<Result>,
  consume: (result: Result, index: number) => Promise<void>
): Promise<void> {
  const started: Promise<Result>[] = [];
  const start = (index: number) => {
    if (index >= items.length || index in started) return;
    const work = produce(items[index], index);
    work.catch(() => undefined); // a failure is reported when its turn comes, not as an unhandled rejection
    started[index] = work;
  };
  for (let i = 0; i < Math.min(concurrency, items.length); i++) start(i);
  for (let i = 0; i < items.length; i++) {
    const result = await started[i];
    start(i + concurrency);
    await consume(result, i);
  }
}

/**
 * Pulls a chapter's pages from Google Drive: a folder of pictures, or one ZIP file of them. Drive is read with the site's service
 * account, which sees what is public ("anyone with the link") and what was shared with the account's address. The work runs in
 * the background (a chapter is dozens of pictures; a browser request would time out) and is followed through `status`. A job is
 * kept in memory, one per chapter: a restart forgets the report, never the pages already stored.
 */
@Injectable()
export class ChapterImportService {
  private readonly log = new Logger(ChapterImportService.name);
  private readonly jobs = new Map<string, ImportJob>();
  private client: DriveLike | null | undefined;

  constructor(
    private readonly chapters: ChaptersService,
    private readonly config: ConfigService,
    /** Replaceable in tests. */
    @Optional() private readonly driveFactory?: () => DriveLike | null
  ) {}

  private drive(): DriveLike | null {
    if (this.client === undefined) {
      if (this.driveFactory) {
        this.client = this.driveFactory();
      } else {
        const credentials = loadDriveCredentials(
          { json: this.config.get<string>("GOOGLE_DRIVE_CREDENTIALS_JSON"), file: this.config.get<string>("GOOGLE_DRIVE_CREDENTIALS_FILE") },
          (path) => readFileSync(path, "utf8")
        );
        this.client = credentials ? new GoogleDriveClient(credentials) : null;
      }
    }
    return this.client;
  }

  driveInfo() {
    const client = this.drive();
    return { configured: client !== null, serviceEmail: client?.serviceEmail ?? null };
  }

  status(chapterId: string): ImportJob | null {
    return this.jobs.get(chapterId) ?? null;
  }

  /**
   * Checks the link (a folder of pictures, or a ZIP file) and starts the background import. For a folder it answers with how many
   * pictures it found; for a ZIP the file still has to be fetched, so `total` is 0 until the status says the pictures are counted.
   */
  async startDrive(actor: ChapterActor, chapterId: string, link: string): Promise<{ total: number; kind: "folder" | "zip" }> {
    const chapter = await this.chapters.requireUploader(actor, chapterId);

    const client = this.drive();
    if (!client) {
      throw new ServiceUnavailableException({ code: "drive_not_configured", message: "Google Drive import is not set up on this site." });
    }
    const target = parseDriveLink(link);
    if (!target) throw new BadRequestException({ code: "invalid_drive_link", message: "This is not a Google Drive folder or file link." });

    if (this.jobs.get(chapterId)?.state === "running") {
      throw new ConflictException({ code: "import_running", message: "This chapter is already being imported." });
    }

    // Pages go after any the chapter already has, so importing twice never overwrites a page.
    const firstPage = chapter.pages.reduce((highest, page) => Math.max(highest, page.pageNumber), 0) + 1;

    try {
      const file = await client.getFile(target.id);
      if (file.mimeType === FOLDER_MIME) {
        const images = await client.listImages(file.id);
        if (images.length === 0) throw new BadRequestException({ code: "no_images", message: "The folder has no images." });
        if (images.length > MAX_IMAGES) {
          throw new BadRequestException({ code: "too_many_images", message: `The folder has ${images.length} images; a chapter takes at most ${MAX_IMAGES}.` });
        }
        const job = this.newJob(chapterId, "importing", images.length);
        const sources = images.map((image) => ({ name: image.name, load: () => this.withRetry(() => client.download(image.id)) }));
        void this.runJob(chapterId, job, () => this.pull(chapterId, job, sources, firstPage));
        return { total: images.length, kind: "folder" };
      }
      if (isZipFile(file)) {
        if (file.size !== null && file.size > ZIP_MAX_BYTES) {
          throw new BadRequestException({ code: "drive_file_too_large", message: `The ZIP is larger than ${Math.round(ZIP_MAX_BYTES / 1024 / 1024)} MB.` });
        }
        const job = this.newJob(chapterId, "downloading", 0);
        void this.runJob(chapterId, job, async () => {
          const zip = await this.withRetry(() => client.download(file.id, { maxBytes: ZIP_MAX_BYTES }), 2);
          const images = listZipImages(zip);
          if (images.length === 0) throw new Error("The ZIP has no images.");
          if (images.length > MAX_IMAGES) throw new Error(`The ZIP has ${images.length} images; a chapter takes at most ${MAX_IMAGES}.`);
          job.total = images.length;
          job.phase = "importing";
          await this.pull(chapterId, job, images.map((image) => ({ name: image.name, load: async () => readZipImage(zip, image.name) })), firstPage);
        });
        return { total: 0, kind: "zip" };
      }
      throw new BadRequestException({ code: "drive_unsupported_file", message: "The link is a file that is neither a folder of images nor a ZIP." });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw this.asHttpError(error, client.serviceEmail);
    }
  }

  private newJob(chapterId: string, phase: ImportJob["phase"], total: number): ImportJob {
    const job: ImportJob = { state: "running", phase, total, done: 0, error: null, startedAt: new Date().toISOString(), finishedAt: null };
    this.jobs.set(chapterId, job);
    return job;
  }

  /** Runs the work of a job and records how it ended (the report stays for an hour). */
  private async runJob(chapterId: string, job: ImportJob, work: () => Promise<void>) {
    try {
      await work();
      job.state = "done";
    } catch (error) {
      job.state = "failed";
      job.error = error instanceof DriveError || error instanceof ZipImportError || error instanceof Error ? error.message : "The import failed.";
      this.log.warn(`Drive import of chapter ${chapterId} stopped after ${job.done} of ${job.total} pages: ${job.error}`);
    } finally {
      job.finishedAt = new Date().toISOString();
      setTimeout(() => this.jobs.get(chapterId) === job && this.jobs.delete(chapterId), REPORT_TTL_MS).unref?.();
    }
  }

  /** Fetches and prepares the pictures a few at a time, and links their pages in reading order. */
  private async pull(chapterId: string, job: ImportJob, sources: PictureSource[], firstPage: number) {
    // A long picture becomes several pages, so the next number follows what the last one made, not its position.
    let nextPage = firstPage;
    await inOrder(
      sources,
      CONCURRENCY,
      async (source) => this.chapters.preparePages(await source.load()),
      async (slices, index) => {
        const { pages } = await this.chapters.storePrepared(chapterId, nextPage, slices);
        nextPage += pages;
        job.done = index + 1;
      }
    );
  }

  /** A download that fails once (a network blip, Drive's rate limit) is tried again before the whole import gives up. */
  private async withRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
    let last: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await work();
      } catch (error) {
        last = error;
        // A file that is too large stays too large.
        if (error instanceof DriveError && error.kind === "too_large") throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 700));
      }
    }
    throw last;
  }

  private asHttpError(error: unknown, serviceEmail: string) {
    if (error instanceof DriveError) {
      switch (error.kind) {
        case "not_shared":
          return new NotFoundException({
            code: "drive_folder_not_shared",
            message: "The link is private. Make it public (anyone with the link) or share it with the service account.",
            serviceEmail,
          });
        case "not_a_folder":
          return new BadRequestException({ code: "drive_not_a_folder", message: "This link is a file, not a folder." });
        case "rate_limited":
          return new ServiceUnavailableException({ code: "drive_rate_limited", message: "Google Drive is limiting requests. Try again in a minute." });
        case "auth_failed":
          return new ServiceUnavailableException({ code: "drive_auth_failed", message: "The site could not sign in to Google Drive." });
        case "too_large":
          return new BadRequestException({ code: "drive_file_too_large", message: error.message });
      }
    }
    this.log.error(`Drive lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    return new ServiceUnavailableException({ code: "drive_failed", message: "Could not read the link from Google Drive." });
  }
}
