import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { fixTanween } from "../../common/text/arabic.util";
import { isEffectivelyBanned, isMuted } from "../moderation/moderation.util";
import { MAX_OTHER_MEMBERS, type AddMembersDto, type CreateConversationDto, type ListMessagesQueryDto, type SendMessageDto } from "./dto/messages.dto";
import { MessagesRepository } from "./messages.repository";

const LIST_LIMIT = 100;
const DEFAULT_PAGE = 40;

interface PersonRow {
  id: string;
  username: string;
  displayName: string | null;
  avatarMimeType: string | null;
  updatedAt: Date;
}

export const toPerson = (row: PersonRow) => ({
  id: row.id,
  username: row.username,
  displayName: row.displayName ?? row.username,
  avatarVersion: row.avatarMimeType ? row.updatedAt.toISOString() : null,
});

const cleanUsername = (name: string) => name.trim().replace(/^@/, "");

/**
 * Chats between members: a direct chat (one per pair of people) or a group. Only the members of a conversation can read it
 * or write to it; everything is scoped by the caller's id from the token, never by an id in the request.
 */
@Injectable()
export class MessagesService {
  constructor(private readonly repo: MessagesRepository) {}

  /** Starts a chat with the named people (or opens the one that already exists between the two). */
  async create(actorId: string, dto: CreateConversationDto) {
    await this.requireActor(actorId);

    const usernames = [...new Set((dto.usernames ?? []).map(cleanUsername).filter(Boolean))];
    const ids = [...new Set(dto.userIds ?? [])];
    const found = await this.repo.findPeople({ ids, usernames });

    const missing = [...usernames.filter((name) => !found.some((p) => p.username === name)), ...ids.filter((id) => !found.some((p) => p.id === id))];
    if (missing.length > 0) {
      throw new NotFoundException({ code: "user_not_found", message: `No account: ${missing.join(", ")}` });
    }

    const others = [...new Map(found.filter((p) => p.id !== actorId).map((p) => [p.id, p])).values()];
    if (others.length === 0) {
      throw new BadRequestException({ code: "no_recipients", message: "Choose at least one other person." });
    }
    if (others.length > MAX_OTHER_MEMBERS) {
      throw new BadRequestException({ code: "too_many_members", message: `A chat has at most ${MAX_OTHER_MEMBERS + 1} people.` });
    }
    await this.requireNotBlocked(actorId, others.map((p) => p.id));

    if (others.length === 1) {
      const pairKey = [actorId, others[0].id].sort().join(":");
      const existing = await this.repo.findByPairKey(pairKey);
      if (existing) {
        await this.repo.addMembers(existing.id, [actorId, others[0].id]); // someone who left comes back to the same chat
        return this.summary(existing.id, actorId);
      }
      const created = await this.repo.createConversation({ title: null, isGroup: false, pairKey, createdById: actorId, memberIds: [actorId, others[0].id] });
      return this.summary(created.id, actorId);
    }

    const created = await this.repo.createConversation({
      title: dto.title?.trim() ? dto.title.trim() : null,
      isGroup: true,
      pairKey: null,
      createdById: actorId,
      memberIds: [actorId, ...others.map((p) => p.id)],
    });
    return this.summary(created.id, actorId);
  }

  async list(actorId: string) {
    const [rows, unread] = await Promise.all([this.repo.listFor(actorId, LIST_LIMIT), this.repo.unreadByConversation(actorId)]);
    return { conversations: rows.map((row) => this.toConversation(row, unread.get(row.id) ?? 0)) };
  }

  async unreadCount(actorId: string) {
    const unread = await this.repo.unreadByConversation(actorId);
    let messages = 0;
    for (const n of unread.values()) messages += n;
    return { unreadConversations: unread.size, unreadMessages: messages };
  }

  /** A page of a conversation, oldest first within the page; `before` pages back through older ones. */
  async messages(actorId: string, conversationId: string, query: ListMessagesQueryDto) {
    await this.requireMember(conversationId, actorId);
    const limit = query.limit ?? DEFAULT_PAGE;
    const before = query.before ? new Date(query.before) : undefined;
    const rows = await this.repo.listMessages(conversationId, { before: before && !Number.isNaN(+before) ? before : undefined, take: limit + 1 });
    const items = rows
      .slice(0, limit)
      .reverse()
      .map((m) => ({ id: m.id, senderId: m.senderId, text: fixTanween(m.text), createdAt: m.createdAt }));
    return { items, hasMore: rows.length > limit };
  }

  async send(actorId: string, conversationId: string, dto: SendMessageDto) {
    const actor = await this.requireActor(actorId);
    if (isMuted(actor)) {
      throw new ForbiddenException({ code: "muted", message: "You are muted and cannot send messages right now." });
    }
    await this.requireMember(conversationId, actorId);
    const peer = await this.repo.directPeer(conversationId, actorId);
    if (peer) await this.requireNotBlocked(actorId, [peer]);
    const text = dto.text.trim();
    if (!text) throw new BadRequestException({ code: "empty_message", message: "Write something first." });
    const message = await this.repo.createMessage({ conversationId, senderId: actorId, text });
    return { id: message.id, senderId: message.senderId, text: fixTanween(message.text), createdAt: message.createdAt };
  }

