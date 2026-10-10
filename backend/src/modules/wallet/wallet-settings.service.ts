import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { validOverrides, walletConfig, WALLET_KEYS, WALLET_LIMITS, type WalletConfig, type WalletOverrides } from "./wallet.config";

/** Only these change how the lock works: it decides what readers pay for, so it is not an editor's call. */
const SETTINGS_ROLES = new Set(["owner", "super_administrator"]);
const KEY = "wallet_config";
/** Other instances (and a restart) catch up within this long; this instance sees its own change at once. */
const CACHE_MS = 15_000;

export interface WalletSettingsView {
  values: WalletConfig;
  limits: typeof WALLET_LIMITS;
}

/**
 * The lock settings (how many newest chapters are locked, the free first chapters, the reading credit rate, the coin price).
 * What the owner saves from the admin panel is kept in the database and wins; a setting never saved comes from the
 * environment, then from the launch default. Every place that needs the settings asks here, so a change applies everywhere
 * at once and nobody has to touch Railway.
 */
@Injectable()
export class WalletSettingsService {
  private readonly log = new Logger(WalletSettingsService.name);
  private cache: { at: number; overrides: WalletOverrides } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: ConfigService
  ) {}

  private environment(): Record<string, string | undefined> {
    return {
      LOCKED_CHAPTER_COUNT: this.env.get<string>("LOCKED_CHAPTER_COUNT"),
      FREE_FIRST_CHAPTERS: this.env.get<string>("FREE_FIRST_CHAPTERS"),
      CHAPTERS_PER_CREDIT: this.env.get<string>("CHAPTERS_PER_CREDIT"),
      CHAPTER_COIN_PRICE: this.env.get<string>("CHAPTER_COIN_PRICE"),
    };
  }

  private async overrides(fresh = false): Promise<WalletOverrides> {
    if (!fresh && this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.overrides;
    let overrides: WalletOverrides;
    try {
      const row = await this.prisma.siteSetting.findUnique({ where: { key: KEY } });
      overrides = row ? validOverrides(JSON.parse(row.value)) : {};
    } catch (error) {
      // A hiccup must not lock or unlock the site by accident: keep what was last known.
      this.log.warn(`could not read the wallet settings: ${error instanceof Error ? error.message : error}`);
      overrides = this.cache?.overrides ?? {};
    }
    this.cache = { at: Date.now(), overrides };
    return overrides;
  }

  /** The settings in force now. */
  async current(): Promise<WalletConfig> {
    return walletConfig(this.environment(), await this.overrides());
  }

  private async requireManager(actorId: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
    if (!actor || !SETTINGS_ROLES.has(actor.role)) {
      throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the owner or a super administrator can change the lock settings." });
    }
  }

  async view(actorId: string): Promise<WalletSettingsView> {
    await this.requireManager(actorId);
    return { values: await this.current(), limits: WALLET_LIMITS };
  }

  /** Saves the given settings (the others stay as they are) and answers with what is now in force. */
  async update(actorId: string, patch: WalletOverrides): Promise<WalletSettingsView> {
    await this.requireManager(actorId);
    const saved = await this.overrides(true);
    const next: WalletOverrides = { ...saved };
    const changed: string[] = [];
    for (const key of WALLET_KEYS) {
      const value = patch[key];
      if (value === undefined) continue;
      const { min, max } = WALLET_LIMITS[key];
      if (!Number.isInteger(value) || value < min || value > max) {
        throw new BadRequestException({ code: "invalid_setting", message: `${key} must be a whole number between ${min} and ${max}.` });
      }
      next[key] = value;
      changed.push(`${key}=${value}`);
    }
    if (changed.length > 0) {
      const value = JSON.stringify(next);
      await this.prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
      await this.prisma.auditLog.create({ data: { actorId, action: "wallet.settings.update", target: changed.join(", ") } });
      this.cache = { at: Date.now(), overrides: next };
    }
    return { values: await this.current(), limits: WALLET_LIMITS };
  }
}
