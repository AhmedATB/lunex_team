import type { Comment } from "@/lib/types";
import { useProgress } from "@/store/progress";
import { formatDateTime } from "@/lib/use-mute-status";

export type Reaction = "like" | "dislike";

export interface CommentAuthor {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarVersion: string | null;
}

/** GET /v1/comments — one comment as the server describes it. */
export interface ServerComment {
  id: string;
  seriesId: string;
  content: string;
  isSpoiler: boolean;
  isPinned: boolean;
  createdAt: string;
  editedAt: string | null;
  likes: number;
  dislikes: number;
  myReaction: Reaction | null;
  author: CommentAuthor;
}

/**
 * A server comment in the shape the UI already renders (`Comment`), plus what a
 * mock comment doesn't have: the author's identity (the mock user table doesn't
 * know real accounts) and the viewer's own reaction. `server: true` is what
 * routes an action to the API instead of the device-local store.
 */
export type CommentRow = Comment & {
  server?: true;
  author?: CommentAuthor;
  myReaction?: Reaction | null;
};

export function serverToRow(c: ServerComment): CommentRow {
  return {
    id: c.id,
    seriesId: c.seriesId,
    userId: c.author.id,
    content: c.content,
    likes: c.likes,
    dislikes: c.dislikes,
    createdAt: c.createdAt,
    isPinned: c.isPinned,
    isSpoiler: c.isSpoiler,
    editedAt: c.editedAt ?? undefined,
    server: true,
    author: c.author,
    myReaction: c.myReaction,
  };
}

/** The fields the UI reads off a user, for an author the mock table has never heard of. */
export function authorAsUser(a: CommentAuthor) {
  return { id: a.id, username: a.username, displayName: a.displayName, avatarSeed: a.id, avatarVersion: a.avatarVersion };
}

export async function fetchSeriesComments(seriesId: string): Promise<CommentRow[] | null> {
  try {
    const res = await fetch(`/api/comments?seriesId=${encodeURIComponent(seriesId)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body: { comments: ServerComment[] } = await res.json();
    return body.comments.map(serverToRow);
  } catch {
    return null;
  }
}

export async function fetchLatestComments(limit: number): Promise<CommentRow[] | null> {
  try {
    const res = await fetch(`/api/comments/latest?limit=${limit}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body: { comments: ServerComment[] } = await res.json();
    return body.comments.map(serverToRow);
  } catch {
    return null;
  }
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
}

/** Any comment endpoint; a network failure comes back as `{ ok: false, status: 0 }` instead of throwing. */
export async function commentApi<T = unknown>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/comments${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const parsed = res.status === 204 ? null : ((await res.json().catch(() => null)) as T | null);
    // A posted comment earns experience on the server; look again so it is shown (and announced) at once.
    if (res.ok && method === "POST" && path === "") void useProgress.getState().refresh();
    return { ok: res.ok, status: res.status, body: parsed };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

const ERRORS: Record<string, string> = {
  account_banned: "هذا الحساب محظور.",
  comment_rate_limited: "تكتب بسرعة كبيرة. انتظر قليلاً ثم حاول مجدداً.",
  duplicate_comment: "نشرت هذا التعليق قبل قليل.",
  empty_comment: "اكتب تعليقاً أولاً.",
  comment_too_long: "التعليق أطول من 2000 حرف.",
  not_comment_author: "لا يمكنك تعديل تعليق غيرك.",
  insufficient_permissions: "لا تملك صلاحية لهذا الإجراء.",
  cannot_moderate_higher_rank: "لا يمكنك حذف تعليق من رتبته أعلى منك.",
  comment_not_found: "هذا التعليق لم يعد موجوداً.",
  cannot_react_own: "لا يمكنك التفاعل مع تعليقك.",
  cannot_report_own: "لا يمكنك الإبلاغ عن تعليقك.",
};

/** Arabic text for a failed comment call; a timeout says until when (the backend puts the end time in its message). */
export function commentErrorMessage(result: ApiResult<unknown>): string {
  const { code, message } = (result.body ?? {}) as { code?: string; message?: string };
  if (code === "account_muted") {
    const until = /until (\S+?)\.?$/.exec(message ?? "")?.[1];
    const date = until ? new Date(until) : null;
    return date && !Number.isNaN(date.getTime())
      ? `أنت في تايم أوت من الإدارة ولا يمكنك التعليق حتى ${formatDateTime(date)}.`
      : "أنت في تايم أوت من الإدارة ولا يمكنك التعليق حالياً.";
  }
  if (code && ERRORS[code]) return ERRORS[code];
  if (result.status === 401) return "سجّل الدخول أولاً.";
  if (result.status === 0) return "تعذر الاتصال بالخادم، حاول مرة أخرى.";
  if (result.status === 429) return "محاولات كثيرة، انتظر قليلاً.";
  return "تعذر تنفيذ الإجراء، حاول مرة أخرى.";
}
