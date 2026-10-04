"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Send } from "lucide-react";
import { SeriesFormDialog } from "@/components/admin/series-form-dialog";
import { seriesApi, type ReviewSeries } from "@/lib/series-api";
import type { Series } from "@/lib/types";
import { useToast } from "@/store/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A team's own place to add works. A new work goes to the site's editors first; until they approve it nobody else sees it, and
 * it is listed here as waiting (or turned down, with a way to fix it and send it again). Approved works are the team's list below.
 */
export function TeamSeriesPanel({ teamId }: { teamId: string }) {
  const [items, setItems] = useState<ReviewSeries[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ReviewSeries | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(() => {
    seriesApi.teamReviewList(teamId).then((result) => setItems(result.ok ? result.body : []));
  }, [teamId]);
  useEffect(() => {
    load();
  }, [load]);

  async function resend(item: ReviewSeries) {
    setResending(item.id);
    const result = await seriesApi.update(item.id, { state: "pending" });
    setResending(null);
    if (!result.ok) return useToast.getState().push({ title: "تعذر إرسال العمل للمراجعة", description: result.message });
    useToast.getState().push({ title: "أُرسل للمراجعة من جديد", description: item.titleAr });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-lunex-gray">
          العمل الجديد تراجعه إدارة الموقع أولًا، ويظهر للقرّاء بعد موافقتها. تجدون هنا ما ينتظر الموافقة وما رُفض.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> سلسلة جديدة
        </Button>
      </div>

      {items === null && <Loader2 className="mx-auto h-5 w-5 animate-spin text-lunex-gray" aria-label="جارِ التحميل" />}
      {items?.map((item) => (
        <Card key={item.id} className="panel-hover">
          <CardContent className="flex items-center gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.cover} alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="line-clamp-1 font-bold text-white">{item.titleAr}</p>
              <Badge variant={item.state === "pending" ? "warning" : "destructive"}>{item.state === "pending" ? "بانتظار الموافقة" : "مرفوضة"}</Badge>
              {item.state === "rejected" && <p className="text-xs text-lunex-gray">رفضتها الإدارة. عدّلوها ثم أعيدوا إرسالها للمراجعة.</p>}
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setEditing(item)}>
                <Pencil className="h-3.5 w-3.5" /> تعديل
              </Button>
              {item.state === "rejected" && (
                <Button size="sm" onClick={() => resend(item)} disabled={resending === item.id}>
                  {resending === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} إعادة إرسال
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <SeriesFormDialog open={creating} onClose={() => setCreating(false)} canEditorial={false} fixedTeamId={teamId} onSaved={load} />
      {/* the review lists carry every field the form reads, so they stand in for a catalogue series here */}
      <SeriesFormDialog open={editing !== null} onClose={() => setEditing(null)} series={editing as unknown as Series | null} canEditorial={false} fixedTeamId={teamId} onSaved={load} />
    </div>
  );
}
