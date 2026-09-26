/** The member's chats, from the browser, through the site's own API. Everything lives on the server: nothing here is kept in the browser. */

export interface Person {
  id: string;
  username: string;
  displayName: string;
  avatarVersion: string | null;
}

export interface ChatMessage {
  id: string;
  senderId: string | null;
  text: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  isGroup: boolean;
  createdById: string | null;
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
  conversation_not_found: "هذه المحادثة غير موجودة.",
  account_banned: "هذا الحساب محظور.",
  not_a_group: "يمكن إضافة الأشخاص إلى المجموعات فقط.",
  insufficient_permissions: "لا تملك صلاحية لهذا الإجراء.",
};

async function call<T>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
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
  send: (id: string, text: string) => call<ChatMessage>(`/api/conversations/${encodeURIComponent(id)}/messages`, "POST", { text }),
  markRead: (id: string) => call<void>(`/api/conversations/${encodeURIComponent(id)}/read`, "POST", {}),
  addMembers: (id: string, usernames: string[]) => call<Conversation>(`/api/conversations/${encodeURIComponent(id)}/members`, "POST", { usernames }),
  leave: (id: string) => call<void>(`/api/conversations/${encodeURIComponent(id)}/members/me`, "DELETE"),
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

export const MESSAGES_CHANGED = "lunex:messages-changed";
