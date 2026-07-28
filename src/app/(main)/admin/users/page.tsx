"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, MoreVertical, Ban, ShieldCheck } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { GLOBAL_ROLE_LABELS } from "@/lib/rbac";
import type { GlobalRole } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { avatarUrl, timeAgo } from "@/lib/utils";

export default function AdminUsersPage() {
  useEffect(() => {
    document.title = "المستخدمون | LUNEX TEAM";
  }, []);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<GlobalRole | "all">("all");
  const users = useMemo(() => getMockDatabase().users, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (query && !u.displayName.includes(query) && !u.username.includes(query)) return false;
      return true;
    });
  }, [users, query, role]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-white">المستخدمون ({filtered.length})</h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث..." className="ps-9" />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as GlobalRole | "all")}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأدوار</SelectItem>
              {Object.entries(GLOBAL_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {filtered.slice(0, 40).map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="flex items-center gap-2 p-3">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
                      <Image src={avatarUrl(u.avatarSeed)} alt={u.displayName} fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{u.displayName}</p>
                      <p className="truncate text-xs text-lunex-gray">@{u.username}</p>
                    </div>
                  </td>
                  <td className="p-3"><Badge variant="secondary">{GLOBAL_ROLE_LABELS[u.role]}</Badge></td>
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
                        <DropdownMenuItem><ShieldCheck className="h-4 w-4" /> تغيير الدور</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-400 focus:bg-red-500/10">
                          <Ban className="h-4 w-4" /> حظر المستخدم
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
