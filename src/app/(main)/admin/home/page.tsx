"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Search, ShieldAlert, X } from "lucide-react";
import { useCatalog } from "@/components/catalog-provider";
import { useSession } from "@/store/session";
import { useToast } from "@/store/toast";
import { can } from "@/lib/rbac";
import { prepareSearchQuery, rankByTier, searchTier, seriesSearchFields } from "@/lib/fuzzy-search";
import { seriesApi } from "@/lib/series-api";
import type { Series } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_PINNED = 12;
/** The home page's top block: one big lead and this many smaller works beside it. */
const SHOWN_ON_HOME = 4;

/** Which works are pinned to the top of the home page, and in what order — the first is the big lead. Saved on the server. */
export default function AdminHomePage() {
  useEffect(() => {
    document.title = "الصفحة الرئيسية | LUNEX TEAM";
  }, []);

  const router = useRouter();
  const db = useCatalog();
  const currentUserId = useSession((s) => s.currentUserId);
  const me = db.users.find((u) => u.id === currentUserId);
  const allowed = !!me && can(me, "manage_series");

  const saved = useMemo(
    () => db.series.filter((s) => s.isFeatured).sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999)).map((s) => s.id),
    [db.series]
  );
  const [order, setOrder] = useState<string[]>(saved);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  // Follow the server's list until the owner starts changing it here.
  useEffect(() => {
    if (!dirty) setOrder(saved);
  }, [saved, dirty]);

  const byId = useMemo(() => new Map(db.series.map((s) => [s.id, s])), [db.series]);
  const pinned = order.map((id) => byId.get(id)).filter((s): s is Series => Boolean(s));

  const candidates = useMemo(() => {
    const prepared = prepareSearchQuery(query);
    const free = db.series.filter((s) => !order.includes(s.id));
    return (prepared.tokens.length === 0 ? free : rankByTier(free, (s) => searchTier(prepared, seriesSearchFields(s)))).slice(0, 8);
  }, [db.series, order, query]);

  function change(next: string[]) {
    setOrder(next);
    setDirty(true);
  }

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  }

  async function save() {
    setBusy(true);
    const result = await seriesApi.setFeatured(order);
    setBusy(false);
    if (!result.ok) {
      useToast.getState().push({ title: "تعذر الحفظ", description: result.message });
      return;
    }
    useToast.getState().push({ title: "حُفظ ترتيب الصفحة الرئيسية" });
    setDirty(false);
    router.refresh();
  }

  if (!allowed) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-red-400" />
        <p className="text-white">هذه الصفحة للمالك والمحررين.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">الصفحة الرئيسية</h1>
          <p className="mt-1 max-w-xl text-sm text-lunex-gray">
            الأعمال المثبّتة تظهر أول شيء في الصفحة الرئيسية: الأول هو العمل الكبير، وتليه {SHOWN_ON_HOME - 1} أعمال أصغر. إن لم تثبّت شيئًا تُعرض الأعمال الأكثر شعبية.
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الترتيب
        </Button>
      </div>

      <section className="space-y-2" aria-label="الأعمال المثبّتة">
        <h2 className="text-sm font-semibold text-white">المثبّتة الآن ({pinned.length})</h2>
        {pinned.length === 0 ? (
          <div className="panel p-6 text-center text-sm text-lunex-gray">لا يوجد شيء مثبّت. أضف عملًا من القائمة أدناه.</div>
        ) : (
          <ol className="space-y-2">
            {pinned.map((s, index) => (
              <li key={s.id}>
                <Card className={cn(index === 0 && "border-primary-400/50")}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-primary-300">{index + 1}</span>
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md">
                      <Image src={s.cover} alt="" fill sizes="40px" className="object-cover" unoptimized />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{s.titleAr}</p>
                      <p className="text-xs text-lunex-gray">
                        {index === 0 ? "العمل الكبير" : index < SHOWN_ON_HOME ? "بجانب العمل الكبير" : "احتياط (لا يظهر الآن)"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={index === 0} aria-label="تقديم">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => move(index, 1)} disabled={index === pinned.length - 1} aria-label="تأخير">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-500/10" onClick={() => change(order.filter((id) => id !== s.id))} aria-label={`إلغاء تثبيت ${s.titleAr}`}>
                      <X className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-2" aria-label="إضافة عمل">
        <h2 className="text-sm font-semibold text-white">تثبيت عمل</h2>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lunex-gray" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن عمل لتثبيته..." className="ps-9" />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {candidates.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={order.length >= MAX_PINNED}
                onClick={() => change([...order, s.id])}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-2.5 text-start transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md">
                  <Image src={s.cover} alt="" fill sizes="36px" className="object-cover" unoptimized />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">{s.titleAr}</span>
                <Plus className="h-4 w-4 shrink-0 text-primary-300" aria-hidden />
              </button>
            </li>
          ))}
          {candidates.length === 0 && <li className="text-sm text-lunex-gray">لا توجد أعمال مطابقة.</li>}
        </ul>
        {order.length >= MAX_PINNED && <p className="text-xs text-amber-300">الحد الأقصى {MAX_PINNED} أعمال مثبّتة.</p>}
      </section>
    </div>
  );
}
