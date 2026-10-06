"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Eye, Loader2, X } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { COUNTRIES, RATINGS, STATUSES, TYPES } from "@/components/admin/series-form-dialog";
import { chapterLabel } from "@/lib/chapter-label";
import { genreLabelsFor } from "@/lib/genre-helpers";
import { seriesApi, type ReviewSeries } from "@/lib/series-api";
import { useToast } from "@/store/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TeamChapter {
  id: string;
  seriesId: string;
  number: number;
  title: string;
  isPublished: boolean;
  pages: { id: string }[];
}

const labelOf = (list: { value: string; label: string }[], value: string) => list.find((o) => o.value === value)?.label ?? value;

/**
 * The works teams' leaders sent, waiting for the site's decision. A work that waits is not on the site yet, so its own page is not
 * open: opening one here shows everything the team wrote (names, story, genres, who and where from) and the chapters they have
 * uploaded so far, and the decision can be made from there. Approving lists the work (readers see it, the followers and the
 * community hear of it); turning it down keeps it out and lets the team fix it and send it again. Nothing shows when none wait.
 */
export function SeriesReviewPanel() {
  const router = useRouter();
  const teams = useCatalog().teams;
  const [items, setItems] = useState<ReviewSeries[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ReviewSeries | null>(null);

  const load = useCallback(() => {
    seriesApi.reviewList().then((result) => setItems(result.ok ? result.body : []));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function decide(item: ReviewSeries, state: "approved" | "rejected") {
    setBusy(item.id);
    const result = await seriesApi.update(item.id, { state });
    setBusy(null);
    if (!result.ok) return useToast.getState().push({ title: "تعذر حفظ القرار", description: result.message });
    useToast.getState().push({ title: state === "approved" ? "وُوفق على العمل ونُشر" : "رُفض العمل", description: item.title });
    setViewing(null);
    load();
    router.refresh();
  }

  if (items.length === 0) return null;
  const teamOf = (id: string) => teams.find((team) => team.id === id);

  return (
    <Card className="border-amber-400/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          بانتظار الموافقة <Badge variant="warning">{items.filter((item) => item.state === "pending").length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-2.5">
            <button type="button" onClick={() => setViewing(item)} className="flex min-w-0 flex-1 items-center gap-3 text-start" aria-label={`عرض تفاصيل ${item.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.cover} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="line-clamp-1 block font-bold text-white">{item.title}</span>
                <span className="block text-xs text-lunex-gray">
                  فريق {teamOf(item.teamId)?.name ?? "—"} · {item.state === "pending" ? "جديد" : "سبق رفضه"}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setViewing(item)}>
                <Eye className="h-3.5 w-3.5" /> التفاصيل
              </Button>
              <Button size="sm" onClick={() => decide(item, "approved")} disabled={busy === item.id}>
                {busy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} موافقة
              </Button>
              {item.state === "pending" && (
                <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => decide(item, "rejected")} disabled={busy === item.id}>
                  <X className="h-3.5 w-3.5" /> رفض
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {viewing && <Details item={viewing} team={teamOf(viewing.teamId)} busy={busy === viewing.id} onDecide={(state) => decide(viewing, state)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Details({ item, team, busy, onDecide }: { item: ReviewSeries; team?: { name: string; slug: string }; busy: boolean; onDecide: (state: "approved" | "rejected") => void }) {
  const [chapters, setChapters] = useState<TeamChapter[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/chapters/admin/recent")
      .then((res) => (res.ok ? res.json() : []))
      .then((body) => alive && setChapters((Array.isArray(body) ? (body as TeamChapter[]) : []).filter((c) => c.seriesId === item.id).sort((a, b) => a.number - b.number)))
      .catch(() => alive && setChapters([]));
    return () => {
      alive = false;
    };
  }, [item.id]);

  const genres = [...genreLabelsFor(item.genreIds, 12), ...(item.tags ?? [])];
  const facts: [string, string][] = [
    ["النوع", labelOf(TYPES, item.type)],
    ["البلد", labelOf(COUNTRIES, item.country)],
    ["الحالة", labelOf(STATUSES, item.status)],
    ["التصنيف العمري", labelOf(RATINGS, item.contentRating)],
    ["سنة الإصدار", String(item.year)],
    ["المؤلف", item.author.trim() || "—"],
    ["الرسام", item.artist.trim() || "—"],
  ];

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {item.title} <Badge variant={item.state === "pending" ? "warning" : "destructive"}>{item.state === "pending" ? "بانتظار الموافقة" : "مرفوض سابقًا"}</Badge>
        </DialogTitle>
      </DialogHeader>

      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.cover} alt="" className="h-48 w-32 shrink-0 rounded-xl border border-white/10 object-cover" />
        <div className="min-w-0 flex-1 space-y-3">
          {team && (
            <p className="text-sm text-lunex-gray">
              الفريق:{" "}
              <Link href={`/teams/${team.slug}`} target="_blank" className="inline-flex items-center gap-1 font-semibold text-primary-300 hover:text-primary-200">
                {team.name} <ExternalLink className="h-3 w-3" />
              </Link>
            </p>
          )}
          {item.alternativeTitles.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-lunex-gray">أسماء بديلة</p>
              <p className="text-sm text-white" dir="auto">{item.alternativeTitles.join(" · ")}</p>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-lunex-gray">{label}</dt>
                <dd className="truncate text-white" dir="auto">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-lunex-gray">التصنيفات</p>
        {genres.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {genres.map((genre) => (
              <Badge key={genre} variant="outline">{genre}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-amber-300">لم يحدد الفريق أي تصنيف.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-lunex-gray">القصة</p>
        {item.synopsis.trim() ? (
          <p className="max-h-56 overflow-y-auto whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-white" dir="auto">
            {item.synopsis}
          </p>
        ) : (
          <p className="text-sm text-amber-300">لم يكتب الفريق وصفًا للعمل.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-lunex-gray">الفصول المرفوعة</p>
        {chapters === null && <Loader2 className="h-4 w-4 animate-spin text-lunex-gray" aria-label="جارِ التحميل" />}
        {chapters?.length === 0 && <p className="text-sm text-lunex-gray">لم يرفع الفريق أي فصل بعد.</p>}
        {chapters && chapters.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {chapters.map((chapter) => (
              <li key={chapter.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5">
                <span className="truncate text-white">{chapterLabel(chapter)}</span>
                <span className="shrink-0 text-xs text-lunex-gray">{chapter.pages.length} صفحة · {chapter.isPublished ? "منشور" : "مسودة"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={() => onDecide("approved")} disabled={busy} className="flex-1">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} موافقة ونشر
        </Button>
        {item.state === "pending" && (
          <Button variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => onDecide("rejected")} disabled={busy}>
            <X className="h-4 w-4" /> رفض
          </Button>
        )}
      </div>
    </div>
  );
}
