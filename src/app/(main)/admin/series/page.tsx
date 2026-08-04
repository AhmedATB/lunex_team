"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, MoreVertical, Pencil, Trash2, Plus } from "lucide-react";
import { getMockDatabase } from "@/lib/mock/generate";
import { useSession } from "@/store/session";
import { useTeamManagement } from "@/store/team-management";
import type { SeriesStatus, SeriesType } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/utils";

const STATUS_LABEL: Record<SeriesStatus, string> = {
  ongoing: "مستمر",
  completed: "مكتمل",
  hiatus: "متوقف",
  dropped: "متروك",
};
const STATUS_VARIANT: Record<SeriesStatus, "success" | "secondary" | "warning" | "destructive"> = {
  ongoing: "success",
  completed: "secondary",
  hiatus: "warning",
  dropped: "destructive",
};
const SERIES_TYPE_LABELS: Record<SeriesType, string> = { manhwa: "مانهوا", manga: "مانجا", manhua: "مانها", novel: "رواية" };

export default function AdminSeriesPage() {
  useEffect(() => {
    document.title = "إدارة السلاسل | LUNEX TEAM";
  }, []);
  const [query, setQuery] = useState("");
  const db = useMemo(() => getMockDatabase(), []);
  const currentUserId = useSession((s) => s.currentUserId);
  const store = useTeamManagement();
  const teamMap = new Map([...db.teams, ...store.createdTeams].map((t) => [t.id, t]));

  const removedIds = new Set(store.removedSeriesIds);
  const allSeries = [...db.series, ...store.addedSeries]
    .filter((s) => !removedIds.has(s.id))
    .map((s) => ({ ...s, ...store.seriesInfoOverrides[s.id] }));

  const filtered = allSeries.filter((s) => !query || s.titleAr.includes(query));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-white">إدارة السلاسل ({filtered.length})</h1>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن سلسلة..." className="ps-9" />
          </div>
          {currentUserId && (
            <CreateSeriesDialog
              teams={[...db.teams, ...store.createdTeams]}
              genres={db.genres}
              onCreate={(s) => store.createSeries(s, currentUserId)}
            />
          )}
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
                      <Image src={s.cover} alt={s.titleAr} fill sizes="32px" className="object-cover" unoptimized />
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
                        <EditSeriesMenuDialog
                          series={s}
                          onSave={(patch) => currentUserId && store.updateSeriesInfo(s.id, patch, s.teamId, currentUserId)}
                        />
                        <DropdownMenuItem
                          className="text-red-400 focus:bg-red-500/10"
                          onSelect={() => currentUserId && store.removeSeries(s.id, s.teamId, currentUserId)}
                        >
                          <Trash2 className="h-4 w-4" /> حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-lunex-gray">لا توجد سلاسل مطابقة.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function EditSeriesMenuDialog({
  series,
  onSave,
}: {
  series: { titleAr: string; synopsis: string; status: SeriesStatus; cover: string; banner: string };
  onSave: (patch: { titleAr: string; synopsis: string; status: SeriesStatus; cover: string; banner: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [titleAr, setTitleAr] = useState(series.titleAr);
  const [synopsis, setSynopsis] = useState(series.synopsis);
  const [status, setStatus] = useState<SeriesStatus>(series.status);

  function submit() {
    if (!titleAr.trim()) return;
    onSave({ titleAr: titleAr.trim(), synopsis: synopsis.trim(), status, cover: series.cover, banner: series.banner });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil className="h-4 w-4" /> تعديل
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تعديل السلسلة</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>اسم السلسلة</Label>
            <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>القصة</Label>
            <Textarea rows={3} value={synopsis} onChange={(e) => setSynopsis(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الحالة</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SeriesStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={submit} className="w-full">حفظ التغييرات</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateSeriesDialog({
  teams,
  genres,
  onCreate,
}: {
  teams: { id: string; name: string }[];
  genres: { id: string; nameAr: string }[];
  onCreate: (series: {
    teamId: string; title: string; titleAr: string; synopsis: string; type: SeriesType; status: SeriesStatus;
    country: "kr" | "jp" | "cn"; author: string; artist: string; year: number; cover: string; banner: string;
    genreIds: string[]; tags: string[];
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [titleAr, setTitleAr] = useState("");
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [type, setType] = useState<SeriesType>("manhwa");
  const [cover, setCover] = useState("");
  const [genreIds, setGenreIds] = useState<Set<string>>(new Set());

  function toggleGenre(id: string) {
    setGenreIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!titleAr.trim() || !synopsis.trim() || !teamId) return;
    const seed = `lunex-series-admin-new-${Date.now()}`;
    onCreate({
      teamId,
      titleAr: titleAr.trim(),
      title: title.trim() || titleAr.trim(),
      synopsis: synopsis.trim(),
      type,
      status: "ongoing",
      country: "kr",
      author: "غير معروف",
      artist: "غير معروف",
      year: new Date().getFullYear(),
      cover: cover.trim() || `https://picsum.photos/seed/${seed}/480/680`,
      banner: cover.trim() || `https://picsum.photos/seed/${seed}-banner/1200/400`,
      genreIds: [...genreIds],
      tags: [],
    });
    setTitleAr(""); setTitle(""); setSynopsis(""); setCover(""); setGenreIds(new Set()); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> سلسلة جديدة</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>إضافة سلسلة جديدة</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>الفريق الناشر</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder="اختر فريقاً" /></SelectTrigger>
              <SelectContent>
                {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>اسم السلسلة (عربي)</Label>
            <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder="مثال: عودة قناص العصور" />
          </div>
          <div className="space-y-1.5">
            <Label>اسم السلسلة (إنجليزي)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>القصة</Label>
            <Textarea rows={3} value={synopsis} onChange={(e) => setSynopsis(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>النوع</Label>
            <Select value={type} onValueChange={(v) => setType(v as SeriesType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SERIES_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>رابط صورة الغلاف (اختياري)</Label>
            <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>التصنيفات</Label>
            <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
              {genres.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-xs text-lunex-gray">
                  <Checkbox checked={genreIds.has(g.id)} onCheckedChange={() => toggleGenre(g.id)} />
                  {g.nameAr}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={submit} className="w-full">إضافة السلسلة</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
