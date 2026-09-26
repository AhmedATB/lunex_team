"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, MoreVertical, Ban, ShieldCheck, Loader2 } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { GLOBAL_ROLE_LABELS } from "@/lib/rbac";
import type { GlobalRole, User } from "@/lib/types";
import { synthesizeProfile } from "@/store/real-users";
import { useSession } from "@/store/session";
import type { BackendPublicUser } from "@/lib/auth-types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/utils";
import { useProfile, avatarSrcFor } from "@/store/profile";

interface ListedUser extends BackendPublicUser {
  level: number;
  chaptersRead: number;
}

interface UserPage {
  items: ListedUser[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

function toUser(row: ListedUser): User {
  return { ...synthesizeProfile(row), level: row.level, readCount: row.chaptersRead, isOnline: false };
}

export default function AdminUsersPage() {
  useEffect(() => {
    document.title = "المستخدمون | LUNEX TEAM";
  }, []);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<GlobalRole | "all">("all");
  const [bannedOnly, setBannedOnly] = useState(false);
  const catalog = useCatalog();
  const avatarOverrides = useProfile((s) => s.avatarOverrides);
  const currentUserId = useSession((s) => s.currentUserId);

  // Every real account comes from the server, a page at a time; the site's own catalogue only knows people who are on a team.
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const search = useMemo(() => {
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
    if (query.trim()) params.set("q", query.trim());
    if (role !== "all") params.set("role", role);
    if (bannedOnly) params.set("banned", "true");
    return params;
  }, [query, role, bannedOnly]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams(search);
        params.set("page", String(page));
        const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(body?.message ?? "تعذر تحميل المستخدمين.");
          if (page === 1) {
            setUsers(catalog.users);
            setTotal(null);
          }
          return;
        }
        const data = body as UserPage;
        setError("");
        setTotal(data.total);
        setUsers((prev) => (page === 1 ? data.items.map(toUser) : [...prev, ...data.items.map(toUser)]));
      } catch {
        if (!cancelled) setError("تعذر الاتصال بالخادم.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, page === 1 ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, page, catalog.users]);

  // Changing what is searched starts again from the first page (set together, so the list is fetched once).
  const restartWith = <T,>(set: (value: T) => void) => (value: T) => {
    setPage(1);
    set(value);
  };

  const fromServer = total !== null;

  function applyRoleChange(userId: string, newRole: GlobalRole) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
  }

  function applyBanChange(userId: string, isBanned: boolean) {
    setUsers((prev) => (bannedOnly && !isBanned ? prev.filter((u) => u.id !== userId) : prev.map((u) => (u.id === userId ? { ...u, isBanned } : u))));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-white">المستخدمون{total !== null && ` (${total})`}</h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
            <Input value={query} onChange={(e) => restartWith(setQuery)(e.target.value)} placeholder="ابحث بالاسم أو البريد..." className="ps-9" />
          </div>
          <Select value={role} onValueChange={(v) => restartWith(setRole)(v as GlobalRole | "all")}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأدوار</SelectItem>
              {Object.entries(GLOBAL_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={bannedOnly ? "destructive" : "secondary"} size="sm" onClick={() => restartWith(setBannedOnly)(!bannedOnly)}>
            <Ban className="h-3.5 w-3.5" /> {bannedOnly ? "عرض الكل" : "المحظورون فقط"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-start text-xs text-lunex-gray">
                <th className="p-3 text-start font-medium">المستخدم</th>
                <th className="p-3 text-start font-medium">الدور</th>
                <th className="p-3 text-start font-medium">المستوى</th>
                <th className="p-3 text-start font-medium">القراءات</th>
                <th className="p-3 text-start font-medium">الانضمام</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="flex items-center gap-2 p-3">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                      <Image src={avatarSrcFor(u, avatarOverrides)} alt={u.displayName} fill sizes="32px" className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{u.displayName}</p>
                      <p className="truncate text-xs text-lunex-gray" dir="ltr">@{u.username}</p>
                    </div>
                  </td>
                  <td className="p-3 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{GLOBAL_ROLE_LABELS[u.role]}</Badge>
                    {u.isBanned && <Badge variant="destructive">محظور</Badge>}
                  </td>
                  <td className="p-3 text-lunex-gray">{u.level}</td>
                  <td className="p-3 text-lunex-gray">{u.readCount}</td>
                  <td className="p-3 text-lunex-gray">{timeAgo(u.joinedAt)}</td>
                  <td className="p-3 text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-lg p-1.5 text-lunex-gray hover:bg-white/10 hover:text-white">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {fromServer ? (
                          <ChangeRoleDialog user={u} onChanged={(newRole) => applyRoleChange(u.id, newRole)} />
                        ) : (
                          <DropdownMenuItem disabled title="حساب تجريبي غير مرتبط بحساب حقيقي">
                            <ShieldCheck className="h-4 w-4" /> تغيير الدور (حساب تجريبي)
                          </DropdownMenuItem>
                        )}
                        {fromServer && u.id !== currentUserId && u.role !== "owner" ? (
                          <BanUserDialog user={u} onChanged={(isBanned) => applyBanChange(u.id, isBanned)} />
                        ) : (
                          <DropdownMenuItem
                            disabled
                            className="text-red-400"
                            title={
                              !fromServer
                                ? "حساب تجريبي غير مرتبط بحساب حقيقي"
                                : u.id === currentUserId
                                  ? "لا يمكنك حظر حسابك"
                                  : "لا يمكن حظر حساب المالك"
                            }
                          >
                            <Ban className="h-4 w-4" /> حظر المستخدم
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr><td colSpan={6} className="p-8 text-center text-lunex-gray">لا يوجد مستخدمون مطابقون.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      <div className="flex flex-col items-center gap-2">
        {loading && <Loader2 className="h-5 w-5 animate-spin text-lunex-gray" />}
        {fromServer && !loading && total !== null && users.length < total && (
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>عرض المزيد ({total - users.length} متبقٍ)</Button>
        )}
      </div>
    </div>
  );
}

function ChangeRoleDialog({ user, onChanged }: { user: User; onChanged: (role: GlobalRole) => void }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<GlobalRole>(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? "تعذر تغيير الدور.");
        return;
      }
      onChanged(role);
      setOpen(false);
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <ShieldCheck className="h-4 w-4" /> تغيير الدور
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغيير دور {user.displayName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Select value={role} onValueChange={(v) => setRole(v as GlobalRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(GLOBAL_ROLE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button onClick={submit} disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BanUserDialog({ user, onChanged }: { user: User; onChanged: (isBanned: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const willBan = !user.isBanned;

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned: willBan }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? "تعذر تنفيذ العملية.");
        return;
      }
      onChanged(willBan);
      setOpen(false);
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className={willBan ? "text-red-400 focus:bg-red-500/10" : undefined}>
          <Ban className="h-4 w-4" /> {willBan ? "حظر المستخدم" : "إلغاء الحظر"}
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{willBan ? `حظر ${user.displayName}` : `إلغاء حظر ${user.displayName}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-lunex-gray">
            {willBan
              ? "لن يستطيع هذا المستخدم تسجيل الدخول بعد الآن، وستُنهى كل جلساته الحالية فورًا."
              : "سيستطيع هذا المستخدم تسجيل الدخول مرة أخرى."}
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button onClick={submit} disabled={loading} variant={willBan ? "destructive" : "default"} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {willBan ? "تأكيد الحظر" : "تأكيد إلغاء الحظر"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
