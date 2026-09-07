import { Injectable } from "@nestjs/common";
import { NotificationsRepository } from "./notifications.repository";

const LIST_LIMIT = 30;

/**
 * `notify()` is called by OTHER services (auth, users) when a real account
 * event happens — it is never its own HTTP endpoint. There's no
 * Series/Chapter/Comment table yet (those still live in the frontend's mock
 * dataset), so only account-security events can produce a real notification
 * today; content-driven ones ("new chapter") wait until that content moves
 * server-side.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {}

  notify(userId: string, type: string, title: string, body?: string, link?: string) {
    return this.repo.create({ userId, type, title, body, link });
  }

  async list(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.repo.listForUser(userId, LIST_LIMIT),
      this.repo.countUnread(userId),
    ]);
    return { items, unreadCount };
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.repo.markRead(userId, id);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
  }
}
