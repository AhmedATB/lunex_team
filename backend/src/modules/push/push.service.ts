import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as webpush from "web-push";
import type { PreferencesDto, SubscribeDto } from "./dto/push.dto";
import { PushRepository, type PushCategory, type PushPreferences, type StoredSubscription } from "./push.repository";

/**
 * Where a push may be sent: only the push services of the browsers themselves. A visitor hands the site an address to send to, so
 * without this check the site could be told to send requests to anywhere (an internal address, a stranger's server).
 */
const PUSH_SERVICES = [
  /^https:\/\/fcm\.googleapis\.com\//, // Chrome, Edge, Opera, Samsung Internet, Brave…
  /^https:\/\/android\.googleapis\.com\//,
  /^https:\/\/updates\.push\.services\.mozilla\.com\//, // Firefox
  /^https:\/\/[a-z0-9.-]+\.push\.services\.mozilla\.com\//,
  /^https:\/\/[a-z0-9.-]+\.push\.apple\.com\//, // Safari, and the home-screen app on iPhone
  /^https:\/\/[a-z0-9.-]+\.notify\.windows\.com\//, // old Edge
];

const VAPID_PUBLIC = "vapid_public_key";
const VAPID_PRIVATE = "vapid_private_key";
const SEND_TIMEOUT_MS = 10_000;
const CONCURRENCY = 20;
const PAGE = 500;
/** How long a push service keeps a notification for a device that is off, before dropping it. */
const TTL_SECONDS = 24 * 60 * 60;
const TITLE_MAX = 80;
const BODY_MAX = 160;

