import type { AttachmentInfo } from "@/lib/attachments-api";

/** The member's chats, from the browser, through the site's own API. Everything lives on the server: nothing here is kept in the browser. */

export interface Person {
  id: string;
  username: string;
  displayName: string;
  avatarVersion: string | null;
  /** In a group: the member's standing (its owner is who started it). */
  role?: "owner" | "admin" | "member";
}

export interface ChatMessage {
  id: string;
  senderId: string | null;
  text: string;
  /** The pictures that go with the message, in order (not on the chat list's "newest message", which only says how many: `imageCount`). */
  images?: AttachmentInfo[];
  imageCount?: number;
  createdAt: string;
  /** Set once the writer changed the text afterwards. */
  editedAt?: string | null;
}

export interface BlockedPerson extends Person {
  blockedAt: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  isGroup: boolean;
  createdById: string | null;
  /** When a group's picture last changed (part of its address, so a new picture is a new address); null without one. */
  photoVersion?: string | null;
  members: Person[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
  lastMessageAt: string;
}

export type ApiResult<T> = { ok: true; body: T } | { ok: false; message: string; status: number };

const MESSAGES: Record<string, string> = {
  user_not_found: "لا يوجد حساب بهذا الاسم.",
  no_recipients: "اختر شخصًا آخر على الأقل.",
  too_many_members: "الحد الأقصى للمحادثة 20 شخصًا.",
  muted: "أنت مكتوم مؤقتًا ولا يمكنك إرسال رسائل الآن.",
  edit_window_closed: "يمكن تعديل الرسالة خلال يوم واحد من إرسالها فقط.",
  conversation_not_found: "هذه المحادثة غير موجودة.",
  account_banned: "هذا الحساب محظور.",
  not_a_group: "يمكن إضافة الأشخاص إلى المجموعات فقط.",
  insufficient_permissions: "لا تملك صلاحية لهذا الإجراء.",
  cannot_message: "لا يمكنك مراسلة هذا الشخص.",
  cannot_block_self: "لا يمكنك حظر نفسك.",
  message_not_found: "هذه الرسالة غير موجودة.",
  empty_message: "اكتب شيئًا أو أرفق صورة أولًا.",
  invalid_image: "تعذرت قراءة هذا الملف كصورة.",
  no_file: "اختر صورة أولًا.",
  use_leave: "لمغادرة المجموعة استخدم زر المغادرة.",
  member_not_found: "هذا الشخص ليس في المجموعة.",
  cannot_change_owner: "لا يمكن تغيير دور مالك المجموعة.",
  invalid_attachment: "إحدى الصور لم تعد متاحة. أضفها من جديد.",
  too_many_images: "الحد الأقصى 10 صور في الرسالة.",
};

async function call<T>(path: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method,
      cache: "no-store",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (res.status === 204) return { ok: true, body: undefined as T };
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const code = (json as { code?: string } | null)?.code;
      return { ok: false, status: res.status, message: (code && MESSAGES[code]) || "فشلت العملية." };
    }
    return { ok: true, body: json as T };
  } catch {
    return { ok: false, status: 0, message: "تعذر الاتصال بالخادم." };
  }
}