  async markRead(actorId: string, conversationId: string): Promise<void> {
    await this.requireMember(conversationId, actorId);
    await this.repo.markRead(conversationId, actorId);
  }

  async leave(actorId: string, conversationId: string): Promise<void> {
    await this.requireMember(conversationId, actorId);
    await this.repo.leave(conversationId, actorId);
  }

  /** The person who started a group can add people to it. */
  async addMembers(actorId: string, conversationId: string, dto: AddMembersDto) {
    await this.requireMember(conversationId, actorId);
    const conversation = await this.repo.findConversation(conversationId);
    if (!conversation?.isGroup) throw new BadRequestException({ code: "not_a_group", message: "People can only be added to a group." });
    if (conversation.createdById !== actorId) throw new ForbiddenException({ code: "insufficient_permissions", message: "Only the person who started the group can add people." });

    const usernames = [...new Set(dto.usernames.map(cleanUsername).filter(Boolean))];
    const found = await this.repo.findPeople({ usernames });
    const missing = usernames.filter((name) => !found.some((p) => p.username === name));
    if (missing.length > 0) throw new NotFoundException({ code: "user_not_found", message: `No account: ${missing.join(", ")}` });
    const newcomers = found.filter((p) => !conversation.members.some((m) => m.userId === p.id));
    if (conversation.members.length + newcomers.length > MAX_OTHER_MEMBERS + 1) {
      throw new BadRequestException({ code: "too_many_members", message: `A chat has at most ${MAX_OTHER_MEMBERS + 1} people.` });
    }
    await this.requireNotBlocked(actorId, newcomers.map((p) => p.id));
    await this.repo.addMembers(conversationId, newcomers.map((p) => p.id));
    return this.summary(conversationId, actorId);
  }

  /** Takes a message the caller wrote back: it disappears for everyone in the conversation. Nobody deletes another person's. */
  async deleteMessage(actorId: string, conversationId: string, messageId: string): Promise<void> {
    await this.requireMember(conversationId, actorId);
    const message = await this.repo.findMessage(messageId);
    if (!message || message.conversationId !== conversationId) throw new NotFoundException({ code: "message_not_found", message: "This message does not exist." });
    if (message.senderId !== actorId) throw new ForbiddenException({ code: "insufficient_permissions", message: "You can only delete your own messages." });
    await this.repo.deleteMessage(messageId);
  }

  // ---- blocking ------------------------------------------------------------

  async blocked(actorId: string) {
    return { items: (await this.repo.listBlocked(actorId)).map((row) => ({ ...toPerson(row.blocked), blockedAt: row.createdAt })) };
  }

  async block(actorId: string, userId: string): Promise<void> {
    await this.requireActor(actorId);
    if (userId === actorId) throw new BadRequestException({ code: "cannot_block_self", message: "You cannot block yourself." });
    if ((await this.repo.findPeople({ ids: [userId] })).length === 0) throw new NotFoundException({ code: "user_not_found", message: "No such account." });
    await this.repo.addBlock(actorId, userId);
  }

  async unblock(actorId: string, userId: string): Promise<void> {
    await this.repo.removeBlock(actorId, userId);
  }

  /** The same refusal whichever of the two made the block, so a blocked person is not told who blocked them. */
  private async requireNotBlocked(actorId: string, userIds: string[]) {
    if ((await this.repo.blockedAmong(actorId, userIds)).length > 0) {
      throw new ForbiddenException({ code: "cannot_message", message: "You cannot message this person." });
    }
  }

  private async summary(conversationId: string, actorId: string) {
    const [row, unread] = await Promise.all([this.repo.findConversation(conversationId), this.repo.unreadByConversation(actorId)]);
    if (!row) throw new NotFoundException({ code: "conversation_not_found", message: "This conversation does not exist." });
    return this.toConversation(row, unread.get(conversationId) ?? 0);
  }

  private toConversation(
    row: {
      id: string;
      title: string | null;
      isGroup: boolean;
      createdById: string | null;
      lastMessageAt: Date;
      members: { user: PersonRow }[];
      messages: { id: string; senderId: string | null; text: string; createdAt: Date }[];
    },
    unread: number
  ) {
    const last = row.messages[0];
    return {
      id: row.id,
      title: fixTanween(row.title),
      isGroup: row.isGroup,
      createdById: row.createdById,
      members: row.members.map((m) => toPerson(m.user)),
      lastMessage: last ? { id: last.id, senderId: last.senderId, text: fixTanween(last.text), createdAt: last.createdAt } : null,
      unreadCount: unread,
      lastMessageAt: row.lastMessageAt,
    };
  }

  private async requireActor(actorId: string) {
    const actor = await this.repo.findActor(actorId);
    if (!actor) throw new NotFoundException({ code: "user_not_found", message: "Account no longer exists." });
    if (isEffectivelyBanned(actor)) throw new ForbiddenException({ code: "account_banned", message: "This account has been banned." });
    return actor;
  }

  /** 404 rather than 403 for a conversation the caller is not in: whether it exists is not theirs to learn. */
  private async requireMember(conversationId: string, actorId: string) {
    const member = await this.repo.membership(conversationId, actorId);
    if (!member) throw new NotFoundException({ code: "conversation_not_found", message: "This conversation does not exist." });
    return member;
  }
}
