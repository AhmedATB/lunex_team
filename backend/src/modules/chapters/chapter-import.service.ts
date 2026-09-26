import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFileSync } from "node:fs";
import { ChaptersService } from "./chapters.service";
import { DriveError, folderIdFromLink, GoogleDriveClient, loadDriveCredentials } from "./drive/google-drive.client";

/** Most pages one import will take: a chapter is a few dozen images, and this stops a wrong folder (a whole series) from filling storage. */
const MAX_IMAGES = 300;
/** How long a finished import's report stays available. */
const REPORT_TTL_MS = 60 * 60_000;

export interface ImportJob {
  state: "running" | "done" | "failed";
  total: number;
  done: number;
  /** Set when the job stopped early. */
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

type DriveLike = Pick<GoogleDriveClient, "serviceEmail" | "assertFolder" | "listImages" | "download">;

/**
 * Pulls a chapter's pages from a Google Drive folder. The folder is read with the site's service account, which sees a
 * folder that is public ("anyone with the link") and one that was shared with the account's address. The work runs in the
 * background (a chapter is dozens of images; a browser request would time out) and is followed through `status`.
 * A job is kept in memory, one per chapter: a restart forgets the report, never the pages already stored.
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

  /** Validates the folder, starts the background import and returns how many images it will fetch. */
  async startDrive(role: string, chapterId: string, link: string): Promise<{ total: number }> {
    this.chapters.requirePublisher(role);
    const chapter = await this.chapters.get(chapterId);

    const client = this.drive();
    if (!client) {
      throw new ServiceUnavailableException({ code: "drive_not_configured", message: "Google Drive import is not set up on this site." });
    }
    const folderId = folderIdFromLink(link);
    if (!folderId) throw new BadRequestException({ code: "invalid_drive_link", message: "This is not a Google Drive folder link." });

    if (this.jobs.get(chapterId)?.state === "running") {
      throw new ConflictException({ code: "import_running", message: "This chapter is already being imported." });
    }

    let images;
    try {
      await client.assertFolder(folderId);
      images = await client.listImages(folderId);
    } catch (error) {
      throw this.asHttpError(error, client.serviceEmail);
    }
    if (images.length === 0) throw new BadRequestException({ code: "no_images", message: "The folder has no images." });
    if (images.length > MAX_IMAGES) {
      throw new BadRequestException({ code: "too_many_images", message: `The folder has ${images.length} images; a chapter takes at most ${MAX_IMAGES}.` });
    }

    // Pages go after any the chapter already has, so importing twice never overwrites a page.
    const firstPage = chapter.pages.reduce((highest, page) => Math.max(highest, page.pageNumber), 0) + 1;
    const job: ImportJob = { state: "running", total: images.length, done: 0, error: null, startedAt: new Date().toISOString(), finishedAt: null };
    this.jobs.set(chapterId, job);
    void this.run(chapterId, job, client, images, firstPage);
    return { total: images.length };
  }

  private async run(chapterId: string, job: ImportJob, client: DriveLike, images: { id: string; name: string }[], firstPage: number) {
    try {
      for (const [index, image] of images.entries()) {
        const bytes = await this.withRetry(() => client.download(image.id));
        await this.chapters.storePage(chapterId, firstPage + index, bytes);
        job.done = index + 1;
      }
      job.state = "done";
    } catch (error) {
      job.state = "failed";
      job.error = error instanceof DriveError ? error.message : error instanceof Error ? error.message : "The import failed.";
      this.log.warn(`Drive import of chapter ${chapterId} stopped after ${job.done} of ${job.total} pages: ${job.error}`);
    } finally {
      job.finishedAt = new Date().toISOString();
      setTimeout(() => this.jobs.get(chapterId) === job && this.jobs.delete(chapterId), REPORT_TTL_MS).unref?.();
    }
  }

  /** A download that fails once (a network blip, Drive's rate limit) is tried again before the whole import gives up. */
  private async withRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
    let last: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await work();
      } catch (error) {
        last = error;
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
            message: "The folder is private. Make it public (anyone with the link) or share it with the service account.",
            serviceEmail,
          });
        case "not_a_folder":
          return new BadRequestException({ code: "drive_not_a_folder", message: "This link is a file, not a folder." });
        case "rate_limited":
          return new ServiceUnavailableException({ code: "drive_rate_limited", message: "Google Drive is limiting requests. Try again in a minute." });
        case "auth_failed":
          return new ServiceUnavailableException({ code: "drive_auth_failed", message: "The site could not sign in to Google Drive." });
      }
    }
    this.log.error(`Drive lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    return new ServiceUnavailableException({ code: "drive_failed", message: "Could not read the folder from Google Drive." });
  }
}
