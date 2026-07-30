"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Send, MessageCircle } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useSession } from "@/store/session";
import { useMessages, conversationId } from "@/store/messages";
import { useProfile, effectiveAvatarSeed } from "@/store/profile";
import { avatarUrl, cn, timeAgo } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageInner />
    </Suspense>
  );
}

function MessagesPageInner() {
  useEffect(() => {
    document.title = "الرسائل | LUNEX TEAM";
  }, []);

  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("to");

  const db = useMemo(() => getMockDatabase(), []);
  const currentUserId = useSession((s) => s.currentUserId);
  const conversations = useMessages((s) => s.conversations);
  const unreadBy = useMessages((s) => s.unreadBy);
  const sendMessage = useMessages((s) => s.sendMessage);
  const markRead = useMessages((s) => s.markRead);
  const avatarOverrides = useProfile((s) => s.avatarOverrides);

  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  useEffect(() => {
    if (targetUserId) setSelectedUserId(targetUserId);
  }, [targetUserId]);

  const [draft, setDraft] = useState("");

  const myConversations = useMemo(() => {
    if (!currentUserId) return [];
    return Object.values(conversations)
      .filter((c) => c.participantIds.includes(currentUserId))
      .sort((a, b) => {
        const aLast = a.messages[a.messages.length - 1]?.at ?? "";
        const bLast = b.messages[b.messages.length - 1]?.at ?? "";
        return +new Date(bLast) - +new Date(aLast);
      });
  }, [conversations, currentUserId]);

  useEffect(() => {
    if (!selectedUserId && myConversations.length > 0 && currentUserId) {
      const other = myConversations[0].participantIds.find((id) => id !== currentUserId);
      if (other) setSelectedUserId(other);
    }
  }, [myConversations, selectedUserId, currentUserId]);

  useEffect(() => {
    if (selectedUserId && currentUserId) markRead(conversationId(currentUserId, selectedUserId), currentUserId);
  }, [selectedUserId, currentUserId, markRead]);

  if (!ready) return null;

  if (!currentUserId) {
    return <div className="container py-16 text-center text-lunex-gray">يجب تسجيل الدخول لعرض رسائلك.</div>;
  }

  const activeConvoId = selectedUserId ? conversationId(currentUserId, selectedUserId) : null;
  const activeConvo = activeConvoId ? conversations[activeConvoId] : undefined;
  const selectedUser = selectedUserId ? db.users.find((u) => u.id === selectedUserId) : undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !draft.trim()) return;
    sendMessage(currentUserId!, selectedUserId, draft);
    setDraft("");
  }

  return (
    <div className="container py-6">
      <h1 className="section-title mb-4 font-display text-2xl font-bold text-white">الرسائل</h1>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="panel max-h-[70vh] overflow-y-auto">
          {myConversations.length === 0 && (
            <p className="p-6 text-center text-sm text-lunex-gray">لا توجد محادثات بعد.</p>
          )}
          {myConversations.map((c) => {
            const otherId = c.participantIds.find((id) => id !== currentUserId)!;
            const other = db.users.find((u) => u.id === otherId);
            if (!other) return null;
            const lastMsg = c.messages[c.messages.length - 1];
            const unread = (unreadBy[c.id] ?? []).includes(currentUserId);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedUserId(otherId)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-white/5 p-3 text-start transition-colors hover:bg-primary-600/10",
                  selectedUserId === otherId && "bg-primary-600/15"
                )}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/30">
                  <Image src={avatarUrl(effectiveAvatarSeed(other, avatarOverrides))} alt={other.displayName} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{other.displayName}</p>
                  <p className="truncate text-xs text-lunex-gray">{lastMsg?.text}</p>
                </div>
                {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-400" />}
              </button>
            );
          })}
        </div>

        <div className="panel flex min-h-[60vh] flex-col">
          {!selectedUser ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-lunex-gray">
              <MessageCircle className="h-10 w-10" />
              <p className="text-sm">اختر محادثة أو ابدأ واحدة جديدة.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/10 p-4">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-primary-500/30">
                  <Image src={avatarUrl(effectiveAvatarSeed(selectedUser, avatarOverrides))} alt={selectedUser.displayName} fill className="object-cover" />
                </div>
                <p className="font-display font-bold text-white">{selectedUser.displayName}</p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {(activeConvo?.messages ?? []).length === 0 && (
                  <p className="py-10 text-center text-sm text-lunex-gray">ابدأ المحادثة بإرسال أول رسالة.</p>
                )}
                {(activeConvo?.messages ?? []).map((m) => {
                  const mine = m.senderId === currentUserId;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                          mine ? "bg-lunex-gradient text-white" : "bg-white/5 text-lunex-gray"
                        )}
                      >
                        <p>{m.text}</p>
                        <p className="mt-1 text-[10px] opacity-70">{timeAgo(m.at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="اكتب رسالتك..."
                  className="flex-1"
                />
                <Button type="submit" size="icon" aria-label="إرسال" disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
