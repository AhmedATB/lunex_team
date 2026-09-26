"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Loader2, MoreVertical, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { useSession } from "@/store/session";
import { useToast } from "@/store/toast";
import { can } from "@/lib/rbac";
import { prepareSearchQuery, rankByTier, searchTier, seriesSearchFields } from "@/lib/fuzzy-search";
import { seriesApi } from "@/lib/series-api";
import type { Series, SeriesStatus } from "@/lib/types";
import { SeriesFormDialog } from "@/components/admin/series-form-dialog";
import { TransferSeriesDialog } from "@/components/admin/transfer-series-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/utils";

const STATUS_LABEL: Record<SeriesStatus, string> = { ongoing: "مستمر", completed: "مكتمل", hiatus: "متوقف", dropped: "متروك" };
const STATUS_VARIANT: Record<SeriesStatus, "success" | "secondary" | "warning" | "destructive"> = {
  ongoing: "success",
  completed: "secondary",
  hiatus: "warning",
  dropped: "destructive",
};
const PAGE = 40;

const say = (title: string, description?: string) => useToast.getState().push({ title, description });

/** The catalogue's series, from the server: create, edit (with the cover chosen from the device), move to a team, pin to the home page, delete. */
export default function AdminSeriesPage() {
  useEffect(() => {
    document.title = "إدارة السلاسل | LUNEX TEAM";
  }, []);

  const router = useRouter();
  const db = useCatalog();
  const currentUserId = useSession((s) => s.currentUserId);
  const me = db.users.find((u) => u.id === currentUserId);
  const canManage = !!me && can(me, "manage_series");

  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<Series | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Series | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const teamName = useMemo(() => new Map(db.teams.map((t) => [t.id, t.name])), [db.teams]);

  const filtered = useMemo(() => {
    const prepared = prepareSearchQuery(query);
    if (prepared.tokens.length === 0) return db.series;
    return rankByTier(db.series, (s) => searchTier(prepared, seriesSearchFields(s)));
  }, [db.series, query]);
  const visible = filtered.slice(0, shown);
  const visibleIds = visible.map((s) => s.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  /** The pinned works, in the order they appear on the home page. */
  const pinned = useMemo(
    () => db.series.filter((s) => s.isFeatured).sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999)),
    [db.series]
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function togglePin(series: Series) {
    setBusy(series.id);
    const ids = series.isFeatured ? pinned.filter((s) => s.id !== series.id).map((s) => s.id) : [...pinned.map((s) => s.id), series.id];
    const result = await seriesApi.setFeatured(ids);
    setBusy(null);
    if (!result.ok) return say("تعذر التثبيت", result.message);
    say(series.isFeatured ? "أُلغي التثبيت" : "ثُبّت في الصفحة الرئيسية", series.titleAr);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(deleting.id);
    const result = await seriesApi.remove(deleting.id);
    setBusy(null);
    if (!result.ok) {
      say("تعذر الحذف", result.message);
      return;
    }
    say("حُذفت السلسلة", deleting.titleAr);
    setDeleting(null);
    setSelected((current) => {
      const next = new Set(current);
      next.delete(deleting.id);
      return next;
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-white">إدارة السلاسل ({filtered.length})</h1>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="ابحث عن سلسلة..." className="ps-9" />
          </div>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> سلسلة جديدة
            </Button>
          )}
        </div>
      </div>

      {canManage && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary-500/30 bg-primary-500/10 p-3">
          <span className="text-sm text-white">تم تحديد {selected.size} عمل</span>
          <Button size="sm" className="ms-auto" onClick={() => setMoving([...selected])}>
            <ArrowRightLeft className="h-3.5 w-3.5" /> نقل إلى فريق
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
        </div>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-lunex-gray">
                {canManage && (
                  <th className="w-10 p-3">
                    <Checkbox aria-label="تحديد كل الأعمال المعروضة" checked={allVisibleSelected} onCheckedChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))} />
                  </th>
                )}
                <th className="p-3 text-start font-medium">السلسلة</th>
                <th className="p-3 text-start font-medium">الفريق</th>
                <th className="p-3 text-start font-medium">الحالة</th>
                <th className="p-3 text-start font-medium">الفصول</th>
                <th className="p-3 text-start font-medium">المشاهدات</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  {canManage && (
                    <td className="w-10 p-3">
                      <Checkbox aria-label={`تحديد ${s.titleAr}`} checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    </td>
                  )}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded-md">
                        <Image src={s.cover} alt="" fill sizes="32px" className="object-cover" unoptimized />
                      </div>
                      <Link href={`/series/${s.slug}`} className="max-w-[200px] truncate font-medium text-white hover:text-primary-300">{s.titleAr}</Link>
                      {s.isFeatured && <Badge variant="outline" className="shrink-0 text-[10px]">مثبّت</Badge>}
                    </div>
                  </td>
                  <td className="p-3 text-lunex-gray">{teamName.get(s.teamId) ?? "—"}</td>
                  <td className="p-3"><Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                  <td className="p-3 text-lunex-gray">{s.chapterCount}</td>
                  <td className="p-3 text-lunex-gray">{formatNumber(s.views)}</td>
                  <td className="p-3 text-end">
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-lg p-1.5 text-lunex-gray hover:bg-white/10 hover:text-white" aria-label={`خيارات ${s.titleAr}`} disabled={busy === s.id}>
                            {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(s)}>
                            <Pencil className="h-4 w-4" /> تعديل
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setMoving([s.id])}>
                            <ArrowRightLeft className="h-4 w-4" /> نقل إلى فريق
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => togglePin(s)}>
                            {s.isFeatured ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />} {s.isFeatured ? "إلغاء التثبيت في الرئيسية" : "تثبيت في الرئيسية"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-400 focus:bg-red-500/10" onSelect={() => setDeleting(s)}>
                            <Trash2 className="h-4 w-4" /> حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-lunex-gray">لا توجد سلاسل مطابقة.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {filtered.length > shown && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>عرض المزيد ({filtered.length - shown})</Button>
        </div>
      )}

      <SeriesFormDialog open={creating} onClose={() => setCreating(false)} canEditorial teams={db.teams} />
      <SeriesFormDialog open={editing !== null} onClose={() => setEditing(null)} series={editing} canEditorial teams={db.teams} />

      <TransferSeriesDialog
        seriesIds={moving}
        titles={(moving ?? []).map((id) => db.series.find((s) => s.id === id)?.titleAr ?? "")}
        teams={db.teams}
        onClose={() => setMoving(null)}
        onDone={() => {
          setSelected(new Set());
          router.refresh();
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف «{deleting?.titleAr}»؟</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-lunex-gray">
            يُحذف العمل مع كل فصوله وتعليقاته وتقييماته وتقدّم القرّاء فيه. لا يمكن التراجع عن هذا.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={busy !== null}>
              {busy !== null && <Loader2 className="h-4 w-4 animate-spin" />} حذف نهائيًا
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(null)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
