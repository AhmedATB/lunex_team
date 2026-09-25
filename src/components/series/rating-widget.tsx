"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Star } from "lucide-react";
import { useSession } from "@/store/session";
import { cn, formatNumber } from "@/lib/utils";

interface RatingBody {
  average: number;
  count: number;
  mine: number | null;
}

/**
 * The series' rating as the server has it. `rating` / `ratingCount` come with the catalogue; once a signed-in
 * reader is here the widget also asks for the live numbers and their own rating, and after they rate it re-renders
 * the page so every card and list showing this work shows the new average.
 */
export function RatingWidget({ seriesId, rating, ratingCount }: { seriesId: string; rating: number; ratingCount: number }) {
  const router = useRouter();
  const currentUserId = useSession((s) => s.currentUserId);
  const [live, setLive] = useState<{ average: number; count: number } | null>(null);
  const [mine, setMine] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const url = `/api/catalog/series/${encodeURIComponent(seriesId)}/rating`;

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<RatingBody>) : null))
      .then((body) => {
        if (cancelled || !body) return;
        setLive({ average: body.average, count: body.count });
        setMine(body.mine ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, currentUserId]);

  async function save(value: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
      if (!res.ok) throw new Error("rating_failed");
      const body = (await res.json()) as RatingBody;
      setLive({ average: body.average, count: body.count });
      setMine(body.mine ?? 0);
      router.refresh();
    } catch {
      setError("تعذر حفظ التقييم، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("rating_failed");
      const fresh = await fetch(url).then((r) => (r.ok ? (r.json() as Promise<RatingBody>) : null));
      if (fresh) setLive({ average: fresh.average, count: fresh.count });
      setMine(0);
      router.refresh();
    } catch {
      setError("تعذر إزالة التقييم، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  const average = live?.average ?? rating;
  const count = live?.count ?? ratingCount;

  return (
    <div className="panel panel-hover space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 fill-amber-300 text-amber-300" />
        <span className="font-display text-lg font-bold text-white">{count > 0 ? average.toFixed(1) : "—"}</span>
        <span className="text-xs text-lunex-gray">({formatNumber(count)} تقييم)</span>
      </div>

      {currentUserId ? (
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              aria-label={`قيّم ${v} من 5`}
              aria-pressed={mine === v}
              onMouseEnter={() => setHover(v)}
              onClick={() => save(v)}
              className="hover-pop p-0.5 disabled:opacity-60"
            >
              <Star className={cn("h-5 w-5 transition-colors", (hover || mine) >= v ? "fill-primary-400 text-primary-400" : "fill-transparent text-lunex-gray")} />
            </button>
          ))}
          {mine > 0 && (
            <>
              <span className="ms-1 text-[11px] text-primary-300">تقييمك: {mine}</span>
              <button type="button" onClick={clear} disabled={busy} className="ms-2 text-[11px] text-lunex-gray underline-offset-2 hover:text-white hover:underline disabled:opacity-60">
                إزالة
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="text-xs text-lunex-gray">سجّل الدخول لتقييم هذا العمل.</p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
