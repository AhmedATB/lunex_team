"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, MoreVertical, Pencil, EyeOff, Trash2, Plus } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  ongoing: "مستمر",
  completed: "مكتمل",
  hiatus: "متوقف",
  dropped: "متروك",
};
const STATUS_VARIANT: Record<string, "success" | "secondary" | "warning" | "destructive"> = {
  ongoing: "success",
  completed: "secondary",
  hiatus: "warning",
  dropped: "destructive",
};

export default function AdminSeriesPage() {
  useEffect(() => {
    document.title = "إدارة السلاسل | LUNEX TEAM";
  }, []);
  const [query, setQuery] = useState("");
  const db = useMemo(() => getMockDatabase(), []);
  const teamMap = new Map(db.teams.map((t) => [t.id, t]));

  const filtered = db.series.filter((s) => !query || s.titleAr.includes(query));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-white">إدارة السلاسل ({filtered.length})</h1>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن سلسلة..." className="ps-9" />
          </div>
          <Button><Plus className="h-4 w-4" /> سلسلة جديدة</Button>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-lunex-gray">
                <th className="p-3 text-start font-medium">السلسلة</th>
                <th className="p-3 text-start font-medium">الفريق</th>
                <th className="p-3 text-start font-medium">الحالة</th>
                <th className="p-3 text-start font-medium">الفصول</th>
                <th className="p-3 text-start font-medium">المشاهدات</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 40).map((s) => (
                <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="flex items-center gap-2 p-3">
                    <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded-md">
                      <Image src={s.cover} alt={s.titleAr} fill className="object-cover" />
                    </div>
                    <p className="max-w-[200px] truncate font-medium text-white">{s.titleAr}</p>
                  </td>
                  <td className="p-3 text-lunex-gray">{teamMap.get(s.teamId)?.name}</td>
                  <td className="p-3"><Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                  <td className="p-3 text-lunex-gray">{s.chapterCount}</td>
                  <td className="p-3 text-lunex-gray">{formatNumber(s.views)}</td>
                  <td className="p-3 text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-lg p-1.5 text-lunex-gray hover:bg-white/10 hover:text-white">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Pencil className="h-4 w-4" /> تعديل</DropdownMenuItem>
                        <DropdownMenuItem><EyeOff className="h-4 w-4" /> إخفاء</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-400 focus:bg-red-500/10">
                          <Trash2 className="h-4 w-4" /> حذف
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
