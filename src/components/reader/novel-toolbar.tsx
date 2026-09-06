"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ChevronRight, ChevronLeft, Maximize, Minimize, Settings2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNovelReaderSettings, type NovelReadingTheme } from "@/store/reader-settings";
import type { Chapter } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: NovelReadingTheme; label: string; swatch: string }[] = [
  { value: "sepia", label: "ورقي", swatch: "bg-[#f4ecd8]" },
  { value: "light", label: "فاتح", swatch: "bg-white" },
  { value: "dark", label: "داكن", swatch: "bg-[#15151a]" },
];

export function NovelToolbar({
  seriesSlug,
  seriesTitle,
  chapter,
  chapters,
  prevChapter,
  nextChapter,
}: {
  seriesSlug: string;
  seriesTitle: string;
  chapter: Chapter;
  chapters: Chapter[];
  prevChapter?: number;
  nextChapter?: number;
}) {
  const router = useRouter();
  const settings = useNovelReaderSettings();
  const [fullscreen, setFullscreen] = useState(false);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  return (
    <div className="sticky top-16 z-30 flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#09090B]/90 px-3 py-2 backdrop-blur-xl">
      <Link href={`/series/${seriesSlug}`} className="flex items-center gap-1 text-sm text-lunex-gray hover:text-white">
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        <span className="hidden max-w-[140px] truncate sm:inline">{seriesTitle}</span>
      </Link>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" disabled={!prevChapter} onClick={() => prevChapter && router.push(`/series/${seriesSlug}/${prevChapter}`)}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>

        <Select value={String(chapter.number)} onValueChange={(v) => router.push(`/series/${seriesSlug}/${v}`)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {chapters.map((c) => (
              <SelectItem key={c.id} value={String(c.number)}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" disabled={!nextChapter} onClick={() => nextChapter && router.push(`/series/${seriesSlug}/${nextChapter}`)}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      <div className="ms-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><Settings2 className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 space-y-3 p-4">
            <div className="space-y-1.5">
              <span className="text-xs text-lunex-gray">حجم الخط</span>
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  disabled={settings.fontSize <= 15}
                  onClick={() => settings.setFontSize(Math.max(15, settings.fontSize - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="text-sm font-bold">{settings.fontSize}</span>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  disabled={settings.fontSize >= 28}
                  onClick={() => settings.setFontSize(Math.min(28, settings.fontSize + 1))}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-0">خلفية القراءة</DropdownMenuLabel>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => settings.setTheme(t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-colors",
                    settings.theme === t.value ? "border-primary-400" : "border-white/10"
                  )}
                >
                  <span className={cn("h-6 w-full rounded", t.swatch)} />
                  <span className="text-[11px] text-lunex-gray">{t.label}</span>
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
