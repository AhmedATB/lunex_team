import { Flame, BookOpen } from "lucide-react";
import { ACHIEVEMENT_INFO } from "@/lib/achievements";
import { formatNumber } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { PublicProgress } from "@/lib/profile-types";

/** Someone's level, experience, streak and earned achievements, as shown on their public profile (only when they let others see their reading). */
export function ProgressSummary({ progress }: { progress: PublicProgress }) {
  const earned = progress.achievements.map((id) => ACHIEVEMENT_INFO[id]).filter(Boolean);
  return (
    <div className="mx-auto max-w-xs space-y-2 sm:mx-0">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-lunex-gray">
          <span>المستوى {progress.level}</span>
          <span>
            {progress.xpIntoLevel}/{progress.levelSpan} XP
          </span>
        </div>
        <Progress value={(progress.xpIntoLevel / progress.levelSpan) * 100} />
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-lunex-gray sm:justify-start">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-primary-300" /> {formatNumber(progress.chaptersRead)} فصل
        </span>
        <span className="flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-primary-300" /> {progress.streak} يوم متتالٍ
        </span>
        <span>{formatNumber(progress.xp)} XP</span>
      </div>

      {earned.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 pt-0.5 sm:justify-start">
          {earned.map((a) => {
            const Icon = a.icon;
            return (
              <Badge key={a.id} variant="secondary" className="flex items-center gap-1" title={a.description}>
                <Icon className="h-3 w-3" /> {a.title}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