export interface PushPayload {
  title: string;
  body?: string;
  /** Where tapping it goes (a path on the site). */
  url?: string;
  /** A newer notification with the same tag replaces the one still showing (one line per chat, not one per message). */
  tag?: string;
}

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/**
 * Notifications that reach a phone or computer even while the site is closed (Web Push). A browser subscribes (its address and keys
 * are kept, tied to the account), and what happens on the site — a new chapter of a favourite, a message, a reply — is sent to those
 * devices, encrypted, through the browser vendor's push service. It never throws: a notification that cannot be sent must not undo
 * what caused it.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly log = new Logger(PushService.name);
  private vapid: { publicKey: string; privateKey: string } | null = null;

  constructor(
    private readonly repo: PushRepository,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    try {
      await this.ensureKeys();
    } catch (error) {
      this.log.warn(`push keys unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * The keys that identify the site to browsers' push services: from the environment when set, otherwise made once and kept in the
   * database, so notifications work without anyone having to generate keys (and keep them the same across restarts).
   */
  private async ensureKeys(): Promise<{ publicKey: string; privateKey: string }> {
    if (this.vapid) return this.vapid;
    const fromEnv = { publicKey: this.config.get<string>("VAPID_PUBLIC_KEY")?.trim(), privateKey: this.config.get<string>("VAPID_PRIVATE_KEY")?.trim() };
    let keys = fromEnv.publicKey && fromEnv.privateKey ? { publicKey: fromEnv.publicKey, privateKey: fromEnv.privateKey } : null;
    if (!keys) {
      let publicKey = await this.repo.getSetting(VAPID_PUBLIC);
      let privateKey = await this.repo.getSetting(VAPID_PRIVATE);
      if (!publicKey || !privateKey) {
        const made = webpush.generateVAPIDKeys();
        await this.repo.setSettingIfMissing(VAPID_PUBLIC, made.publicKey);
        await this.repo.setSettingIfMissing(VAPID_PRIVATE, made.privateKey);
        // Whoever wrote first wins: everyone reads back what is stored.
        publicKey = await this.repo.getSetting(VAPID_PUBLIC);
        privateKey = await this.repo.getSetting(VAPID_PRIVATE);
      }
      if (!publicKey || !privateKey) throw new Error("could not store the keys");
      keys = { publicKey, privateKey };
    }
    // Push services want a contact that is an https: or mailto: address (a local http address would be refused).
    const subject = [this.config.get<string>("VAPID_SUBJECT"), this.config.get<string>("FRONTEND_URL")]
      .map((candidate) => candidate?.trim())
      .find((candidate) => candidate && /^(https:|mailto:)/.test(candidate)) ?? "https://lunexteam.com";
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
    this.vapid = keys;
    return keys;
  }

  /** The site's public key, which a browser needs in order to subscribe. */
  async publicKey(): Promise<{ publicKey: string }> {
    return { publicKey: (await this.ensureKeys()).publicKey };
  }

  // ---- devices and preferences ---------------------------------------------------------

  async subscribe(userId: string, dto: SubscribeDto, userAgent: string | undefined): Promise<{ subscribed: true }> {
    if (!PUSH_SERVICES.some((pattern) => pattern.test(dto.endpoint))) {
      throw new BadRequestException({ code: "invalid_endpoint", message: "This is not a browser's push address." });
    }
    await this.repo.upsertSubscription({ userId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent: userAgent?.slice(0, 200) ?? null });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.repo.deleteSubscription(userId, endpoint);
  }

  /** Whether notifications reach this device (`endpoint`) or any of the account's, and what the account wants. */
  async status(userId: string, endpoint: string | undefined) {
    const [devices, thisDevice, preferences] = await Promise.all([
      this.repo.countSubscriptions(userId),
      endpoint ? this.repo.hasSubscription(userId, endpoint) : Promise.resolve(false),
      this.repo.getPreferences(userId),
    ]);
    return { devices, thisDevice, preferences };
  }

  async setPreferences(userId: string, dto: PreferencesDto): Promise<PushPreferences> {
    const changes: Partial<PushPreferences> = {};
    for (const key of ["chapters", "messages", "replies", "news", "account"] as const) if (dto[key] !== undefined) changes[key] = dto[key];
    return this.repo.savePreferences(userId, changes);
  }

  /** A test notification to the account's own devices, so a person can see that it works. */
  async sendTest(userId: string): Promise<{ sent: number }> {
    const subs = await this.repo.subscriptionsFor([userId]);
    if (subs.length === 0) throw new BadRequestException({ code: "no_devices", message: "No device is set to receive notifications." });
    const delivered = await this.deliverAll(subs, { title: "LUNEX TEAM", body: "تعمل الإشعارات على هذا الجهاز ✅", url: "/notifications", tag: "lunex-test" });
    return { sent: delivered };
  }

  // ---- sending ------------------------------------------------------------------------------

  /** To one account's devices (if it wants this kind). Fire and forget: never throws. */
  async toUser(userId: string, category: PushCategory, payload: PushPayload): Promise<void> {
    await this.toUsers([userId], category, payload);
  }

  /** To these accounts' devices, those that want this kind. */
  async toUsers(userIds: string[], category: PushCategory, payload: PushPayload): Promise<void> {
    try {
      const wanting = await this.whoWants(userIds, category);
      await this.deliverAll(await this.repo.subscriptionsFor(wanting), payload);
    } catch (error) {
      this.log.warn(`push failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** A new chapter of a work: to the accounts that have it in their library (their favourites). */
  async toLibraryReaders(seriesId: string, payload: PushPayload): Promise<void> {
    try {
      await this.toUsers(await this.repo.libraryReaderIds(seriesId), "chapters", payload);
    } catch (error) {
      this.log.warn(`push to a library failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * A message was sent: to the other people of the chat. A chat between two shows the sender's name and the words; a group shows the
   * group's name and "sender: words". A picture with no words shows as "📷 صورة".
   */
  async newMessage(conversationId: string, senderId: string, text: string, pictures: number): Promise<void> {
    try {
      const chat = await this.repo.chatContext(conversationId, senderId);
      if (!chat || chat.recipientIds.length === 0) return;
      const words = text.trim() || (pictures > 1 ? `📷 ${pictures} صور` : "📷 صورة");
      await this.toUsers(chat.recipientIds, "messages", {
        title: chat.isGroup ? chat.title || "مجموعة" : chat.senderName,
        body: chat.isGroup ? `${chat.senderName}: ${words}` : words,
        url: `/messages?chat=${encodeURIComponent(conversationId)}`,
        tag: `chat-${conversationId}`,
      });
    } catch (error) {
      this.log.warn(`push of a message failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** To every device whose account wants this kind (a new work, a news post). */
  async toEveryone(category: PushCategory, payload: PushPayload): Promise<void> {
    try {
      let after: string | null = null;
      for (;;) {
        const page = await this.repo.subscriptionsPage(after, PAGE);
        if (page.length === 0) break;
        after = page[page.length - 1].id;
        const wanting = new Set(await this.whoWants([...new Set(page.map((s) => s.userId))], category));
        await this.deliverAll(page.filter((s) => wanting.has(s.userId)), payload);
        if (page.length < PAGE) break;
      }
    } catch (error) {
      this.log.warn(`push broadcast failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** The people of `userIds` who have not turned this kind off (an account that never chose wants everything). */
  private async whoWants(userIds: string[], category: PushCategory): Promise<string[]> {
    const unique = [...new Set(userIds)];
    const prefs = await this.repo.preferencesFor(unique);
    return unique.filter((id) => prefs.get(id)?.[category] !== false);
  }

  /** Sends to each device (a few at a time), drops the ones the push service says are gone, and counts what was delivered. */
  private async deliverAll(subs: StoredSubscription[], payload: PushPayload): Promise<number> {
    if (subs.length === 0) return 0;
    try {
      await this.ensureKeys();
    } catch {
      return 0;
    }
    const body = JSON.stringify({ title: clip(payload.title, TITLE_MAX), body: payload.body ? clip(payload.body, BODY_MAX) : undefined, url: payload.url ?? "/", tag: payload.tag });
    let delivered = 0;
    for (let i = 0; i < subs.length; i += CONCURRENCY) {
      const results = await Promise.all(subs.slice(i, i + CONCURRENCY).map((sub) => this.deliver(sub, body)));
      delivered += results.filter(Boolean).length;
    }
    return delivered;
  }

  private async deliver(sub: StoredSubscription, body: string): Promise<boolean> {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, { TTL: TTL_SECONDS, timeout: SEND_TIMEOUT_MS, urgency: "normal" });
      return true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410: the browser cancelled, or the address expired — the device will never receive anything again.
      if (status === 404 || status === 410) await this.repo.deleteSubscriptionById(sub.id);
      else this.log.warn(`push to a device answered ${status ?? "no answer"}`);
      return false;
    }
  }
}
