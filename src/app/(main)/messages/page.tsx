"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LogOut, Loader2, MessageCircle, Plus, Send, UserPlus, Users } from "lucide-react";
import { useSession } from "@/store/session";
import { chatApi, conversationName, MESSAGES_CHANGED, type ChatMessage, type Conversation, type Person } from "@/lib/messages-api";
import { resolveAvatarUrl, cn, timeAgo } from "@/lib/utils";
import { useMuteStatus } from "@/lib/use-mute-status";
import { MuteNotice } from "@/components/moderation/mute-notice";
import { UserPicker } from "@/components/messages/user-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GridPageSkeleton } from "@/components/shared/skeletons";

const LIST_POLL_MS = 10_000;
const THREAD_POLL_MS = 4_000;

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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

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
        const known = new Set(current.map((m) => m.id));
        const fresh = result.body.items.filter((m) => !known.has(m.id));
        return fresh.length ? [...current, ...fresh] : current;
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

  async function loadOlder() {
    if (!activeId || messages.length === 0) return;
    const result = await chatApi.messages(activeId, { before: messages[0].createdAt, limit: 40 });
    if (result.ok) {
      stickToBottom.current = false;
      setMessages((current) => [...result.body.items, ...current]);
      setHasOlder(result.body.hasMore);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!activeId || !text || sending || mute.muted) return;
    setSending(true);
    setError("");
    const result = await chatApi.send(activeId, text);
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft("");
    stickToBottom.current = true;
    setMessages((current) => (current.some((m) => m.id === result.body.id) ? current : [...current, result.body]));
    void refreshList();
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
    <div className="container py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="section-title font-display text-2xl font-bold text-white">الرسائل</h1>
        <Button size="sm" onClick={() => setNewChatOpen(true)}>
          <Plus className="h-4 w-4" /> محادثة جديدة
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* The list: on a phone it is the whole screen until a chat is opened. */}
        <div className={cn("panel max-h-[72vh] overflow-y-auto", active && "hidden lg:block")}>
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
                  "flex w-full items-center gap-3 border-b border-white/5 p-3 text-start transition-colors hover:bg-primary-600/10",
                  activeId === c.id && "bg-primary-600/15"
                )}
              >
                <ChatAvatar conversation={c} myId={myId} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{conversationName(c, myId)}</p>
                  <p className="truncate text-xs text-lunex-gray">{c.lastMessage ? c.lastMessage.text : "لا توجد رسائل بعد"}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[11px] font-bold leading-5 text-white">
                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className={cn("panel flex min-h-[60vh] flex-col", !active && "hidden lg:flex")}>
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-lunex-gray">
              <MessageCircle className="h-10 w-10" />
              <p className="text-sm">اختر محادثة أو ابدأ واحدة جديدة.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/10 p-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setActiveId(null)} aria-label="رجوع">
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <ChatAvatar conversation={active} myId={myId} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold text-white">{conversationName(active, myId)}</p>
                  {active.isGroup && <p className="truncate text-xs text-lunex-gray">{active.members.map((m) => m.displayName).join("، ")}</p>}
                </div>
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
                className="max-h-[52vh] flex-1 space-y-2 overflow-y-auto p-4"
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
                  messages.map((m) => {
                    const mine = m.senderId === myId;
                    const sender = active.isGroup && !mine ? active.members.find((p) => p.id === m.senderId) : undefined;
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[78%] rounded-2xl px-3 py-2 text-sm", mine ? "bg-lunex-gradient text-white" : "bg-white/5 text-lunex-gray")}>
                          {sender && <p className="mb-0.5 text-[11px] font-semibold text-primary-300">{sender.displayName}</p>}
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className="mt-1 text-[10px] opacity-70">{timeAgo(m.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-white/10 p-3">
                <MuteNotice className="mb-2" />
                {error && <p className="mb-2 text-xs text-red-400" role="alert">{error}</p>}
                <form onSubmit={send} className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="اكتب رسالتك..."
                    className="flex-1"
                    maxLength={2000}
                    disabled={mute.muted}
                    aria-label="نص الرسالة"
                  />
                  <Button type="submit" size="icon" aria-label="إرسال" disabled={!draft.trim() || sending || mute.muted}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
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
