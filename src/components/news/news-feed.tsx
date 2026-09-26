"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Megaphone, Newspaper } from "lucide-react";
import type { NewsItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { timeAgo } from "@/lib/utils";

const CATEGORY_META = {
  announcement: { label: "إعلان", icon: Megaphone },
  event: { label: "فعالية", icon: CalendarDays },
  news: { label: "خبر", icon: Newspaper },
} as const;

export function NewsFeed({ news }: { news: NewsItem[] }) {
  return (
    <Suspense fallback={null}>
      <Feed news={news} />
    </Suspense>
  );
}

/** The news page: every post as a card; a post opens in full (from its card, or from a `?post=<id>` link such as a notification's). */
function Feed({ news }: { news: NewsItem[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get("post");
  const [openId, setOpenId] = useState<string | null>(wanted);

  useEffect(() => setOpenId(wanted), [wanted]);

  const open = news.find((n) => n.id === openId) ?? null;

  function close() {
    setOpenId(null);
    if (wanted) router.replace("/news");
  }

  return (
    <section className="space-y-4">
      <h1 className="font-display text-xl font-bold text-white sm:text-2xl">أخبار وفعاليات الفريق</h1>
      {news.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-lunex-gray">لا توجد أخبار بعد.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setOpenId(item.id)}
                className="group panel panel-hover overflow-hidden text-start transition-all hover:-translate-y-1 hover:border-primary-400/40 active:scale-[0.98]"
              >
                <div className="relative h-40 w-full overflow-hidden">
                  <Image src={item.cover} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <Badge variant="secondary" className="absolute start-3 top-3 flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {meta.label}
                  </Badge>
                </div>
                <div className="space-y-1 p-4">
                  <h2 className="line-clamp-2 font-display text-sm font-bold text-white">{item.title}</h2>
                  {item.excerpt && <p className="line-clamp-2 text-xs text-lunex-gray">{item.excerpt}</p>}
                  <p className="text-xs text-lunex-gray/70">{timeAgo(item.createdAt)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
          {open && (
            <article>
              <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-t-2xl">
                <Image src={open.cover} alt="" fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
              </div>
              <div className="space-y-3 p-5">
                <DialogHeader>
                  <div className="flex items-center gap-2 text-xs text-lunex-gray">
                    <Badge variant="secondary">{CATEGORY_META[open.category].label}</Badge>
                    <span>{timeAgo(open.createdAt)}</span>
                  </div>
                  <DialogTitle className="text-start leading-snug">{open.title}</DialogTitle>
                </DialogHeader>
                {open.excerpt && <p className="text-sm font-medium text-white/90">{open.excerpt}</p>}
                {open.content && <p className="whitespace-pre-line text-sm leading-relaxed text-lunex-gray">{open.content}</p>}
              </div>
            </article>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
