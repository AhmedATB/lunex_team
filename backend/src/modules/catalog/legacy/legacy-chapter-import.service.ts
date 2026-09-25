import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { StorageService } from "../../images/storage/storage.interface";
import { CatalogRepository } from "../catalog.repository";
import { CatalogService } from "../catalog.service";

const API_TIMEOUT_MS = 30_000;
const IMAGE_TIMEOUT_MS = 45_000;
const FEED_PAGE_SIZE = 100;
const MAX_FEED_PAGES = 20;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
/** WebP cannot encode a side longer than this; a taller strip is scaled down to fit rather than failing. */
const MAX_WEBP_DIMENSION = 16_383;
const PAGE_CONCURRENCY = 4;
/** Stays well under the hosting proxy's request limit; the admin page calls again until nothing is left. */
const DEFAULT_BUDGET_MS = 150_000;
/** Each slice of a background run; short, so the status the admin page polls stays fresh. */
const JOB_SLICE_BUDGET_MS = 90_000;
const USER_AGENT = "Mozilla/5.0 (compatible; LunexTeamImport/1.0)";

interface OldChapter {
  id: string;
  attributes: {
    chapter?: string | null;
    title?: string | null;
    publishAt?: string | null;
    createdAt?: string | null;
    pages?: number;
  };
}

interface OldReadInfo {
  baseUrl: string;
  chapter: { hash: string; data: string[] };
}

interface Envelope<T> {
  data: T[];
}

export interface ChapterImportReport {
  /** True once every chapter that has pages on the old site is published here. */
  done: boolean;
  chapters: { published: number; alreadyDone: number; noPages: number; failed: number };
  pages: { saved: number; failed: number };
  /** Chapters still to do after this run (not counting the ones the old site has no pages for). */
  remaining: number;
  errors: string[];
}

type ChapterOutcome = "published" | "incomplete" | "skipped";

/** Progress of the run the server does on its own (see startJob). Kept in memory: a redeploy ends the run, and starting again resumes it. */
export interface ChapterImportJob {
  state: "idle" | "running" | "done" | "stopped";
  startedAt: string | null;
  finishedAt: string | null;
  /** Totals since this run started. */
  published: number;
  pagesSaved: number;
  failed: number;
  alreadyDone: number;
  noPages: number;
  /** Chapters still to do, as of the last slice; null before the first one finishes. */
  remaining: number | null;
  errors: string[];
  /** Why a stopped run stopped. */
  stopReason: string | null;
}

const IDLE_JOB: ChapterImportJob = {
  state: "idle",
  startedAt: null,
  finishedAt: null,
  published: 0,
  pagesSaved: 0,
  failed: 0,
  alreadyDone: 0,
  noPages: 0,
  remaining: null,
  errors: [],
  stopReason: null,
};

/**
 * Copies the old site's chapters and their page images into this database and
 * the object store, straight from the old site's public API.
 *
 * Safe to run again and again: a chapter is matched on the old site's id
 * (`legacyId`), only pages that are still missing are downloaded, and a chapter
 * is published only when every one of its pages is stored — so a run that is cut
 * short (time budget, network) leaves nothing half-readable and the next run
 * carries on from where it stopped. Nothing is ever deleted or overwritten.
 *
 * It refuses to run while page images would land in Postgres: about three
 * thousand pages would fill the database, which is what the object store is for.
 */
@Injectable()
export class LegacyChapterImportService {
  private readonly logger = new Logger(LegacyChapterImportService.name);
  private readonly origin = (process.env.LEGACY_SITE_ORIGIN ?? "https://lunexteam.com").replace(/\/+$/, "");

  private job: ChapterImportJob = { ...IDLE_JOB };

  constructor(
    private readonly repo: CatalogRepository,
    private readonly catalog: CatalogService,
    private readonly storage: StorageService
  ) {}

  jobStatus(): ChapterImportJob {
    return { ...this.job, errors: [...this.job.errors] };
  }

  /**
   * Starts the whole import on the server and returns at once; the admin page polls jobStatus().
   * The work no longer depends on anyone's browser tab (or laptop) staying awake. Calling it while a
   * run is going just reports that run. Only one runs at a time, on this instance.
   */
  startJob(): ChapterImportJob {
    this.assertObjectStorage();
    if (this.job.state === "running") return this.jobStatus();
    this.job = { ...IDLE_JOB, errors: [], state: "running", startedAt: new Date().toISOString() };
    void this.runJob();
    return this.jobStatus();
  }

