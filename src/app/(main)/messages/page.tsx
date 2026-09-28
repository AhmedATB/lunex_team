"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Ban, Keyboard, LogOut, Loader2, MessageCircle, Pencil, Plus, Send, Smile, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
import { useSession } from "@/store/session";
import { chatApi, conversationName, MESSAGES_CHANGED, previewOf, type BlockedPerson, type ChatMessage, type Conversation, type Person } from "@/lib/messages-api";
import { resolveAvatarUrl, cn } from "@/lib/utils";
import { useMuteStatus } from "@/lib/use-mute-status";
import { MuteNotice } from "@/components/moderation/mute-notice";
import { UserPicker } from "@/components/messages/user-picker";
import { EmojiPanel } from "@/components/messages/emoji-panel";
import { PictureButton, PictureGrid, PicturePreviews, usePictures } from "@/components/shared/pictures";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GridPageSkeleton } from "@/components/shared/skeletons";

const LIST_POLL_MS = 10_000;
const THREAD_POLL_MS = 4_000;
/** The server's limit for one message. */
const MAX_MESSAGE = 2000;
/** Pictures that can go with one message. */
const MAX_PICTURES = 10;
/** The message box grows with what is typed, up to about five lines, then scrolls inside itself. */
const INPUT_MAX_PX = 144;
/** The phone's keyboard covers this much or more of the screen; below it, the browser bar coming and going is not the keyboard. */
const KEYBOARD_MIN_PX = 120;

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageInner />
    </Suspense>
  );
}

function PersonAvatar({ person, size }: { person: Person; size: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/30" style={{ width: size, height: size }}>
      <Image src={resolveAvatarUrl(person.id, person.avatarVersion, person.id)} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
    </span>
  );
}

function ChatAvatar({ conversation, myId, size }: { conversation: Conversation; myId: string | null; size: number }) {
  const other = conversation.members.find((m) => m.id !== myId);
  if (conversation.isGroup || !other) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-primary-200 ring-2 ring-primary-500/30" style={{ width: size, height: size }}>
        <Users className="h-1/2 w-1/2" aria-hidden />
      </span>
    );
  }
  return <PersonAvatar person={other} size={size} />;
}

const RUN_GAP_MS = 5 * 60_000;
const DAY_MS = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
/** How long after sending a message can still be edited (the server enforces it; this only decides whether to offer the button). */
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const clock = (iso: string) => new Intl.DateTimeFormat("ar", { timeStyle: "short" }).format(new Date(iso));

/** The time beside a chat in the list: the clock today, "أمس" yesterday, the date before that. */
function listTime(iso: string): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  if (days <= 0) return clock(iso);
  if (days === 1) return "أمس";
  return new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" }).format(date);
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(date);
}

interface Row {
  message: ChatMessage;
  mine: boolean;
  sender: Person | undefined;
  /** First of a run of messages by the same person (the name of the sender goes above it in a group). */
  first: boolean;
  /** Last of the run: the sender's picture and the time go beside and under this one. */
  last: boolean;
  /** Set when this message starts a new day. */
  day: string | null;
}

/**
 * Cuts the thread into runs: messages by one person, written close together on the same day, are one run — so three
 * messages in a row show the person's picture once, not three times.
 */
function buildRows(messages: ChatMessage[], myId: string | null, members: Person[]): Row[] {
  const sameRun = (a: ChatMessage | undefined, b: ChatMessage | undefined) =>
    !!a && !!b && a.senderId === b.senderId && new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString() && Math.abs(+new Date(b.createdAt) - +new Date(a.createdAt)) < RUN_GAP_MS;
  return messages.map((message, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    return {
      message,
      mine: message.senderId === myId,
      sender: members.find((p) => p.id === message.senderId),
      first: !sameRun(prev, message),
      last: !sameRun(message, next),
      day: !prev || new Date(prev.createdAt).toDateString() !== new Date(message.createdAt).toDateString() ? dayLabel(message.createdAt) : null,
    };
  });
}

