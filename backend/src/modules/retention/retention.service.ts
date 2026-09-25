import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;

/** First sweep waits a few minutes so it never competes with boot-time work (migrations, cache warm-up). */
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;
const RUN_INTERVAL_MS = DAY_MS;

/** Rows deleted per statement — keeps each DELETE short so it can't hold locks or bloat WAL on a table that has grown for months. */
const BATCH_SIZE = 5_000;
const MAX_BATCHES_PER_TABLE = 200;

/**
 * A typo like RETENTION_AUDIT_DAYS=0 must never mean "delete everything";
 * anything below this is ignored in favour of the default.
 */
const MIN_RETENTION_DAYS = 7;

/**
 * How long each IP-bearing log is kept. These are the numbers the privacy
 * policy (src/app/(main)/privacy) states — change them together.
 *
 * - login_events: only ever read for security review of a recent incident.
 * - image_access_log: the leak-tracing ledger — kept longer because a leaked
 *   chapter can surface on a piracy site weeks after it was read.
 * - audit_log: admin/security actions (bans, role changes, password changes).
 * - chapter views: the per-day rows behind "most read this week" (who opened what); only the totals need to last.
 * - removed comments: a moderator's removal is soft, so the text stays reviewable (an appeal,
 *   a harassment report) for this long before it is deleted for good.
 */
export const DEFAULT_RETENTION_DAYS = {
  loginEvents: 90,
  imageAccessLog: 180,
  auditLog: 365,
  removedComments: 90,
  chapterViews: 90,
} as const;

export interface RetentionResult {
  loginEvents: number;
  imageAccessLog: number;
  auditLog: number;
  removedComments: number;
  chapterViews: number;
}

interface Sweep {
  name: keyof RetentionResult;
  days: number;
  findIds: (before: Date, take: number) => Promise<{ id: string }[]>;
  deleteByIds: (ids: string[]) => Promise<{ count: number }>;
}

/**
 * Enforces the log retention periods promised in the privacy policy. There is
 * no scheduler dependency on purpose: one process-local timer is enough for a
 * single API instance, and every delete is idempotent, so a second instance
 * running the same sweep at the same time just finds nothing left to do.
 *
 * Deleting from audit_log is the one deliberate exception to that table's
 * append-only convention — see backend/docs/security-architecture.md §20.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private firstRun?: NodeJS.Timeout;
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    this.firstRun = setTimeout(() => {
      void this.safeRun();
      this.interval = setInterval(() => void this.safeRun(), RUN_INTERVAL_MS);
      this.interval.unref();
    }, FIRST_RUN_DELAY_MS);
    this.firstRun.unref();
  }

  onModuleDestroy() {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.interval) clearInterval(this.interval);
  }

  /** One full sweep. Public so it can be triggered from a script or test; the timer goes through safeRun() instead. */
  async runOnce(now: Date = new Date()): Promise<RetentionResult> {
    const result: RetentionResult = { loginEvents: 0, imageAccessLog: 0, auditLog: 0, removedComments: 0, chapterViews: 0 };

    for (const sweep of this.sweeps()) {
      const cutoff = new Date(now.getTime() - sweep.days * DAY_MS);
      result[sweep.name] = await this.purge(sweep, cutoff);
    }

    return result;
  }

  /** A failed sweep (DB hiccup, a REVOKE on audit_log, ...) is logged and retried on the next tick — it must never take the API down. */
  private async safeRun() {
    try {
      const result = await this.runOnce();
      this.logger.log(
        `Retention sweep removed login_events=${result.loginEvents}, image_access_log=${result.imageAccessLog}, audit_log=${result.auditLog}, removed_comments=${result.removedComments}, chapter_views=${result.chapterViews}`
      );
    } catch (error) {
      this.logger.error("Retention sweep failed", error instanceof Error ? error.stack : String(error));
    }
  }

  private async purge(sweep: Sweep, cutoff: Date): Promise<number> {
    let removed = 0;
    for (let batch = 0; batch < MAX_BATCHES_PER_TABLE; batch++) {
      const rows = await sweep.findIds(cutoff, BATCH_SIZE);
      if (rows.length === 0) break;
      const { count } = await sweep.deleteByIds(rows.map((row) => row.id));
      removed += count;
      if (rows.length < BATCH_SIZE) break;
    }
    return removed;
  }

  private sweeps(): Sweep[] {
    return [
      {
        name: "loginEvents",
        days: this.days("RETENTION_LOGIN_EVENTS_DAYS", DEFAULT_RETENTION_DAYS.loginEvents),
        findIds: (before, take) =>
          this.prisma.loginEvent.findMany({ where: { at: { lt: before } }, select: { id: true }, take }),
        deleteByIds: (ids) => this.prisma.loginEvent.deleteMany({ where: { id: { in: ids } } }),
      },
      {
        name: "imageAccessLog",
        days: this.days("RETENTION_IMAGE_ACCESS_DAYS", DEFAULT_RETENTION_DAYS.imageAccessLog),
        findIds: (before, take) =>
          this.prisma.imageAccessLog.findMany({ where: { at: { lt: before } }, select: { id: true }, take }),
        deleteByIds: (ids) => this.prisma.imageAccessLog.deleteMany({ where: { id: { in: ids } } }),
      },
      {
        name: "auditLog",
        days: this.days("RETENTION_AUDIT_DAYS", DEFAULT_RETENTION_DAYS.auditLog),
        findIds: (before, take) =>
          this.prisma.auditLog.findMany({ where: { at: { lt: before } }, select: { id: true }, take }),
        deleteByIds: (ids) => this.prisma.auditLog.deleteMany({ where: { id: { in: ids } } }),
      },
      {
        name: "removedComments",
        days: this.days("RETENTION_REMOVED_COMMENTS_DAYS", DEFAULT_RETENTION_DAYS.removedComments),
        findIds: (before, take) =>
          this.prisma.comment.findMany({ where: { deletedAt: { lt: before } }, select: { id: true }, take }),
        deleteByIds: (ids) => this.prisma.comment.deleteMany({ where: { id: { in: ids } } }),
      },
      {
        // The per-day rows behind "most read this week"; the running totals on the series and chapter are kept.
        name: "chapterViews",
        days: this.days("RETENTION_CHAPTER_VIEWS_DAYS", DEFAULT_RETENTION_DAYS.chapterViews),
        findIds: (before, take) =>
          this.prisma.chapterView.findMany({ where: { createdAt: { lt: before } }, select: { id: true }, take }),
        deleteByIds: (ids) => this.prisma.chapterView.deleteMany({ where: { id: { in: ids } } }),
      },
    ];
  }

  private days(envKey: string, fallback: number): number {
    const raw = Number(this.config.get<string>(envKey));
    return Number.isInteger(raw) && raw >= MIN_RETENTION_DAYS ? raw : fallback;
  }
}
