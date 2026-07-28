import Image from "next/image";
import Link from "next/link";
import { Megaphone, CalendarDays, Newspaper } from "lucide-react";
import type { NewsItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

const CATEGORY_META = {
  announcement: { label: "إعلان", icon: Megaphone },
  event: { label: "فعالية", icon: CalendarDays },
  news: { label: "خبر", icon: Newspaper },
} as const;

export function NewsSection({ news }: { news: NewsItem[] }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold text-white sm:text-2xl">أخبار وفعاليات الفريق</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {news.map((item) => {
          const meta = CATEGORY_META[item.category];
          const Icon = meta.icon;
          return (
            <Link
              key={item.id}
              href="/news"
              className="group glass ease-premium overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-primary-400/40 hover:shadow-glow active:scale-[0.98]"
            >
              <div className="relative h-40 w-full overflow-hidden">
                <Image
                  src={item.cover}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <Badge variant="secondary" className="absolute start-3 top-3 flex items-center gap-1">
                  <Icon className="h-3 w-3" /> {meta.label}
                </Badge>
              </div>
              <div className="space-y-1 p-4">
                <h3 className="line-clamp-2 font-display text-sm font-bold text-white">{item.title}</h3>
                <p className="text-xs text-lunex-gray">{timeAgo(item.createdAt)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