function MessagesPageInner() {
  useEffect(() => {
    document.title = "الرسائل | LUNEX TEAM";
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("to");

  const myId = useSession((s) => s.currentUserId);
  const mute = useMuteStatus();

  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState("");
  /** The message being corrected, and the text as it is being typed. */
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const [emojiOpen, setEmojiOpen] = useState(false);
  /** The pictures being added to the message being written (several can go with one message). */
  const pictures = usePictures(MAX_PICTURES);

  const rootRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  /** Where the caret goes after an emoji is put in. */
  const caretAfter = useRef<number | null>(null);
  /** A phone (touch): Enter starts a new line and the arrow sends; on a computer Enter sends and Shift+Enter starts a new line. */
  const coarsePointer = useRef(false);
  useEffect(() => {
    coarsePointer.current = window.matchMedia("(pointer: coarse)").matches;
  }, []);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);
  const rows = useMemo(() => buildRows(messages, myId, active?.members ?? []), [messages, myId, active]);
  // The other person of a direct chat, and whether the member has blocked them.
  const peer = active && !active.isGroup ? active.members.find((m) => m.id !== myId) ?? null : null;
  const peerBlocked = !!peer && blocked.some((b) => b.id === peer.id);

  const refreshBlocked = useCallback(async () => {
    const result = await chatApi.blocked();
    if (result.ok) setBlocked(result.body.items);
  }, []);
  useEffect(() => {
    if (myId) void refreshBlocked();
  }, [myId, refreshBlocked]);

  const refreshList = useCallback(async () => {
    const result = await chatApi.list();
    if (result.ok) setConversations(result.body.conversations);
    setListLoaded(true);
    return result.ok ? result.body.conversations : null;
  }, []);

  // The list on load and every few seconds while the tab is showing.
  useEffect(() => {
    if (!myId) return;
    void refreshList();
    const timer = setInterval(() => document.visibilityState === "visible" && void refreshList(), LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [myId, refreshList]);

  // ?to=<account> (a profile's "message" button) opens or starts the chat with that account.
  useEffect(() => {
    if (!myId || !targetUserId) return;
    let cancelled = false;
    (async () => {
      const result = await chatApi.create({ userIds: [targetUserId] });
      if (cancelled) return;
      if (result.ok) {
        setActiveId(result.body.id);
        await refreshList();
      } else {
        setError(result.message);
      }
      router.replace("/messages");
    })();
    return () => {
      cancelled = true;
    };
  }, [myId, targetUserId, refreshList, router]);

  const markRead = useCallback(async (id: string) => {
    setConversations((list) => list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    await chatApi.markRead(id);
    window.dispatchEvent(new Event(MESSAGES_CHANGED));
  }, []);

  // Opening a chat loads its newest messages; while it is open, new ones are fetched every few seconds.
  const loadNewest = useCallback(
    async (id: string, initial: boolean) => {
      const result = await chatApi.messages(id, { limit: 40 });
      if (!result.ok) return;
      setMessages((current) => {
        if (initial) return result.body.items;
        // The newest page is the authority for its own time window: a message that is gone from it was deleted, so it goes from the screen too.
        const items = result.body.items;
        const ids = new Set(items.map((m) => m.id));
        const floor = result.body.hasMore ? items[0]?.createdAt : undefined;
        const kept = current.filter((m) => ids.has(m.id) || (floor !== undefined && m.createdAt < floor));
        const known = new Set(kept.map((m) => m.id));
        const fresh = items.filter((m) => !known.has(m.id));
        // A message the writer corrected since it was fetched comes back with its new text: take the server's version.
        const latest = new Map(items.map((m) => [m.id, m]));
        let corrected = false;
        const merged = kept.map((m) => {
          const now = latest.get(m.id);
          if (now && (now.text !== m.text || now.editedAt !== m.editedAt)) {
            corrected = true;
            return now;
          }
          return m;
        });
        return fresh.length || corrected || kept.length !== current.length ? [...merged, ...fresh] : current;
      });
      if (initial) setHasOlder(result.body.hasMore);
      if (result.body.items.length > 0) {
        const last = result.body.items[result.body.items.length - 1];
        if (last.senderId !== myId) void markRead(id);
      }
    },
    [markRead, myId]
  );

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setThreadLoading(true);
    setMessages([]);
    stickToBottom.current = true;
    void loadNewest(activeId, true).finally(() => setThreadLoading(false));
    const timer = setInterval(() => document.visibilityState === "visible" && void loadNewest(activeId, false), THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [activeId, loadNewest]);

  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, activeId]);

  // On a phone the chat is the visible part of the screen above the keyboard: the box is as tall as what the keyboard leaves, so the
  // message box sits right on top of it. (`--vvh`/`--vvt` are read by the root's classes; nothing re-renders when they change.)
  const boxReady = ready && !!myId;
  useEffect(() => {
    const el = rootRef.current;
    const viewport = window.visualViewport;
    if (!boxReady || !el || !viewport) return;
    const narrow = window.matchMedia("(max-width: 1023px)");
    const html = document.documentElement;
    const apply = () => {
      if (!narrow.matches) {
        el.style.removeProperty("--vvh");
        el.style.removeProperty("--vvt");
        el.style.removeProperty("--sab");
        html.style.overflow = "";
        return;
      }
      html.style.overflow = "hidden"; // the page behind does not scroll under the chat
      el.style.setProperty("--vvh", `${viewport.height}px`);
      el.style.setProperty("--vvt", `${viewport.offsetTop}px`);
      // Room for the home bar only while the keyboard is down; over the keyboard there is no bar to clear.
      el.style.setProperty("--sab", window.innerHeight - viewport.height > KEYBOARD_MIN_PX ? "0px" : "env(safe-area-inset-bottom, 0px)");
      const list = scroller.current;
      if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
    };
    apply();
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    narrow.addEventListener("change", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      narrow.removeEventListener("change", apply);
      html.style.overflow = "";
    };
  }, [boxReady]);

  // The message box grows with the text (to a limit), and the caret goes after a picked emoji.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), INPUT_MAX_PX)}px`;
    if (caretAfter.current !== null) {
      el.setSelectionRange(caretAfter.current, caretAfter.current);
      caretAfter.current = null;
    }
    const list = scroller.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [draft, activeId, emojiOpen]);

  // Switching between the emoji drawer and the keyboard: the box keeps its caret, and only asks for the phone's keyboard when the drawer is shut.
  const drawerRan = useRef(false);
  useEffect(() => {
    if (!drawerRan.current) {
      drawerRan.current = true;
      return;
    }
    const el = inputRef.current;
    if (!el) return;
    el.blur();
    el.focus({ preventScroll: true });
  }, [emojiOpen]);

  // Opening a chat: on a computer the cursor is in the box already; on a phone the keyboard waits until it is asked for.
  useEffect(() => {
    setEmojiOpen(false);
    if (activeId && !coarsePointer.current) inputRef.current?.focus({ preventScroll: true });
  }, [activeId]);

  async function loadOlder() {
    if (!activeId || messages.length === 0) return;
    const result = await chatApi.messages(activeId, { before: messages[0].createdAt, limit: 40 });
    if (result.ok) {
      stickToBottom.current = false;
      setMessages((current) => [...result.body.items, ...current]);
      setHasOlder(result.body.hasMore);
    }
  }

  async function submit() {
    const text = draft.trim();
    if (!activeId || (!text && pictures.ids.length === 0) || pictures.uploading || sending || mute.muted) return;
    setSending(true);
    setError("");
    const result = await chatApi.send(activeId, text, pictures.ids);
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft("");
    pictures.clear();
    stickToBottom.current = true;
    setMessages((current) => (current.some((m) => m.id === result.body.id) ? current : [...current, result.body]));
    void refreshList();
    // The keyboard stays up for the next message, as in any chat app.
    if (!emojiOpen) inputRef.current?.focus({ preventScroll: true });
  }

  function pickEmoji(emoji: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    if (next.length > MAX_MESSAGE) return;
    caretAfter.current = start + emoji.length;
    setDraft(next);
  }

  async function saveEdit() {
    if (!activeId || !editing) return;
    const text = editing.text.trim();
    if (!text) return;
    const result = await chatApi.editMessage(activeId, editing.id, text);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setMessages((current) => current.map((m) => (m.id === result.body.id ? result.body : m)));
    setEditing(null);
    void refreshList();
  }

  async function removeMessage(message: ChatMessage) {
    if (!activeId || !window.confirm("حذف هذه الرسالة؟ ستختفي عند كل من في المحادثة.")) return;
    const result = await chatApi.deleteMessage(activeId, message.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    setMessages((current) => current.filter((m) => m.id !== message.id));
    void refreshList();
  }

  async function toggleBlock(person: Person) {
    const blockedNow = blocked.some((b) => b.id === person.id);
    if (!blockedNow && !window.confirm(`حظر ${person.displayName}؟ لن يستطيع أحدكما مراسلة الآخر حتى تلغي الحظر.`)) return;
    const result = blockedNow ? await chatApi.unblock(person.id) : await chatApi.block(person.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError("");
    await refreshBlocked();
  }

  async function leave() {
    if (!activeId) return;
    const result = await chatApi.leave(activeId);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setActiveId(null);
    void refreshList();
  }

  if (!ready) return <GridPageSkeleton />;
  if (!myId) return <div className="container py-16 text-center text-lunex-gray">يجب تسجيل الدخول لعرض رسائلك.</div>;

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 top-[var(--vvt,0px)] z-[45] flex h-[var(--vvh,100dvh)] flex-col overflow-hidden bg-background lg:static lg:z-auto lg:block lg:h-auto lg:overflow-visible lg:bg-transparent lg:container lg:py-6"
    >
      {/* A wide screen keeps the page's own title row; on a phone the bars of the list and of the chat take its place. */}
      <div className="mb-4 hidden items-center justify-between gap-3 lg:flex">
        <h1 className="section-title font-display text-2xl font-bold text-white">الرسائل</h1>
        <div className="flex items-center gap-2">
          {blocked.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setBlockedOpen(true)}>
              <Ban className="h-4 w-4" /> المحظورون ({blocked.length})
            </Button>
          )}
          <Button size="sm" onClick={() => setNewChatOpen(true)}>
            <Plus className="h-4 w-4" /> محادثة جديدة
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[320px_1fr] lg:gap-4">
        {/* The list: on a phone it is the whole screen until a chat is opened. */}
        <div className={cn("flex min-h-0 flex-1 flex-col lg:panel lg:h-[72vh] lg:flex-none", active && "hidden lg:flex")}>
          <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-background/95 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
            <Button asChild variant="ghost" size="icon" aria-label="الرئيسية">
              <Link href="/">
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="flex-1 font-display text-lg font-bold text-white">الرسائل</h1>
            {blocked.length > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setBlockedOpen(true)} aria-label={`المحظورون (${blocked.length})`}>
                <Ban className="h-5 w-5" />
              </Button>
            )}
            <Button size="icon" onClick={() => setNewChatOpen(true)} aria-label="محادثة جديدة">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {!listLoaded ? (
              <div className="flex justify-center p-8 text-lunex-gray"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : conversations.length === 0 ? (
              <div className="space-y-3 p-6 text-center text-sm text-lunex-gray">
                <p>لا توجد محادثات بعد.</p>
                <Button size="sm" variant="secondary" onClick={() => setNewChatOpen(true)}>ابدأ محادثة</Button>
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-start transition-colors hover:bg-primary-600/10 active:bg-primary-600/15",
                    activeId === c.id && "bg-primary-600/15"
                  )}
                >
                  <ChatAvatar conversation={c} myId={myId} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-bold text-white">{conversationName(c, myId)}</p>
                      {c.lastMessage && <span className="shrink-0 text-[11px] text-lunex-gray">{listTime(c.lastMessageAt)}</span>}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-lunex-gray">{c.lastMessage ? previewOf(c.lastMessage) : "لا توجد رسائل بعد"}</p>
                      {c.unreadCount > 0 && (
                        <span className="flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold leading-5 text-white">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden lg:panel lg:h-[72vh] lg:flex-none", !active && "hidden lg:flex")}>
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-lunex-gray">
              <MessageCircle className="h-10 w-10" />
              <p className="text-sm">اختر محادثة أو ابدأ واحدة جديدة.</p>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-background/95 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:gap-2 lg:bg-transparent lg:p-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setActiveId(null)} aria-label="رجوع">
                  <ArrowRight className="h-5 w-5" />
                </Button>
                {peer ? (
                  <Link
                    href={`/profile/${encodeURIComponent(peer.username)}`}
                    aria-label={`الملف الشخصي لـ ${peer.displayName}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 transition-colors hover:bg-white/5"
                  >
                    <ChatAvatar conversation={active} myId={myId} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-bold text-white">{conversationName(active, myId)}</p>
                      <p className="truncate text-xs text-lunex-gray">
                        <bdi dir="ltr">@{peer.username}</bdi>
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-1">
                    <ChatAvatar conversation={active} myId={myId} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-bold text-white">{conversationName(active, myId)}</p>
                      {active.isGroup && <p className="truncate text-xs text-lunex-gray">{active.members.map((m) => m.displayName).join("، ")}</p>}
                    </div>
                  </div>
                )}
                {peer && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void toggleBlock(peer)}
                    aria-label={peerBlocked ? "إلغاء الحظر" : "حظر"}
                    title={peerBlocked ? "إلغاء الحظر" : "حظر"}
                    className={peerBlocked ? "text-primary-300" : "text-red-400 hover:bg-red-500/10"}
                  >
                    {peerBlocked ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                  </Button>
                )}
                {active.isGroup && active.createdById === myId && (
                  <Button variant="ghost" size="icon" onClick={() => setAddOpen(true)} aria-label="إضافة أشخاص">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
                {active.isGroup && (
                  <Button variant="ghost" size="icon" onClick={leave} aria-label="مغادرة المجموعة" className="text-red-400 hover:bg-red-500/10">
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div
                ref={scroller}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
              >
                {hasOlder && (
                  <div className="flex justify-center">
                    <Button variant="ghost" size="sm" onClick={loadOlder}>رسائل أقدم</Button>
                  </div>
                )}
                {threadLoading && messages.length === 0 ? (
                  <div className="flex justify-center py-10 text-lunex-gray"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-lunex-gray">ابدأ المحادثة بإرسال أول رسالة.</p>
                ) : (
                  rows.map((row) => (
                    <div key={row.message.id}>
                      {row.day && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-white/5 px-3 py-0.5 text-[11px] text-lunex-gray">{row.day}</span>
                        </div>
                      )}
                      <div className={cn("group flex items-end gap-2", row.mine ? "justify-end" : "justify-start", row.first ? "mt-2" : "mt-0.5")}>
                        {row.mine && (
                          <div className="mb-1 flex items-center">
                            {Date.now() - new Date(row.message.createdAt).getTime() < EDIT_WINDOW_MS && (
                              <button
                                type="button"
                                onClick={() => setEditing({ id: row.message.id, text: row.message.text })}
                                aria-label="تعديل الرسالة"
                                className="rounded-full p-1.5 text-lunex-gray opacity-0 transition hover:text-white focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void removeMessage(row.message)}
                              aria-label="حذف الرسالة"
                              className="rounded-full p-1.5 text-lunex-gray opacity-0 transition hover:text-red-400 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {!row.mine && (
                          <div className="w-7 shrink-0" aria-hidden={!row.last}>
                            {row.last && row.sender && (
                              <Link href={`/profile/${encodeURIComponent(row.sender.username)}`} aria-label={`الملف الشخصي لـ ${row.sender.displayName}`} className="block rounded-full">
                                <PersonAvatar person={row.sender} size={28} />
                              </Link>
                            )}
                          </div>
                        )}
                        <div className={cn("max-w-[82%] rounded-2xl px-3 py-1.5 text-sm", row.mine ? "bg-lunex-gradient text-white" : "bg-white/5 text-lunex-gray")}>
                          {row.first && !row.mine && active.isGroup && row.sender && (
                            <p className="mb-0.5 text-[11px] font-semibold text-primary-300">{row.sender.displayName}</p>
                          )}
                          {editing?.id === row.message.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                value={editing.text}
                                onChange={(e) => setEditing({ id: editing.id, text: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") setEditing(null);
                                  if (e.key === "Enter" && !e.shiftKey && !coarsePointer.current) {
                                    e.preventDefault();
                                    void saveEdit();
                                  }
                                }}
                                rows={Math.min(6, Math.max(2, editing.text.split("\n").length))}
                                maxLength={MAX_MESSAGE}
                                autoFocus
                                aria-label="نص الرسالة"
                                className="block w-full min-w-[12rem] resize-none rounded-lg bg-black/25 p-2 text-base text-white outline-none sm:text-sm"
                              />
                              <div className="flex justify-end gap-3 text-xs">
                                <button type="button" onClick={() => setEditing(null)} className="py-1 opacity-80 hover:opacity-100">إلغاء</button>
                                <button type="button" onClick={() => void saveEdit()} disabled={!editing.text.trim()} className="py-1 font-bold disabled:opacity-40">حفظ</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {row.message.images && row.message.images.length > 0 && <PictureGrid images={row.message.images} className={row.message.text ? "mb-1.5" : ""} />}
                              {row.message.text && <p className="whitespace-pre-wrap break-words">{row.message.text}</p>}
                            </>
                          )}
                          {row.last && (
                            <p className="mt-0.5 text-[10px] opacity-70">
                              {clock(row.message.createdAt)}
                              {row.message.editedAt ? " · معدّلة" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="shrink-0 border-t border-white/10 bg-background/95 pb-[var(--sab,0px)] lg:bg-transparent">
                <div className="p-2 sm:p-3">
                  <MuteNotice className="mb-2" />
                  {error && <p className="mb-2 text-xs text-red-400" role="alert">{error}</p>}
                  {peerBlocked && peer ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-sm text-lunex-gray">
                      <span>حظرت {peer.displayName}. ألغِ الحظر إن أردت المراسلة من جديد.</span>
                      <Button size="sm" variant="secondary" onClick={() => void toggleBlock(peer)}>إلغاء الحظر</Button>
                    </div>
                  ) : (
                    <>
                    <PicturePreviews items={pictures.items} onRemove={pictures.remove} className="mb-2" />
                    {pictures.notice && <p className="mb-1 text-xs text-amber-300">{pictures.notice}</p>}
                    {pictures.failed && <p className="mb-1 text-xs text-red-400">تعذر رفع إحدى الصور. أزلها وأعد المحاولة.</p>}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                      }}
                      className="flex items-end gap-1.5"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0 rounded-full"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setEmojiOpen((open) => !open)}
                        aria-label={emojiOpen ? "لوحة المفاتيح" : "الرموز التعبيرية"}
                        aria-pressed={emojiOpen}
                        disabled={mute.muted}
                      >
                        {emojiOpen ? <Keyboard className="h-5 w-5" /> : <Smile className="h-5 w-5" />}
                      </Button>
                      <PictureButton onPick={pictures.add} multiple disabled={mute.muted || !pictures.canAddMore} className="h-11 w-11" />
                      <Textarea
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !coarsePointer.current) {
                            e.preventDefault();
                            void submit();
                          }
                        }}
                        rows={1}
                        placeholder="اكتب رسالتك..."
                        maxLength={MAX_MESSAGE}
                        disabled={mute.muted}
                        autoComplete="off"
                        inputMode={emojiOpen ? "none" : "text"}
                        aria-label="نص الرسالة"
                        className="min-h-[2.75rem] flex-1 resize-none overflow-y-auto rounded-2xl py-[0.6875rem] text-base leading-[1.375rem] sm:text-base"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="h-11 w-11 shrink-0 rounded-full"
                        onMouseDown={(e) => e.preventDefault()}
                        aria-label="إرسال"
                        disabled={(!draft.trim() && pictures.ids.length === 0) || pictures.uploading || pictures.failed || sending || mute.muted}
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </form>
                    </>
                  )}
                </div>
                {emojiOpen && !peerBlocked && <EmojiPanel onPick={pickEmoji} />}
              </div>
            </>
          )}
        </div>
      </div>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        myId={myId}
        onCreated={async (conversation) => {
          setNewChatOpen(false);
          setActiveId(conversation.id);
          await refreshList();
        }}
      />

      <BlockedDialog
        open={blockedOpen}
        onClose={() => setBlockedOpen(false)}
        blocked={blocked}
        onUnblock={async (person) => {
          await toggleBlock(person);
          if (blocked.length <= 1) setBlockedOpen(false);
        }}
      />

      {active && active.isGroup && (
        <AddPeopleDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          conversation={active}
          onAdded={async () => {
            setAddOpen(false);
            await refreshList();
          }}
        />
      )}
    </div>
  );
}

/** The people the member has blocked, each with a way to undo it. */
function BlockedDialog({ open, onClose, blocked, onUnblock }: { open: boolean; onClose: () => void; blocked: BlockedPerson[]; onUnblock: (person: Person) => void | Promise<void> }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>المحظورون</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-lunex-gray">لا يستطيع أحدكما مراسلة الآخر ما دام الحظر قائمًا. لا يُبلَّغ الشخص بأنك حظرته.</p>
        <ul className="space-y-2">
          {blocked.map((person) => (
            <li key={person.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-2.5">
              <PersonAvatar person={person} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{person.displayName}</p>
                <p className="truncate text-xs text-lunex-gray" dir="ltr">@{person.username}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void onUnblock(person)}>إلغاء الحظر</Button>
            </li>
          ))}
          {blocked.length === 0 && <li className="p-4 text-center text-sm text-lunex-gray">لا أحد محظور.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** Pick one person for a direct chat, or several for a group (which can be given a title). */
function NewChatDialog({ open, onClose, myId, onCreated }: { open: boolean; onClose: () => void; myId: string; onCreated: (c: Conversation) => void | Promise<void> }) {
  const [picked, setPicked] = useState<Person[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPicked([]);
      setTitle("");
      setError("");
    }
  }, [open]);

  async function start() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    setError("");
    const result = await chatApi.create({ userIds: picked.map((p) => p.id), ...(picked.length > 1 && title.trim() ? { title: title.trim() } : {}) });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    await onCreated(result.body);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>محادثة جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <UserPicker selected={picked} onChange={setPicked} excludeIds={[myId]} autoFocus />
          {picked.length > 1 && (
            <div className="space-y-1.5">
              <label htmlFor="group-title" className="text-sm text-lunex-gray">اسم المجموعة (اختياري)</label>
              <Input id="group-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="مثال: فريق الترجمة" />
            </div>
          )}
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <Button onClick={start} disabled={picked.length === 0 || busy} className="w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {picked.length > 1 ? `إنشاء مجموعة (${picked.length + 1})` : "بدء المحادثة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddPeopleDialog({ open, onClose, conversation, onAdded }: { open: boolean; onClose: () => void; conversation: Conversation; onAdded: () => void | Promise<void> }) {
  const [picked, setPicked] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPicked([]);
      setError("");
    }
  }, [open]);

  async function add() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    const result = await chatApi.addMembers(conversation.id, picked.map((p) => p.username));
    setBusy(false);
    if (!result.ok) return setError(result.message);
    await onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة أشخاص إلى المجموعة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <UserPicker selected={picked} onChange={setPicked} excludeIds={conversation.members.map((m) => m.id)} autoFocus />
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <Button onClick={add} disabled={picked.length === 0 || busy} className="w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