  private async runJob() {
    const budget = Number(process.env.LEGACY_CHAPTER_BUDGET_MS) || JOB_SLICE_BUDGET_MS;
    let stalled = 0;
    try {
      for (;;) {
        const slice = await this.importChapters(budget);
        const job = this.job;
        job.published += slice.chapters.published;
        job.pagesSaved += slice.pages.saved;
        job.failed = slice.chapters.failed;
        job.alreadyDone = slice.chapters.alreadyDone;
        job.noPages = slice.chapters.noPages;
        job.remaining = slice.remaining;
        for (const e of slice.errors) if (job.errors.length < 50 && !job.errors.includes(e)) job.errors.push(e);

        if (slice.done) {
          job.state = "done";
          break;
        }
        // Two slices in a row that saved nothing means something keeps failing, not that it is slow.
        stalled = slice.chapters.published === 0 && slice.pages.saved === 0 ? stalled + 1 : 0;
        if (stalled >= 2) {
          job.state = "stopped";
          job.stopReason = "no progress in two rounds; see the errors";
          break;
        }
      }
    } catch (err) {
      this.job.state = "stopped";
      this.job.stopReason = message(err);
      this.logger.error(`Chapter import stopped: ${message(err)}`);
    } finally {
      this.job.finishedAt = new Date().toISOString();
    }
  }

  async importChapters(budgetMs = Number(process.env.LEGACY_CHAPTER_BUDGET_MS) || DEFAULT_BUDGET_MS): Promise<ChapterImportReport> {
    this.assertObjectStorage();

    const startedAt = Date.now();
    const outOfTime = () => Date.now() - startedAt > budgetMs;
    const report: ChapterImportReport = {
      done: false,
      chapters: { published: 0, alreadyDone: 0, noPages: 0, failed: 0 },
      pages: { saved: 0, failed: 0 },
      remaining: 0,
      errors: [],
    };

    const pending: { series: { id: string; teamId: string | null }; old: OldChapter }[] = [];
    for (const series of await this.repo.listImportedSeries()) {
      let feed: OldChapter[];
      try {
        feed = await this.fetchFeed(series.legacyId);
      } catch (err) {
        this.fail(report, `feed of ${series.slug}: ${message(err)}`);
        continue;
      }
      for (const old of feed) {
        const local = await this.repo.findChapterByLegacyId(old.id);
        if (local?.isPublished) {
          report.chapters.alreadyDone++;
        } else if (old.attributes.pages === 0) {
          report.chapters.noPages++;
        } else {
          pending.push({ series, old });
        }
      }
    }

    let left = pending.length;
    for (const { series, old } of pending) {
      if (outOfTime()) break;
      try {
        const outcome = await this.importChapter(series, old, report, outOfTime);
        if (outcome === "published") {
          report.chapters.published++;
          left--;
        } else if (outcome === "skipped") {
          report.chapters.noPages++;
          left--;
        }
      } catch (err) {
        report.chapters.failed++;
        this.fail(report, `chapter ${old.id}: ${message(err)}`);
      }
    }

    report.remaining = left;
    report.done = left === 0;
    if (report.chapters.published > 0) this.catalog.invalidate();
    this.logger.log(
      `Chapter import: ${report.chapters.published} published, ${report.pages.saved} pages saved, ${report.remaining} remaining`
    );
    return report;
  }

  private assertObjectStorage() {
    const backend = process.env.IMAGE_STORAGE_BACKEND;
    if (backend !== "r2" && backend !== "local") {
      throw new ConflictException({
        code: "object_storage_required",
        message: "Page images would be stored in the database. Set up object storage (IMAGE_STORAGE_BACKEND=r2) before importing chapters.",
      });
    }
  }

