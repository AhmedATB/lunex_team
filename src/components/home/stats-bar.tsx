import { BookMarked, Layers, Users, MessagesSquare, Eye } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { FadeIn } from "@/components/motion/fade-in";

interface Stats {
  totalSeries: number;
  totalChapters: number;
  totalUsers: number;
  totalComments: number;
  totalViews: number;
}

export function StatsBar({ stats }: { stats: Stats }) {
  const items = [
    { icon: Layers, label: "سلسلة", value: stats.totalSeries },
    { icon: BookMarked, label: "فصل منشور", value: stats.totalChapters },
    { icon: Users, label: "قارئ مسجل", value: stats.totalUsers },
    { icon: MessagesSquare, label: "تعليق", value: stats.totalComments },
    { icon: Eye, label: "مشاهدة إجمالية", value: stats.totalViews },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((item, i) => (
        <FadeIn key={item.label} delay={i * 0.05}>
          <div className="panel flex flex-col items-center gap-2 p-4 text-center">
            <item.icon className="h-5 w-5 text-primary-300" />
            <span className="font-display text-lg font-bold text-white">{formatNumber(item.value)}</span>
            <span className="text-[11px] text-lunex-gray">{item.label}</span>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
