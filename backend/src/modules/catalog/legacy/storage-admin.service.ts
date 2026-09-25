import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { R2StorageService } from "../../images/storage/r2-storage.service";

const DEFAULT_BUDGET_MS = 150_000;
const R2_VARS = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;

export type StorageBackendName = "database" | "local" | "r2";

export interface StorageStatus {
  /** Where new images are being written right now. */
  backend: StorageBackendName;
  /** All four R2_* settings are present, so a copy to R2 (or a switch to it) can work. */
  r2Configured: boolean;
  /** Images still stored in the database. */
  databaseImages: number;
}

export interface CopyReport {
  copied: number;
  alreadyThere: number;
  failed: number;
  /** Images left for another call because the time budget ran out. */
  remaining: number;
  done: boolean;
  errors: string[];
}

/**
 * Owner tooling for the move from Postgres image storage to Cloudflare R2.
 * `copyToR2` is the in-app version of scripts/migrate-image-blobs-to-r2.ts: it
 * runs inside the backend, which already holds the R2 credentials, so nobody
 * has to put the database URL and the R2 keys on their own machine.
 */
@Injectable()
export class StorageAdminService {
  private readonly logger = new Logger(StorageAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2StorageService
  ) {}

  async status(): Promise<StorageStatus> {
    const backend = process.env.IMAGE_STORAGE_BACKEND;
    return {
      backend: backend === "r2" ? "r2" : backend === "local" ? "local" : "database",
      r2Configured: R2_VARS.every((name) => Boolean(process.env[name])),
      databaseImages: await this.prisma.imageBlob.count(),
    };
  }

  /**
   * Copies every image stored in the database into R2 under the same key, then reads
   * it back and compares the bytes. Idempotent, and never deletes anything: the copies
   * in Postgres stay until someone removes them on purpose after the switch to R2.
   */
  async copyToR2(budgetMs = DEFAULT_BUDGET_MS): Promise<CopyReport> {
    if (!R2_VARS.every((name) => Boolean(process.env[name]))) {
      throw new ConflictException({
        code: "r2_not_configured",
        message: "R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set on the backend first.",
      });
    }

    const startedAt = Date.now();
    const report: CopyReport = { copied: 0, alreadyThere: 0, failed: 0, remaining: 0, done: false, errors: [] };
    const keys = (await this.prisma.imageBlob.findMany({ select: { storageKey: true }, orderBy: { createdAt: "asc" } })).map((r) => r.storageKey);

    let index = 0;
    for (; index < keys.length; index++) {
      if (Date.now() - startedAt > budgetMs) break;
      const key = keys[index];
      try {
        const row = await this.prisma.imageBlob.findUnique({ where: { storageKey: key } });
        if (!row) continue;
        const data = Buffer.from(row.data);

        let present = false;
        try {
          present = Buffer.compare(await this.r2.get(key), data) === 0;
        } catch {
          // Not in R2 yet.
        }
        if (!present) {
          await this.r2.put(key, data);
          if (Buffer.compare(await this.r2.get(key), data) !== 0) throw new Error("read-back did not match");
          report.copied++;
        } else {
          report.alreadyThere++;
        }
      } catch (err) {
        report.failed++;
        const text = `${key}: ${err instanceof Error ? err.message : String(err)}`;
        this.logger.warn(text);
        if (report.errors.length < 50) report.errors.push(text);
      }
    }

    report.remaining = keys.length - index;
    report.done = report.remaining === 0 && report.failed === 0;
    this.logger.log(`Copy to R2: ${report.copied} copied, ${report.alreadyThere} already there, ${report.failed} failed, ${report.remaining} left`);
    return report;
  }
}
