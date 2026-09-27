import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * What a reader finds at the end of a chapter: the next one, one press away. Before, the only way on was the toolbar at the top,
 * which hides while reading — on a phone that meant scrolling all the way back up after every chapter. (In a right-to-left page the
 * first button sits on the right: "previous" is on the right, "next" on the left, as in the toolbar.)
 */
export function ChapterEndNav({ seriesSlug, prevChapter, nextChapter }: { seriesSlug: string; prevChapter?: number; nextChapter?: number }) {
  return (
    <nav aria-label="التنقل بين الفصول" className="container max-w-3xl space-y-3 py-8">
      <div className="grid grid-cols-2 gap-3">
        {prevChapter !== undefined ? (
          <Button asChild variant="secondary" size="lg" className="h-14 text-base">
            <Link href={`/series/${seriesSlug}/${prevChapter}`}>الفصل السابق</Link>
          </Button>
        ) : (
          <span />
        )}
        {nextChapter !== undefined ? (
          <Button asChild size="lg" className="h-14 text-base">
            <Link href={`/series/${seriesSlug}/${nextChapter}`}>الفصل التالي</Link>
          </Button>
        ) : (
          <p className="flex h-14 items-center justify-center rounded-xl border border-white/10 px-3 text-center text-sm text-lunex-gray">هذا آخر فصل حتى الآن</p>
        )}
      </div>
      <Button asChild variant="ghost" className="w-full">
        <Link href={`/series/${seriesSlug}`}>العودة إلى صفحة العمل</Link>
      </Button>
    </nav>
  );
}