async function uploadGroupPhoto(id: string, file: File): Promise<ApiResult<Conversation>> {
  try {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/conversations/${encodeURIComponent(id)}/photo`, { method: "PUT", body: form, cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const code = (json as { code?: string } | null)?.code;
      return { ok: false, status: res.status, message: (code && MESSAGES[code]) || "فشلت العملية." };
    }
    return { ok: true, body: json as Conversation };
  } catch {
    return { ok: false, status: 0, message: "تعذر الاتصال بالخادم." };
  }
}

export const chatApi = {
  list: () => call<{ conversations: Conversation[] }>("/api/conversations", "GET"),
  unread: () => call<{ unreadConversations: number; unreadMessages: number }>("/api/conversations/unread-count", "GET"),
  /** One person (by id or username) opens the direct chat with them; two or more make a group. */
  create: (input: { userIds?: string[]; usernames?: string[]; title?: string }) => call<Conversation>("/api/conversations", "POST", input),
  messages: (id: string, params: { before?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.before) query.set("before", params.before);
    if (params.limit) query.set("limit", String(params.limit));
    return call<{ items: ChatMessage[]; hasMore: boolean }>(`/api/conversations/${encodeURIComponent(id)}/messages${query.toString() ? `?${query}` : ""}`, "GET");
  },
  send: (id: string, text: string, imageIds: string[] = []) =>
    call<ChatMessage>(`/api/conversations/${encodeURIComponent(id)}/messages`, "POST", { text, ...(imageIds.length > 0 ? { imageIds } : {}) }),
  markRead: (id: string) => call<void>(`/api/conversations/${encodeURIComponent(id)}/read`, "POST", {}),
  addMembers: (id: string, usernames: string[]) => call<Conversation>(`/api/conversations/${encodeURIComponent(id)}/members`, "POST", { usernames }),
  leave: (id: string) => call<void>(`/api/conversations/${encodeURIComponent(id)}/members/me`, "DELETE"),
  // ---- managing a group (its owner and admins) ----
  /** The name of a group; empty takes it off. */
  updateGroup: (id: string, title: string) => call<Conversation>(`/api/conversations/${encodeURIComponent(id)}`, "PATCH", { title }),
  /** A picture chosen from the device (cropped to a square on the server). */
  setGroupPhoto: (id: string, file: File) => uploadGroupPhoto(id, file),
  removeGroupPhoto: (id: string) => call<Conversation>(`/api/conversations/${encodeURIComponent(id)}/photo`, "DELETE"),
  removeMember: (id: string, userId: string) => call<Conversation>(`/api/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, "DELETE"),
  /** Makes a member an admin or takes admin off (the owner only). */
  setMemberRole: (id: string, userId: string, role: "admin" | "member") =>
    call<Conversation>(`/api/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, "PATCH", { role }),
  /** Takes back a message the member wrote: it disappears for everyone in the chat. */
  editMessage: (id: string, messageId: string, text: string) =>
    call<ChatMessage>(`/api/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`, "PATCH", { text }),

  deleteMessage: (id: string, messageId: string) => call<void>(`/api/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`, "DELETE"),
  /** The people the member has blocked: neither can then message the other. */
  blocked: () => call<{ items: BlockedPerson[] }>("/api/conversations/blocks", "GET"),
  block: (userId: string) => call<void>(`/api/conversations/blocks/${encodeURIComponent(userId)}`, "PUT"),
  unblock: (userId: string) => call<void>(`/api/conversations/blocks/${encodeURIComponent(userId)}`, "DELETE"),
};

export const searchPeople = (q: string) => call<Person[]>(`/api/users/search?q=${encodeURIComponent(q)}&limit=12`, "GET");

/** The name a chat goes by: the other person in a direct chat; the title of a group, or the members' names when it has none. */
export function conversationName(conversation: Conversation, myId: string | null): string {
  const others = conversation.members.filter((m) => m.id !== myId);
  if (!conversation.isGroup) return others[0]?.displayName ?? "محادثة";
  if (conversation.title) return conversation.title;
  const names = others.slice(0, 3).map((m) => m.displayName);
  return names.join("، ") + (others.length > 3 ? ` +${others.length - 3}` : "");
}

/** What the chat list shows for the newest message: the words, or that there is a picture. */
export function previewOf(message: Pick<ChatMessage, "text" | "imageCount">): string {
  const pictures = message.imageCount ?? 0;
  if (pictures === 0) return message.text;
  const label = pictures === 1 ? "📷" : `📷 ${pictures}`;
  return message.text ? `${label} ${message.text}` : pictures === 1 ? "📷 صورة" : `📷 ${pictures} صور`;
}

export const MESSAGES_CHANGED = "lunex:messages-changed";
