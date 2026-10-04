"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { seriesApi, type ReviewSeries } from "@/lib/series-api";
import { useToast } from "@/store/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The works teams' leaders sent, waiting for the site's decision. Approving lists the work (readers see it, the followers and the
 * community hear of it); turning it down keeps it out and lets the team fix it and send it again. Nothing shows when none wait.
 */
export function SeriesReviewPanel() {
  const router = useRouter();
  const teams = useCatalog().teams;
  const [items, setItems] = useState<ReviewSeries[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

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
    useToast.getState().push({ title: state === "approved" ? "وُوفق على العمل ونُشر" : "رُفض العمل", description: item.titleAr });
    load();
    router.refresh();
  }

  if (items.length === 0) return null;
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? "—";

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.cover} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="line-clamp-1 font-bold text-white">{item.titleAr}</p>
              <p className="text-xs text-lunex-gray">
                فريق {teamName(item.teamId)} · {item.state === "pending" ? "جديد" : "سبق رفضه"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
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
    </Card>
  );
}
