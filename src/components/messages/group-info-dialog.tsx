"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, Crown, Loader2, LogOut, MoreVertical, Pencil, ShieldCheck, ShieldOff, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { chatApi, type Conversation, type Person } from "@/lib/messages-api";
import { ChatAvatar, PersonAvatar } from "@/components/messages/chat-avatars";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RANK = { owner: 0, admin: 1, member: 2 } as const;
const ROLE_LABEL = { owner: "المالك", admin: "مشرف" } as const;

/**
 * A group's page: its picture and name (changed by its owner and admins), its members — each a link to their account, with their
 * standing in the group and, for those who may, what can be done to them — and adding people and leaving.
 */
export function GroupInfoDialog({
  open,
  onClose,
  conversation,
  myId,
  onUpdated,
  onAddPeople,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  myId: string;
  onUpdated: (conversation: Conversation) => void;
  onAddPeople: () => void;
  onLeave: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const mine = conversation.members.find((m) => m.id === myId)?.role ?? "member";
  const isOwner = mine === "owner";
  const canManage = mine === "owner" || mine === "admin";
  const members = [...conversation.members].sort((a, b) => RANK[a.role ?? "member"] - RANK[b.role ?? "member"] || a.displayName.localeCompare(b.displayName, "ar"));

  async function run(key: string, action: () => ReturnType<typeof chatApi.updateGroup>) {
    setBusy(key);
    setError("");
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    onUpdated(result.body);
    return true;
  }

  async function saveName() {
    if (await run("name", () => chatApi.updateGroup(conversation.id, nameDraft.trim()))) setEditing(false);
  }

  /** What may be done to this member by the person looking. */
  function actionsFor(member: Person) {
    const role = member.role ?? "member";
    if (member.id === myId || role === "owner") return { promote: false, remove: false };
    return { promote: isOwner, remove: isOwner || (canManage && role === "member") };
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">معلومات المجموعة</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="relative">
            <ChatAvatar conversation={conversation} myId={myId} size={96} />
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => file.current?.click()}
                  disabled={busy === "photo"}
                  aria-label="تغيير صورة المجموعة"
                  className="absolute -bottom-1 -end-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-500 disabled:opacity-60"
                >
                  {busy === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
                <input
                  ref={file}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    e.target.value = "";
                    if (picked) void run("photo", () => chatApi.setGroupPhoto(conversation.id, picked));
                  }}
                />
              </>
            )}
          </div>
          {canManage && conversation.photoVersion && (
            <button type="button" onClick={() => void run("photo", () => chatApi.removeGroupPhoto(conversation.id))} className="flex items-center gap-1 text-xs text-lunex-gray hover:text-red-400">
              <Trash2 className="h-3 w-3" /> إزالة الصورة
            </button>
          )}

          {editing ? (
            <div className="flex w-full items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void saveName()}
                maxLength={60}
                autoFocus
                placeholder="اسم المجموعة"
                aria-label="اسم المجموعة"
              />
              <Button size="icon" onClick={() => void saveName()} disabled={busy === "name"} aria-label="حفظ الاسم">
                {busy === "name" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditing(false)} aria-label="إلغاء">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-bold text-white">{conversation.title || "مجموعة بلا اسم"}</h2>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(conversation.title ?? "");
                    setEditing(true);
                  }}
                  aria-label="تعديل اسم المجموعة"
                  className="rounded-full p-1.5 text-lunex-gray hover:bg-white/10 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-lunex-gray">{conversation.members.length} أعضاء</p>
        </div>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <ul className="space-y-1">
          {members.map((m) => {
            const role = m.role ?? "member";
            const { promote, remove } = actionsFor(m);
            return (
              <li key={m.id} className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-white/5">
                <Link href={`/profile/${encodeURIComponent(m.username)}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`الملف الشخصي لـ ${m.displayName}`}>
                  <PersonAvatar person={m} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">
                      {m.displayName}
                      {m.id === myId && <span className="ms-1 text-xs font-normal text-lunex-gray">(أنت)</span>}
                    </span>
                    <span className="block truncate text-xs text-lunex-gray">
                      <bdi dir="ltr">@{m.username}</bdi>
                    </span>
                  </span>
                </Link>
                {role !== "member" && (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      role === "owner" ? "bg-amber-500/15 text-amber-300" : "bg-primary-500/20 text-primary-300"
                    )}
                  >
                    {role === "owner" ? <Crown className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />} {ROLE_LABEL[role]}
                  </span>
                )}
                {(promote || remove) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`خيارات ${m.displayName}`} className="rounded-full p-2 text-lunex-gray hover:bg-white/10 hover:text-white" disabled={busy === `m-${m.id}`}>
                        {busy === `m-${m.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52">
                      {promote && (
                        <DropdownMenuItem onClick={() => void run(`m-${m.id}`, () => chatApi.setMemberRole(conversation.id, m.id, role === "admin" ? "member" : "admin"))}>
                          {role === "admin" ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />} {role === "admin" ? "إلغاء الإشراف" : "جعله مشرفًا"}
                        </DropdownMenuItem>
                      )}
                      {remove && (
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-300"
                          onClick={() => {
                            if (window.confirm(`إزالة ${m.displayName} من المجموعة؟`)) void run(`m-${m.id}`, () => chatApi.removeMember(conversation.id, m.id));
                          }}
                        >
                          <UserMinus className="h-4 w-4" /> إزالة من المجموعة
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2 pt-1">
          {canManage && (
            <Button variant="secondary" onClick={onAddPeople}>
              <UserPlus className="h-4 w-4" /> إضافة أشخاص
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => {
              if (window.confirm("مغادرة هذه المجموعة؟")) void onLeave();
            }}
          >
            <LogOut className="h-4 w-4" /> مغادرة المجموعة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