  private async importChapter(
    series: { id: string; teamId: string | null },
    old: OldChapter,
    report: ChapterImportReport,
    outOfTime: () => boolean
  ): Promise<ChapterOutcome> {
    const number = Number.parseFloat(old.attributes.chapter ?? "");
    if (!Number.isFinite(number)) throw new Error(`unreadable chapter number "${old.attributes.chapter}"`);

    const info = await this.getJson<OldReadInfo>(`/read/${old.id}`);
    const files = info.chapter?.data ?? [];
    if (files.length === 0) return "skipped";
    const imageBase = this.imageBase(info);

    let local = await this.repo.findChapterByLegacyId(old.id);
    if (!local) {
      if (await this.repo.chapterNumberTaken(series.id, number)) {
        throw new Error(`chapter ${number} of this series already exists here, left alone`);
      }
      const created = await this.repo.createImportedChapter({
        seriesId: series.id,
        teamId: series.teamId ?? "",
        number,
        title: (old.attributes.title ?? "").trim(),
        legacyId: old.id,
      });
      local = { id: created.id, isPublished: false, pages: [] };
    }

    const have = new Set(local.pages.map((p) => p.pageNumber));
    const missing = files.map((file, index) => ({ file, pageNumber: index + 1 })).filter((p) => !have.has(p.pageNumber));

    for (let i = 0; i < missing.length; i += PAGE_CONCURRENCY) {
      if (outOfTime()) return "incomplete";
      const batch = missing.slice(i, i + PAGE_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((p) => this.storePage(local.id, p.pageNumber, `${imageBase}/${info.chapter.hash}/${encodeURIComponent(p.file)}`))
      );
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          report.pages.saved++;
        } else {
          report.pages.failed++;
          this.fail(report, `chapter ${number} page ${batch[index].pageNumber}: ${message(result.reason)}`);
        }
      });
      if (results.some((r) => r.status === "rejected")) return "incomplete";
    }

    const publishedAt = new Date(old.attributes.publishAt ?? old.attributes.createdAt ?? Date.now());
    await this.repo.publishImportedChapter(local.id, Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt);
    return "published";
  }

  private async storePage(chapterId: string, pageNumber: number, url: string) {
    const source = await this.getBytes(url);
    const { data, width, height } = await normalizePage(source);
    const storageKey = `chapters/${randomUUID()}.webp`;
    const { checksum } = await this.storage.put(storageKey, data);
    await this.repo.addChapterPage({ chapterId, pageNumber, storageKey, checksum, mimeType: "image/webp", width, height });
  }

  /** The page images live on a CDN whose address comes from the old site's own response; only its own domain is trusted. */
  private imageBase(info: OldReadInfo): string {
    const base = new URL(info.baseUrl);
    const own = new URL(this.origin);
    const within = (host: string, root: string) => host === root || host.endsWith(`.${root}`);
    if (!within(base.hostname, own.hostname) && !within(base.hostname, "lunexteam.com")) {
      throw new Error(`image host ${base.hostname} is not the old site's`);
    }
    // Plain http is accepted only when the old site itself is configured as http (a local test double).
    if (base.protocol !== "https:" && own.protocol !== "http:") throw new Error("image host is not https");
    return `${base.origin}/data`;
  }

  private async fetchFeed(mangaId: string): Promise<OldChapter[]> {
    const chapters: OldChapter[] = [];
    for (let page = 0; page < MAX_FEED_PAGES; page++) {
      const batch = await this.getJson<Envelope<OldChapter>>(`/manga/${mangaId}/feed?limit=${FEED_PAGE_SIZE}&offset=${page * FEED_PAGE_SIZE}`);
      chapters.push(...batch.data);
      if (batch.data.length < FEED_PAGE_SIZE) break;
    }
    return chapters;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.origin}/api/v2${path}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`old site ${path} answered ${res.status}`);
    return (await res.json()) as T;
  }

  private async getBytes(url: string): Promise<Buffer> {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`image answered ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("image is larger than 25 MB");
    return bytes;
  }

  private fail(report: ChapterImportReport, text: string) {
    this.logger.warn(text);
    if (report.errors.length < 50) report.errors.push(text);
  }
}

/**
 * The old site already serves WebP, so those files are stored exactly as they are: no second lossy pass, no quality
 * loss, and no CPU spent re-encoding thousands of tall pages. Anything else (JPEG, PNG) is converted to WebP like an
 * admin upload, and a side longer than WebP can encode is scaled down to fit.
 */
async function normalizePage(source: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  let image = sharp(source);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("not a readable image");
  const fits = meta.width <= MAX_WEBP_DIMENSION && meta.height <= MAX_WEBP_DIMENSION;
  if (meta.format === "webp" && fits) return { data: source, width: meta.width, height: meta.height };
  if (meta.width > MAX_WEBP_DIMENSION || meta.height > MAX_WEBP_DIMENSION) {
    image = image.resize({ width: MAX_WEBP_DIMENSION, height: MAX_WEBP_DIMENSION, fit: "inside", withoutEnlargement: true });
  }
  const { data, info } = await image.webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
